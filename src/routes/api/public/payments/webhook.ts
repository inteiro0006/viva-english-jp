import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  getStripeAdminClient,
  dispatchStripeEvent,
  sanitizeError,
  type StripeEventLike,
} from "@/lib/payments/stripe-handlers.server";

const UNIQUE_VIOLATION = "23505";

/**
 * Insert the event row. Returns `duplicate: true` ONLY on a real unique-key
 * violation — every other error is propagated so Stripe retries.
 */
async function recordEvent(
  event: StripeEventLike,
  environment: StripeEnv,
): Promise<{ duplicate: boolean }> {
  const { error } = await getStripeAdminClient()
    .from("payment_events")
    .insert({
      provider: "stripe",
      environment,
      provider_event_id: event.id,
      event_type: event.type,
      payload: event as never,
      processed: false,
    });
  if (!error) return { duplicate: false };
  if (error.code === UNIQUE_VIOLATION) return { duplicate: true };
  throw new Error(error.message);
}

async function finish(eventId: string, environment: StripeEnv, err?: unknown) {
  const admin = getStripeAdminClient();
  const { data: current } = await admin
    .from("payment_events")
    .select("attempts")
    .eq("provider", "stripe")
    .eq("environment", environment)
    .eq("provider_event_id", eventId)
    .maybeSingle();

  await admin
    .from("payment_events")
    .update({
      processed: !err,
      processed_at: err ? null : new Date().toISOString(),
      processing_error: err ? sanitizeError(err) : null,
      attempts: (current?.attempts ?? 0) + 1,
    })
    .eq("provider", "stripe")
    .eq("environment", environment)
    .eq("provider_event_id", eventId);
}

async function processEvent(environment: StripeEnv, req: Request) {
  // 1. Signature + freshness are verified before anything else.
  const event = (await verifyWebhook(req, environment)) as StripeEventLike;

  // 2. Real idempotency on (provider, environment, provider_event_id).
  const { duplicate } = await recordEvent(event, environment);
  if (duplicate) return;

  try {
    const { handled } = await dispatchStripeEvent(event, environment);
    if (!handled) console.log("Unhandled Stripe event:", event.type);
    // 3. Marked processed only after every operation succeeded.
    await finish(event.id, environment);
  } catch (err) {
    await finish(event.id, environment, err);
    throw err;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return new Response("Invalid environment", { status: 400 });
        }
        // A sandbox webhook must never be honoured by a live deployment.
        const configured = process.env.PAYMENTS_ENVIRONMENT?.trim().toLowerCase();
        if (configured === "live" && rawEnv === "sandbox") {
          return new Response("Sandbox webhook rejected", { status: 400 });
        }

        try {
          await processEvent(rawEnv, request);
          return Response.json({ received: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Signature problems are permanent -> 400 (no retry).
          if (/signature|timestamp|Missing signature/i.test(message)) {
            console.error("Stripe webhook signature error:", message);
            return new Response("Invalid signature", { status: 400 });
          }
          // Everything else is potentially transient -> 5xx so Stripe retries.
          console.error("Stripe webhook processing error:", message);
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
