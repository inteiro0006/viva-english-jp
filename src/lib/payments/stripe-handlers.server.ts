// Shared Stripe event handlers. Used by both the public webhook and the admin
// "reprocess" / reconciliation tools so reprocessing is identical to production.
// SERVER-ONLY: never import from client-reachable modules at module scope.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PaymentEnvironment } from "./payments.config.server";
import { createStripeClient } from "@/lib/stripe.server";
import { verifyCheckoutSession, PaymentVerificationError } from "./session-validation.server";

type StripeObject = Record<string, unknown>;
export type StripeEventLike = {
  id: string;
  type: string;
  livemode?: boolean;
  data: { object: StripeObject };
};

let _admin: SupabaseClient<Database> | null = null;
export function getStripeAdminClient(): SupabaseClient<Database> {
  if (!_admin) {
    _admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function meta(obj: StripeObject): Record<string, string> {
  const m = obj.metadata;
  return (m && typeof m === "object" ? m : {}) as Record<string, string>;
}

/** Sanitized message safe to persist / show to an admin. */
export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/(sk|rk|whsec|pk)_[A-Za-z0-9_]+/g, "«redacted»").slice(0, 500);
}

/** Permanent problems must not be retried forever by Stripe. */
export function isPermanentFailure(err: unknown): boolean {
  return err instanceof PaymentVerificationError;
}

/**
 * Fulfill a paid Checkout Session.
 *
 * The webhook snapshot is only used to learn the session id — every amount,
 * price, product and identity check is made against a fresh Stripe read.
 */
export async function fulfillCheckoutSession(
  sessionId: string,
  environment: PaymentEnvironment,
): Promise<{ fulfilled: boolean; reason?: string }> {
  const db = getStripeAdminClient();
  const stripe = createStripeClient(environment);

  const verified = await verifyCheckoutSession({ stripe, db, environment, sessionId });
  if (!verified.paymentIntentId) {
    throw new PaymentVerificationError("missing_payment_intent");
  }

  const { error } = await db.rpc("fulfill_paid_order", {
    _order_id: verified.orderId,
    _environment: environment,
    _provider_checkout_id: verified.sessionId,
    _provider_payment_id: verified.paymentIntentId,
    _amount: verified.financials.total,
    _currency: verified.financials.currency,
    _customer_email: verified.customerEmail ?? undefined,
    _subtotal: verified.financials.subtotal,
    _tax: verified.financials.tax,
    _discount: verified.financials.discount,
    _stripe_price_id: verified.priceId ?? undefined,
    _stripe_product_id: verified.productId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return { fulfilled: true };
}

export async function handleCheckoutCompleted(
  session: StripeObject,
  environment: PaymentEnvironment,
) {
  const sessionId = str(session.id);
  if (!sessionId) throw new PaymentVerificationError("missing_session_id");
  // Deferred methods (Konbini / bank transfer) arrive unpaid; the async
  // success event re-runs this handler once the funds settle.
  if (session.payment_status === "unpaid") return;
  await fulfillCheckoutSession(sessionId, environment);
}

/** Recompute the refunded total for a charge and settle it atomically. */
export async function handleRefund(charge: StripeObject, environment: PaymentEnvironment) {
  const paymentIntentId = str(charge.payment_intent);
  if (!paymentIntentId) return;

  const db = getStripeAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id, environment, status")
    .eq("provider_payment_id", paymentIntentId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return;

  // NEVER trust the event snapshot for money: re-read the charge from Stripe
  // and use its authoritative accumulated refunded total.
  const stripe = createStripeClient(environment);
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const latestCharge = intent.latest_charge;
  const refundedTotal =
    typeof latestCharge === "string" || !latestCharge
      ? 0
      : Number(latestCharge.amount_refunded ?? 0);
  if (refundedTotal <= 0) return;

  const { error: rpcErr } = await db.rpc("apply_refund_outcome", {
    _order_id: order.id,
    _environment: environment,
    _refunded_total: refundedTotal,
    _refund_status: "succeeded",
  });

  if (rpcErr) throw new Error(rpcErr.message);
}

/** `refund.*` events carry the refund object; reconcile the request row too. */
export async function handleRefundEvent(refund: StripeObject, environment: PaymentEnvironment) {
  const refundId = str(refund.id);
  const paymentIntentId = str(refund.payment_intent);
  const status = str(refund.status) ?? "pending";
  const db = getStripeAdminClient();

  if (refundId) {
    const { error } = await db
      .from("refund_requests")
      .update({
        status:
          status === "succeeded"
            ? "succeeded"
            : status === "failed" || status === "canceled"
              ? (status as "failed" | "canceled")
              : "pending",
        processing_error: status === "failed" ? "provider_reported_failure" : null,
      })
      .eq("provider_refund_id", refundId)
      .eq("environment", environment);
    if (error) throw new Error(error.message);
  }

  if (!paymentIntentId || status !== "succeeded") return;

  // Recompute the authoritative refunded total from Stripe, never from the
  // single event amount (multiple partial refunds may exist).
  const stripe = createStripeClient(environment);
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const charge = intent.latest_charge;
  const refundedTotal =
    typeof charge === "string" || !charge ? 0 : Number(charge.amount_refunded ?? 0);
  if (refundedTotal <= 0) return;

  const { data: order, error } = await db
    .from("orders")
    .select("id")
    .eq("provider_payment_id", paymentIntentId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return;

  const { error: rpcErr } = await db.rpc("apply_refund_outcome", {
    _order_id: order.id,
    _environment: environment,
    _refunded_total: refundedTotal,
    _provider_refund_id: refundId ?? undefined,
    _refund_status: "succeeded",
  });
  if (rpcErr) throw new Error(rpcErr.message);
}

async function markOrderFailed(orderId: string | undefined, environment: PaymentEnvironment) {
  if (!orderId) return;
  const { error } = await getStripeAdminClient()
    .from("orders")
    .update({ status: "failed" })
    .eq("id", orderId)
    .eq("environment", environment)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** Dispatch a Stripe event to its handler. All handlers are idempotent. */
export async function dispatchStripeEvent(
  event: StripeEventLike,
  environment: PaymentEnvironment,
): Promise<{ handled: boolean }> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(obj, environment);
      return { handled: true };
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
    case "payment_intent.payment_failed":
      await markOrderFailed(str(meta(obj).orderId), environment);
      return { handled: true };
    case "charge.refunded":
      await handleRefund(obj, environment);
      return { handled: true };
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
    case "charge.refund.updated":
      await handleRefundEvent(obj, environment);
      return { handled: true };
    default:
      return { handled: false };
  }
}
