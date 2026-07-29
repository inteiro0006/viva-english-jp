import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  getStripeAdminClient,
  dispatchStripeEvent,
} from "@/lib/payments/stripe-handlers.server";

async function recordEvent(eventId: string, eventType: string, payload: unknown) {
  const { error } = await getStripeAdminClient()
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
  await getStripeAdminClient()
    .from("payment_events")
    .update({ processed: !err, processing_error: err ?? null })
    .eq("provider_event_id", eventId);
}

async function processEvent(env: StripeEnv, req: Request) {
  const event = await verifyWebhook(req, env);
  const rec = await recordEvent(event.id, event.type, event);
  if (rec.duplicate) return;

  try {
    const { handled } = await dispatchStripeEvent(event);
    if (!handled) console.log("Unhandled Stripe event:", event.type);
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
