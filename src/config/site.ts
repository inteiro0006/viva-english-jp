/**
 * Central pricing configuration.
 * IMPORTANT: The Stripe price (lookup_key `eigo_academy_onetime`) is the source
 * of truth for actual charges. This value is a display-only fallback for the
 * landing page and must match the Stripe price.
 */

export const COURSE_PRICE_JPY: number | null = 49800;
export const COURSE_CURRENCY = "JPY" as const;

export function formatJpy(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}
