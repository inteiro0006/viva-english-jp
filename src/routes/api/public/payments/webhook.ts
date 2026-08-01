import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  getStripeAdminClient,
  dispatchStripeEvent,
  isPermanentFailure,
  sanitizeError,
  type StripeEventLike,
} from "@/lib/payments/stripe-handlers.server";

type ClaimResult = {
  action: "claimed" | "already_processed" | "locked";
  event_id: string;
  attempts?: number;
};

/**
 * Reserve the event for processing.
 *
 * `claim_payment_event` inserts-or-locks the row atomically, so two concurrent
 * deliveries of the same event can never both run the handlers.
 */
async function claimEvent(event: StripeEventLike, environment: StripeEnv): Promise<ClaimResult> {
  const { data, error } = await getStripeAdminClient().rpc("claim_payment_event", {
    _provider: "stripe",
    _environment: environment,
    _provider_event_id: event.id,
    _event_type: event.type,
    _payload: event as never,
    _livemode: event.livemode ?? environment === "live",
  });
  if (error) throw new Error(error.message);
  return data as unknown as ClaimResult;
}

async function completeEvent(
  eventId: string,
  outcome: { status: "processed" | "failed" | "ignored"; unhandled?: boolean; error?: unknown },
) {
  const { error } = await getStripeAdminClient().rpc("complete_payment_event", {
    _event_id: eventId,
    _status: outcome.status,
    _unhandled: outcome.unhandled,
    _error: outcome.error ? sanitizeError(outcome.error) : undefined,
  });
  if (error) console.error("[webhook] could not finalize event:", error.message);
}

type ProcessResult = { status: number; body: string | Record<string, unknown> };

async function processEvent(environment: StripeEnv, req: Request): Promise<ProcessResult> {
  // 1. Signature, freshness and payload shape are verified before anything else.
  const event = (await verifyWebhook(req, environment)) as StripeEventLike;

  // 2. The event's own livemode flag must match the endpoint environment.
  const expectLive = environment === "live";
  if (event.livemode !== undefined && event.livemode !== expectLive) {
    console.error("[webhook] livemode mismatch", { id: event.id, livemode: event.livemode });
    return { status: 400, body: "Environment mismatch" };
  }

  // 3. Atomic claim => real idempotency, including under concurrency.
  const claim = await claimEvent(event, environment);
  const claimDecision = decideFromClaim(claim.action);
  if (claimDecision.kind === "respond") {
    // `locked` intentionally answers 409 so Stripe redelivers instead of the
    // event being lost when the lock holder dies mid-flight.
    return { status: claimDecision.status, body: claimDecision.body };
  }

  try {
    const { handled } = await dispatchStripeEvent(event, environment);
    await completeEvent(claim.event_id, {
      status: handled ? "processed" : "ignored",
      unhandled: !handled,
    });
    return { status: 200, body: { received: true, handled } };
  } catch (err) {
    await completeEvent(claim.event_id, { status: "failed", error: err });
    const decision = decideFromFailure(isPermanentFailure(err));
    if (decision.kind === "respond" && decision.status === 200) {
      console.error("[webhook] permanent validation failure:", sanitizeError(err));
      return { status: decision.status, body: decision.body };
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
        // A sandbox webhook must never be honoured by a live deployment, and a
        // live webhook must never be honoured by a sandbox deployment.
        const configured = process.env.PAYMENTS_ENVIRONMENT?.trim().toLowerCase();
        if ((configured === "live" || configured === "sandbox") && configured !== rawEnv) {
          console.error("[webhook] environment mismatch with deployment", { rawEnv, configured });
          return new Response("Webhook environment rejected", { status: 400 });
        }

        try {
          const result = await processEvent(rawEnv, request);
          if (typeof result.body === "string") {
            return new Response(result.body, { status: result.status });
          }
          return Response.json(result.body, { status: result.status });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (isSignatureFailure(message)) {
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

