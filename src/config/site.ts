/**
 * Central configuration for pricing and commercial copy.
 * Values here are intentionally editable and consumed by the landing page
 * and future checkout flow. Do not hard-code prices elsewhere.
 */

/** Course price in Japanese Yen. Set to `null` until finalized. */
export const COURSE_PRICE_JPY: number | null = null;

/** ISO currency code for display. */
export const COURSE_CURRENCY = "JPY" as const;

/**
 * Format a JPY price for display, e.g. "¥49,800".
 * Returns null when no price is configured.
 */
export function formatJpy(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}
