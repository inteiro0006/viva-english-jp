import { describe, expect, it } from "vitest";
import {
  assertRefundAmount,
  canTransition,
  checkoutIdempotencyKey,
  isFullyRefunded,
  refundOutcomeStatus,
  refundableBalance,
  validateFinancials,
} from "@/lib/payments/order-state";

const jpy = (over: Partial<Parameters<typeof validateFinancials>[0]> = {}) => ({
  subtotal: 49800,
  tax: 0,
  discount: 0,
  total: 49800,
  currency: "jpy",
  ...over,
});

describe("order transitions", () => {
  it("allows only the documented moves", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("paid", "refunded")).toBe(true);
    expect(canTransition("refunded", "paid")).toBe(false);
    expect(canTransition("canceled", "paid")).toBe(false);
  });

  it("treats a repeated event as a no-op", () => {
    expect(canTransition("paid", "paid")).toBe(true);
  });
});

describe("validateFinancials", () => {
  it("accepts an exact match", () => {
    expect(
      validateFinancials(jpy(), { expectedSubtotal: 49800, expectedCurrency: "jpy" }),
    ).toEqual({ ok: true });
  });

  it("accepts exclusive tax on top of the price", () => {
    const result = validateFinancials(jpy({ tax: 4980, total: 54780 }), {
      expectedSubtotal: 49800,
      expectedCurrency: "JPY",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an underpaid subtotal", () => {
    const result = validateFinancials(jpy({ subtotal: 100, total: 100 }), {
      expectedSubtotal: 49800,
      expectedCurrency: "jpy",
    });
    expect(result).toMatchObject({ ok: false, reason: "subtotal_mismatch" });
  });

  it("rejects a currency swap", () => {
    const result = validateFinancials(jpy({ currency: "usd" }), {
      expectedSubtotal: 49800,
      expectedCurrency: "jpy",
    });
    expect(result).toMatchObject({ ok: false, reason: "currency_mismatch" });
  });

  it("rejects a different price or product", () => {
    expect(
      validateFinancials(
        jpy(),
        { expectedSubtotal: 49800, expectedCurrency: "jpy", expectedPriceId: "price_a" },
        { priceId: "price_b" },
      ),
    ).toMatchObject({ reason: "price_mismatch" });
    expect(
      validateFinancials(
        jpy(),
        { expectedSubtotal: 49800, expectedCurrency: "jpy", expectedProductId: "prod_a" },
        { productId: "prod_b" },
      ),
    ).toMatchObject({ reason: "product_mismatch" });
  });

  it("rejects non-positive totals", () => {
    expect(
      validateFinancials(jpy({ subtotal: 0, total: 0 }), {
        expectedSubtotal: 0,
        expectedCurrency: "jpy",
      }),
    ).toMatchObject({ reason: "invalid_amounts" });
  });
});

describe("refunds", () => {
  it("computes the remaining balance", () => {
    expect(refundableBalance(49800, 0)).toBe(49800);
    expect(refundableBalance(49800, 20000)).toBe(29800);
    expect(refundableBalance(49800, 60000)).toBe(0);
  });

  it("blocks over-refunding", () => {
    expect(() => assertRefundAmount(30000, 49800, 30000)).toThrow("refund_exceeds_balance");
    expect(() => assertRefundAmount(0, 49800, 0)).toThrow("invalid_refund_amount");
    expect(() => assertRefundAmount(19800, 49800, 30000)).not.toThrow();
  });

  it("only treats a covered charge as fully refunded", () => {
    expect(isFullyRefunded(49800, 0)).toBe(false);
    expect(isFullyRefunded(49800, 49800)).toBe(true);
  });

  it("maps refunded totals to order status", () => {
    expect(refundOutcomeStatus(49800, 0, "paid")).toBe("paid");
    expect(refundOutcomeStatus(49800, 10000, "paid")).toBe("partially_refunded");
    expect(refundOutcomeStatus(49800, 49800, "partially_refunded")).toBe("refunded");
  });
});

describe("idempotency keys", () => {
  it("is stable for the same order and attempt", () => {
    expect(checkoutIdempotencyKey("o1", "price_1")).toBe(
      checkoutIdempotencyKey("o1", "price_1"),
    );
    expect(checkoutIdempotencyKey("o1", "price_1")).not.toBe(
      checkoutIdempotencyKey("o2", "price_1"),
    );
  });
});
