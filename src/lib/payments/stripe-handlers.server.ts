// Shared Stripe event handlers. Used by both the public webhook and the admin
// "reprocess" tool so reprocessing is identical to production.
// SERVER-ONLY: never import from client-reachable modules at module scope.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PaymentEnvironment } from "./payments.config.server";

type StripeObject = Record<string, unknown>;
export type StripeEventLike = {
  id: string;
  type: string;
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
  return raw.replace(/(sk|rk|whsec)_[A-Za-z0-9_]+/g, "«redacted»").slice(0, 500);
}

export async function handleCheckoutCompleted(
  session: StripeObject,
  environment: PaymentEnvironment,
) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const m = meta(session);
  const orderId = str(m.orderId);
  if (!orderId) throw new Error("Missing orderId metadata on session");

  const paymentIntent = str(session.payment_intent);
  const customerDetails = (session.customer_details ?? {}) as StripeObject;

  const { error } = await getStripeAdminClient().rpc("fulfill_paid_order", {
    _order_id: orderId,
    _environment: environment,
    _provider_checkout_id: str(session.id) ?? "",
    _provider_payment_id: paymentIntent ?? null,
    _amount: Number(session.amount_total ?? 0),
    _currency: String(session.currency ?? "jpy"),
    _customer_email: str(customerDetails.email) ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function handleRefund(
  paymentIntentId: string | undefined,
  environment: PaymentEnvironment,
) {
  if (!paymentIntentId) return;
  const admin = getStripeAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, user_id, course_id, environment")
    .eq("provider_payment_id", paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return;
  if (order.environment !== environment) throw new Error("environment_mismatch");

  const { error: orderErr } = await admin
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", order.id);
  if (orderErr) throw new Error(orderErr.message);

  const { error: enrollErr } = await admin
    .from("enrollments")
    .update({ status: "refunded" })
    .eq("order_id", order.id);
  if (enrollErr) throw new Error(enrollErr.message);
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
      await handleCheckoutCompleted(obj, environment);
      return { handled: true };
    case "checkout.session.expired":
      await markOrderFailed(str(meta(obj).orderId), environment);
      return { handled: true };
    case "charge.refunded":
      await handleRefund(str(obj.payment_intent), environment);
      return { handled: true };
    case "payment_intent.payment_failed":
      await markOrderFailed(str(meta(obj).orderId), environment);
      return { handled: true };
    default:
      return { handled: false };
  }
}
