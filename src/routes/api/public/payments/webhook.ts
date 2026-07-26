import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";

let _admin: SupabaseClient<Database> | null = null;
function getAdmin(): SupabaseClient<Database> {
  if (!_admin) {
    _admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

async function recordEvent(eventId: string, eventType: string, payload: unknown) {
  // Idempotency: unique on provider_event_id (assumed). Insert returns error on conflict.
  const { error } = await getAdmin()
    .from("payment_events")
    .insert({
      provider: "stripe",
      provider_event_id: eventId,
      event_type: eventType,
      payload: payload as never,
      processed: false,
    });
  return { duplicate: !!error, error };
}

async function markProcessed(eventId: string, err?: string) {
  await getAdmin()
    .from("payment_events")
    .update({ processed: !err, processing_error: err ?? null })
    .eq("provider_event_id", eventId);
}

async function handleCheckoutCompleted(session: any) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const orderId = session.metadata?.orderId as string | undefined;
  const userId = session.metadata?.userId as string | undefined;
  const courseId = session.metadata?.courseId as string | undefined;
  if (!orderId || !userId || !courseId) {
    throw new Error("Missing metadata on session");
  }

  const admin = getAdmin();

  // Update the order.
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

  // Skip if already enrolled (duplicate purchase).
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

async function handleRefund(paymentIntentId: string | null | undefined) {
  if (!paymentIntentId) return;
  const admin = getAdmin();
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

async function handleSessionExpired(session: any) {
  const orderId = session.metadata?.orderId as string | undefined;
  if (!orderId) return;
  await getAdmin().from("orders").update({ status: "failed" }).eq("id", orderId);
}

async function processEvent(env: StripeEnv, req: Request) {
  const event = await verifyWebhook(req, env);
  const rec = await recordEvent(event.id, event.type, event);
  if (rec.duplicate) return; // already processed

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "checkout.session.expired":
        await handleSessionExpired(event.data.object);
        break;
      case "charge.refunded": {
        const charge = event.data.object;
        await handleRefund(charge.payment_intent);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await getAdmin().from("orders").update({ status: "failed" }).eq("id", orderId);
        }
        break;
      }
      default:
        console.log("Unhandled Stripe event:", event.type);
    }
    await markProcessed(event.id);
  } catch (err) {
    await markProcessed(event.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await processEvent(rawEnv, request);
          return Response.json({ received: true });
        } catch (err) {
          console.error("Stripe webhook error:", err);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
