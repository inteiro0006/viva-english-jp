/**
 * Pure payment domain rules — no Stripe, no Supabase, no I/O.
 *
 * Kept side-effect free so it can be unit tested and reused by both the
 * webhook and the admin reconciliation path.
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "canceled";

/** Allowed order state transitions. Everything else is rejected. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "failed", "canceled"],
  // `failed -> paid` is only reachable with a *current* Stripe confirmation,
  // which the caller must prove before asking for the transition.
  failed: ["paid", "canceled"],
  paid: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
  canceled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid_order_transition:${from}->${to}`);
  }
}

/** Terminal financial states that a replayed old event must never re-open. */
export function isTerminalRefundState(status: OrderStatus): boolean {
  return status === "refunded" || status === "partially_refunded";
}

export type FinancialSnapshot = {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
};

export type FinancialExpectation = {
  expectedSubtotal: number;
  expectedCurrency: string;
  expectedPriceId?: string | null;
  expectedProductId?: string | null;
};

export type FinancialValidation =
  | { ok: true }
  | { ok: false; reason: string; detail?: Record<string, unknown> };

/**
 * Validate what Stripe actually charged against what the order expected.
 *
 * The comparison is done on the SUBTOTAL: with exclusive tax the total is
 * legitimately larger than the price, and that must never block fulfillment.
 */
export function validateFinancials(
  snapshot: FinancialSnapshot,
  expectation: FinancialExpectation,
  actual: { priceId?: string | null; productId?: string | null } = {},
): FinancialValidation {
  if (snapshot.currency.toLowerCase() !== expectation.expectedCurrency.toLowerCase()) {
    return {
      ok: false,
      reason: "currency_mismatch",
      detail: { expected: expectation.expectedCurrency, got: snapshot.currency },
    };
  }
  if (snapshot.subtotal !== expectation.expectedSubtotal) {
    return {
      ok: false,
      reason: "subtotal_mismatch",
      detail: { expected: expectation.expectedSubtotal, got: snapshot.subtotal },
    };
  }
  if (snapshot.tax < 0 || snapshot.discount < 0 || snapshot.total <= 0) {
    return { ok: false, reason: "invalid_amounts" };
  }
  if (
    expectation.expectedPriceId &&
    actual.priceId &&
    expectation.expectedPriceId !== actual.priceId
  ) {
    return { ok: false, reason: "price_mismatch" };
  }
  if (
    expectation.expectedProductId &&
    actual.productId &&
    expectation.expectedProductId !== actual.productId
  ) {
    return { ok: false, reason: "product_mismatch" };
  }
  return { ok: true };
}

/** Remaining refundable balance for an order. */
export function refundableBalance(charged: number, alreadyRefunded: number): number {
  return Math.max(0, charged - Math.max(0, alreadyRefunded));
}

export function assertRefundAmount(
  requested: number,
  charged: number,
  alreadyRefunded: number,
): void {
  if (!Number.isInteger(requested) || requested <= 0) throw new Error("invalid_refund_amount");
  if (requested > refundableBalance(charged, alreadyRefunded)) {
    throw new Error("refund_exceeds_balance");
  }
}

/**
 * A refund is only "full" when the accumulated refunded amount reaches the
 * charged total. `amount_refunded === 0` is NOT a full refund.
 */
export function isFullyRefunded(charged: number, refundedTotal: number): boolean {
  return charged > 0 && refundedTotal >= charged;
}

export function refundOutcomeStatus(
  charged: number,
  refundedTotal: number,
  current: OrderStatus,
): OrderStatus {
  if (isFullyRefunded(charged, refundedTotal)) return "refunded";
  if (refundedTotal > 0) return "partially_refunded";
  return current;
}

/** Stable idempotency key for a refund request. */
export function refundIdempotencyKey(orderId: string, requestId: string): string {
  return `refund:${orderId}:${requestId}`;
}

/** Stable idempotency key for a checkout session, keyed on the pending order. */
/**
 * Stripe caches the response for an idempotency key for 24h — including 4xx
 * errors. Bump CHECKOUT_CONFIG_VERSION whenever the session payload changes so
 * a fixed configuration is not shadowed by a cached failure.
 */
export const CHECKOUT_CONFIG_VERSION = "v2";

export function checkoutIdempotencyKey(orderId: string, attemptKey: string): string {
  return `checkout:${CHECKOUT_CONFIG_VERSION}:${orderId}:${attemptKey}`;
}
