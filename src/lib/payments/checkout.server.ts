// SERVER-ONLY checkout logic. Never import from client-reachable modules at
// module scope — always `await import()` inside a handler.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import {
  CHECKOUT_COURSE_SLUG,
  assertClientTokenMatches,
  getCheckoutReturnUrl,
  resolvePaymentEnvironment,
  type PaymentEnvironment,
} from "./payments.config.server";
import { resolveCoursePrice, PriceConfigError } from "./price.server";
import { resolveCustomerForUser } from "./customers.server";
import { checkoutIdempotencyKey } from "./order-state";
import type { CheckoutErrorCode, CheckoutResult } from "./checkout.functions";

let _admin: SupabaseClient<Database> | null = null;
function admin(): SupabaseClient<Database> {
  if (!_admin) {
    _admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

function fail(code: CheckoutErrorCode, detail?: unknown): CheckoutResult {
  if (detail) console.error(`[checkout] ${code}:`, detail);
  return { error: code };
}

/** In-memory rate limit (per instance) — cheap guard against click storms. */
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 5;
const attempts = new Map<string, number[]>();

export function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) attempts.clear();
  return recent.length > RATE_LIMIT_MAX;
}

/** Public price for display — the same Stripe price the checkout charges. */
export async function getCoursePriceForDisplay(): Promise<{
  amount: number;
  currency: string;
  productName: string;
  environment: PaymentEnvironment;
}> {
  const environment = resolvePaymentEnvironment();
  const stripe = createStripeClient(environment);
  const price = await resolveCoursePrice(stripe);
  return {
    amount: price.unitAmount,
    currency: price.currency,
    productName: price.productName,
    environment,
  };
}

export async function createCheckoutSessionForUser(args: {
  userId: string;
  email?: string;
  origin?: string;
}): Promise<CheckoutResult> {
  const { userId, email, origin } = args;

  let environment: PaymentEnvironment;
  let returnUrl: string;
  try {
    environment = resolvePaymentEnvironment();
    // Publishable token and server credentials must belong to the same env.
    assertClientTokenMatches(environment);
    returnUrl = getCheckoutReturnUrl(origin);
  } catch (err) {
    return fail("not_configured", err);
  }

  if (rateLimited(`${environment}:${userId}`)) return fail("rate_limited");

  const db = admin();

  // Course is resolved server-side; only published courses can be sold.
  const { data: course, error: courseErr } = await db
    .from("courses")
    .select("id, slug, status")
    .eq("slug", CHECKOUT_COURSE_SLUG)
    .eq("status", "published")
    .maybeSingle();
  if (courseErr) return fail("course_unavailable", courseErr.message);
  if (!course) return fail("course_unavailable");

  // Block duplicate purchase — only a genuinely ACTIVE enrollment blocks.
  const { data: active, error: enrollErr } = await db
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .eq("status", "active")
    .limit(1);
  if (enrollErr) return fail("order_failed", enrollErr.message);
  if (active && active.length > 0) return { error: "already_enrolled" };

  try {
    const stripe = createStripeClient(environment);

    let price;
    try {
      price = await resolveCoursePrice(stripe);
    } catch (err) {
      if (err instanceof PriceConfigError) return fail("price_unavailable", err.reason);
      throw err;
    }

    // Atomically get-or-create the single pending order for this purchase.
    const { data: orderRow, error: orderErr } = await db.rpc("get_or_create_pending_order", {
      _user_id: userId,
      _course_id: course.id,
      _environment: environment,
      _subtotal: price.unitAmount,
      _currency: price.currency,
      _stripe_price_id: price.priceId,
      _stripe_product_id: price.productId,
      _customer_email: email ?? undefined,
    });
    if (orderErr) return fail("order_failed", orderErr.message);
    const order = (Array.isArray(orderRow) ? orderRow[0] : orderRow) as
      | Database["public"]["Tables"]["orders"]["Row"]
      | null;
    if (!order) return fail("order_failed");

    // Reuse a still-open session for this order instead of leaking sessions.
    if (order.provider_checkout_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(order.provider_checkout_id);
        if (existing.status === "open" && existing.client_secret) {
          return { clientSecret: existing.client_secret };
        }
      } catch (err) {
        console.warn("[checkout] could not reuse pending session", err);
      }
    }

    const customerId = await resolveCustomerForUser({
      stripe,
      db,
      userId,
      environment,
      email,
    });

    // Same order id => same idempotency key, so an indeterminate network
    // failure can be retried without creating a second session or order.
    const idempotencyKey = checkoutIdempotencyKey(order.id, price.priceId);

    const session = await stripe.checkout.sessions.create(
      {
        line_items: [{ price: price.priceId, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        payment_intent_data: {
          description: price.productName,
          metadata: { userId, courseId: course.id, orderId: order.id, environment },
        },
        metadata: { userId, courseId: course.id, orderId: order.id, environment },
      },
      { idempotencyKey },
    );

    const { error: updateErr } = await db
      .from("orders")
      .update({ provider_checkout_id: session.id })
      .eq("id", order.id);
    // A failure here is recoverable: the webhook attaches the session id after
    // full validation, so do not abort a paid-capable session.
    if (updateErr) console.error("[checkout] could not persist session id:", updateErr.message);

    if (!session.client_secret) return fail("checkout_failed");
    return { clientSecret: session.client_secret };
  } catch (error) {
    return fail("checkout_failed", getStripeErrorMessage(error));
  }
}
