import { describe, expect, it } from "vitest";
import {
  decideFromClaim,
  decideFromFailure,
  isSignatureFailure,
} from "@/lib/payments/webhook-policy";
import { refundIdempotencyKey } from "@/lib/payments/order-state";

describe("webhook claim policy", () => {
  it("processes a freshly claimed event", () => {
    expect(decideFromClaim("claimed")).toEqual({ kind: "process" });
  });

  it("acknowledges an already terminal event without retrying", () => {
    const decision = decideFromClaim("already_processed");
    expect(decision).toMatchObject({ kind: "respond", status: 200 });
  });

  it("asks Stripe to retry when another delivery holds the lock", () => {
    // Returning 200 here would lose the event if the lock holder crashed.
    const decision = decideFromClaim("locked");
    expect(decision).toMatchObject({ kind: "respond", status: 409 });
  });
});

describe("webhook failure policy", () => {
  it("acknowledges permanent validation failures", () => {
    expect(decideFromFailure(true)).toMatchObject({ status: 200 });
  });

  it("returns 5xx for transient failures so Stripe retries", () => {
    expect(decideFromFailure(false)).toMatchObject({ status: 500 });
  });

  it("treats signature and payload problems as permanent", () => {
    for (const message of [
      "Invalid webhook signature",
      "Webhook timestamp too old",
      "Missing signature or body",
      "Invalid webhook payload",
    ]) {
      expect(isSignatureFailure(message)).toBe(true);
    }
    expect(isSignatureFailure("fetch failed")).toBe(false);
  });
});

describe("refund idempotency is per request, not per amount", () => {
  it("gives two separate requests distinct keys even for the same amount", () => {
    const a = refundIdempotencyKey("order-1", "req-1");
    const b = refundIdempotencyKey("order-1", "req-2");
    expect(a).not.toBe(b);
  });

  it("is stable for a retried request", () => {
    expect(refundIdempotencyKey("order-1", "req-1")).toBe(refundIdempotencyKey("order-1", "req-1"));
  });
});
