// SERVER-ONLY: authoritative Checkout Session validation.
//
// The webhook snapshot is treated as a hint only. Every financial decision is
// made against a fresh `checkout.sessions.retrieve` with line items expanded.
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PaymentEnvironment } from "./payments.config.server";
import { validateFinancials, type FinancialSnapshot } from "./order-state";

export type VerifiedPayment = {
  sessionId: string;
  paymentIntentId: string | null;
  orderId: string;
  userId: string;
  courseId: string;
  priceId: string | null;
  productId: string | null;
  quantity: number;
  customerEmail: string | null;
  financials: FinancialSnapshot;
};

export class PaymentVerificationError extends Error {
  constructor(
    public readonly reason: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(reason);
    this.name = "PaymentVerificationError";
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Re-read the session from Stripe and validate mode, payment status,
 * environment, metadata, price/product, quantity and every amount against the
 * pending order.
 */
export async function verifyCheckoutSession(args: {
  stripe: Stripe;
  db: SupabaseClient<Database>;
  environment: PaymentEnvironment;
  sessionId: string;
}): Promise<VerifiedPayment> {
  const { stripe, db, environment, sessionId } = args;

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product", "payment_intent"],
  });

  if (session.mode !== "payment") throw new PaymentVerificationError("mode_not_payment");
  if (session.payment_status !== "paid") {
    throw new PaymentVerificationError("not_paid", { payment_status: session.payment_status });
  }
  const expectLive = environment === "live";
  if (session.livemode !== expectLive) {
    throw new PaymentVerificationError("livemode_mismatch", { livemode: session.livemode });
  }

  const metadata = session.metadata ?? {};
  const orderId = asString(metadata.orderId);
  const userId = asString(metadata.userId);
  const courseId = asString(metadata.courseId);
  if (!orderId || !userId || !courseId) {
    throw new PaymentVerificationError("missing_metadata");
  }

  const lineItems = session.line_items?.data ?? [];
  if (lineItems.length !== 1) throw new PaymentVerificationError("unexpected_line_items");
  const item = lineItems[0];
  if ((item.quantity ?? 1) !== 1) throw new PaymentVerificationError("unexpected_quantity");
  const price = item.price;
  const priceId = price?.id ?? null;
  const productRef = price?.product;
  const productId = typeof productRef === "string" ? productRef : (productRef?.id ?? null);

  const total = Number(session.amount_total ?? 0);
  const subtotalRaw = Number(session.amount_subtotal ?? 0);
  const tax = Number(session.total_details?.amount_tax ?? 0);
  const discount = Number(session.total_details?.amount_discount ?? 0);
  const currency = String(session.currency ?? "").toLowerCase();
  const financials: FinancialSnapshot = {
    // Stripe's `amount_subtotal` is pre-discount / pre-tax for exclusive tax
    // setups; fall back to deriving it when absent.
    subtotal: subtotalRaw > 0 ? subtotalRaw : total - tax + discount,
    tax,
    discount,
    total,
    currency,
  };

  const { data: order, error } = await db
    .from("orders")
    .select(
      "id, user_id, course_id, environment, status, amount, subtotal_amount, currency, stripe_price_id, stripe_product_id, provider_checkout_id, provider_payment_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new PaymentVerificationError("order_not_found");
  if (order.environment !== environment) {
    throw new PaymentVerificationError("environment_mismatch");
  }
  if (order.user_id !== userId) throw new PaymentVerificationError("user_mismatch");
  if (order.course_id !== courseId) throw new PaymentVerificationError("course_mismatch");
  if (order.provider_checkout_id && order.provider_checkout_id !== session.id) {
    throw new PaymentVerificationError("checkout_id_mismatch");
  }

  const validation = validateFinancials(
    financials,
    {
      expectedSubtotal: Number(order.subtotal_amount ?? order.amount),
      expectedCurrency: order.currency,
      expectedPriceId: order.stripe_price_id,
      expectedProductId: order.stripe_product_id,
    },
    { priceId, productId },
  );
  if (!validation.ok) {
    throw new PaymentVerificationError(validation.reason, validation.detail);
  }

  const paymentIntent = session.payment_intent;
  const paymentIntentId =
    typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null);
  if (order.provider_payment_id && paymentIntentId && order.provider_payment_id !== paymentIntentId) {
    throw new PaymentVerificationError("payment_intent_mismatch");
  }

  return {
    sessionId: session.id,
    paymentIntentId,
    orderId,
    userId,
    courseId,
    priceId,
    productId,
    quantity: 1,
    customerEmail: session.customer_details?.email ?? null,
    financials,
  };
}
