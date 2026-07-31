/**
 * Central site + pricing configuration.
 *
 * IMPORTANT: The Stripe price (lookup_key `eigo_academy_onetime`) is the source
 * of truth for actual charges. `COURSE_PRICE_JPY` is a display-only fallback
 * for marketing pages and must match the Stripe price.
 */

/** Canonical public origin used for SEO metadata, sitemap and JSON-LD. */
export const SITE_URL = "https://viva-english-jp.lovable.app";

export const COURSE_PRICE_JPY: number | null = 49800;
export const COURSE_CURRENCY = "JPY" as const;

/** Default price pre-filled when an admin creates a new course. */
export const DEFAULT_COURSE_PRICE_JPY = COURSE_PRICE_JPY ?? 0;

export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatJpy(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}
