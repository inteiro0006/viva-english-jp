// SERVER-ONLY: Stripe price resolution and validation.
import type Stripe from "stripe";
import { COURSE_CURRENCY, COURSE_PRICE_LOOKUP_KEY } from "./payments.config.server";

export type ResolvedPrice = {
  priceId: string;
  productId: string;
  productName: string;
  unitAmount: number;
  currency: string;
};

export class PriceConfigError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "PriceConfigError";
  }
}

/**
 * Resolve the course price from Stripe by lookup key and enforce every
 * invariant the checkout depends on. The browser never supplies price data.
 */
export async function resolveCoursePrice(
  stripe: Stripe,
  lookupKey: string = COURSE_PRICE_LOOKUP_KEY,
): Promise<ResolvedPrice> {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    expand: ["data.product"],
    limit: 2,
  });
  const price = prices.data[0];
  if (!price) throw new PriceConfigError("price_unavailable");
  if (price.active !== true) throw new PriceConfigError("price_inactive");
  if (price.type !== "one_time") throw new PriceConfigError("price_not_one_time");
  if ((price.currency ?? "").toLowerCase() !== COURSE_CURRENCY) {
    throw new PriceConfigError("price_currency_mismatch");
  }
  if (!price.unit_amount || price.unit_amount <= 0) {
    throw new PriceConfigError("price_amount_invalid");
  }

  const product = price.product;
  const productId = typeof product === "string" ? product : product?.id;
  if (!productId) throw new PriceConfigError("product_unavailable");
  const productName =
    typeof product === "string" || !product || "deleted" in product
      ? "Eigo Academy"
      : (product.name ?? "Eigo Academy");
  if (typeof product !== "string" && product && "deleted" in product && product.deleted) {
    throw new PriceConfigError("product_deleted");
  }

  return {
    priceId: price.id,
    productId,
    productName,
    unitAmount: price.unit_amount,
    currency: price.currency.toLowerCase(),
  };
}
