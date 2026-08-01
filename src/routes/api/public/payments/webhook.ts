import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  getStripeAdminClient,
  dispatchStripeEvent,
  isPermanentFailure,
  sanitizeError,
  type StripeEventLike,
} from "@/lib/payments/stripe-handlers.server";

type ClaimOutcome = "claimed" | "duplicate" | "in_progress";

/**
 * Reserve the event for processing.
 *
 * `claim_payment_event` inserts-or-locks the row atomically, so two concurrent
 * deliveries of the same event can never both run the handlers.
 */
async function claimEvent(
  event: StripeEventLike,
  environment: StripeEnv,
): Promise<ClaimOutcome> {
  const { data, error } = await getStripeAdminClient().rpc("claim_payment_event", {
    _provider: "stripe",
    _environment: environment,
    _provider_event_id: event.id,
    _event_type: event.type,
    _payload: event as never,
    _livemode: event.livemode ?? environment === "live",
  });
  if (error) throw new Error(error.message);
  const outcome = (Array.isArray(data) ? data[0] : data) as ClaimOutcome | null;
  return outcome ?? "duplicate";
}

async function completeEvent(
  event: StripeEventLike,
  environment: StripeEnv,
  outcome: { status: "processed" | "failed" | "ignored"; error?: unknown },
) {
  const { error } = await getStripeAdminClient().rpc("complete_payment_event", {
    _provider: "stripe",
    _environment: environment,
    _provider_event_id: event.id,
    _status: outcome.status,
    _processing_error: outcome.error ? sanitizeError(outcome.error) : undefined,
  });
  if (error) console.error("[webhook] could not finalize event:", error.message);
}

async function processEvent(environment: StripeEnv, req: Request) {
  // 1. Signature, freshness and payload shape are verified before anything else.
  const event = (await verifyWebhook(req, environment)) as StripeEventLike;

  // 2. The event's own livemode flag must match the endpoint environment.
  const expectLive = environment === "live";
  if (event.livemode !== undefined && event.livemode !== expectLive) {
    console.error("[webhook] livemode mismatch", { id: event.id, livemode: event.livemode });
    return { status: 400 as const, body: "Environment mismatch" };
  }

  // 3. Atomic claim => real idempotency, including under concurrency.
  const claim = await claimEvent(event, environment);
  if (claim !== "claimed") return { status: 200 as const, body: { received: true, claim } };

  try {
    const { handled } = await dispatchStripeEvent(event, environment);
    await completeEvent(event, environment, { status: handled ? "processed" : "ignored" });
    return { status: 200 as const, body: { received: true, handled } };
  } catch (err) {
    await completeEvent(event, environment, { status: "failed", error: err });
    // Validation failures are permanent: retrying cannot change the outcome,
    // so acknowledge instead of letting Stripe retry for three days.
    if (isPermanentFailure(err)) {
      console.error("[webhook] permanent validation failure:", sanitizeError(err));
      return { status: 200 as const, body: { received: true, rejected: true } };
    }
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
          const result = await processEvent(rawEnv, request);
          if (result.status === 400) return new Response(result.body as string, { status: 400 });
          return Response.json(result.body);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Signature/payload problems are permanent -> 400 (no retry).
          if (/signature|timestamp|Missing signature|Invalid webhook payload/i.test(message)) {
            console.error("Stripe webhook rejected:", sanitizeError(message));
            return new Response("Invalid signature", { status: 400 });
          }
          // Everything else is potentially transient -> 5xx so Stripe retries.
          console.error("Stripe webhook processing error:", sanitizeError(message));
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
