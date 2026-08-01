/**
 * Pure webhook delivery policy — no Stripe, no Supabase, no I/O.
 *
 * Keeping the HTTP contract here makes it testable and guarantees the webhook
 * route never silently swallows an event that still needs to be processed.
 */

export type ClaimAction = "claimed" | "already_processed" | "locked";

export type WebhookDecision =
  | { kind: "process" }
  | { kind: "respond"; status: number; body: Record<string, unknown> };

/**
 * Map an event claim to the HTTP response Stripe should see.
 *
 * - `claimed`           -> we own the event, run the handlers.
 * - `already_processed` -> terminal success, acknowledge with 200 (no retry).
 * - `locked`            -> another delivery is mid-flight. We must NOT return
 *   200: if that worker dies the event would be lost forever. 409 makes Stripe
 *   redeliver, and the claim lock expires so the retry can take over.
 */
export function decideFromClaim(action: ClaimAction): WebhookDecision {
  switch (action) {
    case "claimed":
      return { kind: "process" };
    case "already_processed":
      return { kind: "respond", status: 200, body: { received: true, claim: action } };
    case "locked":
      return { kind: "respond", status: 409, body: { received: false, claim: action } };
  }
}

/**
 * A failed handler run must only be acknowledged when retrying cannot change
 * the outcome (validation errors). Everything else has to bubble up as 5xx so
 * Stripe retries the delivery.
 */
export function decideFromFailure(permanent: boolean): WebhookDecision {
  return permanent
    ? { kind: "respond", status: 200, body: { received: true, rejected: true } }
    : { kind: "respond", status: 500, body: { received: false, retry: true } };
}

/** Signature / payload problems are permanent: never ask Stripe to retry. */
export function isSignatureFailure(message: string): boolean {
  return /signature|timestamp|Missing signature|Invalid webhook payload/i.test(message);
}
