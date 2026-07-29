// Shared Stripe event handlers. Used by both the public webhook and the admin
// "reprocess" tool so the reprocessed logic is exactly the same as production.
// SERVER-ONLY: never import from client-reachable modules.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

export async function handleCheckoutCompleted(session: any) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const orderId = session.metadata?.orderId as string | undefined;
  const userId = session.metadata?.userId as string | undefined;
  const courseId = session.metadata?.courseId as string | undefined;
  if (!orderId || !userId || !courseId) {
    throw new Error("Missing metadata on session");
  }

  const admin = getStripeAdminClient();

  await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_payment_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      customer_email: session.customer_details?.email ?? null,
    })
    .eq("id", orderId);

  const { data: existing } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("status", "active")
    .limit(1);
  if (existing && existing.length > 0) return;

  await admin.from("enrollments").insert({
    user_id: userId,
    course_id: courseId,
    order_id: orderId,
    status: "active",
  });
}

export async function handleRefund(paymentIntentId: string | null | undefined) {
  if (!paymentIntentId) return;
  const admin = getStripeAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, course_id")
    .eq("provider_payment_id", paymentIntentId)
    .maybeSingle();
  if (!order) return;
  await admin.from("orders").update({ status: "refunded" }).eq("id", order.id);
  await admin
    .from("enrollments")
    .update({ status: "refunded" })
    .eq("order_id", order.id);
}

export async function handleSessionExpired(session: any) {
  const orderId = session.metadata?.orderId as string | undefined;
  if (!orderId) return;
  await getStripeAdminClient()
    .from("orders")
    .update({ status: "failed" })
    .eq("id", orderId);
}

export async function handlePaymentFailed(pi: any) {
  const orderId = pi?.metadata?.orderId as string | undefined;
  if (!orderId) return;
  await getStripeAdminClient()
    .from("orders")
    .update({ status: "failed" })
    .eq("id", orderId);
}

/**
 * Dispatch a Stripe event to its handler. Idempotent — handlers all
 * check current state before mutating.
 */
export async function dispatchStripeEvent(event: {
  type: string;
  data: { object: any };
}): Promise<{ handled: boolean }> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      return { handled: true };
    case "checkout.session.expired":
      await handleSessionExpired(event.data.object);
      return { handled: true };
    case "charge.refunded":
      await handleRefund(event.data.object?.payment_intent);
      return { handled: true };
    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object);
      return { handled: true };
    default:
      return { handled: false };
  }
}
