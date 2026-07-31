/**
 * SERVER-ONLY payment configuration.
 *
 * Everything the checkout needs is resolved here from server configuration —
 * never from client input. Do not import this from client-reachable modules
 * at module scope.
 */

export type PaymentEnvironment = "sandbox" | "live";

/** Stripe price lookup key — single source of truth for the charged amount. */
export const COURSE_PRICE_LOOKUP_KEY = "eigo_academy_onetime";

/** Slug of the course sold by the public checkout. */
export const CHECKOUT_COURSE_SLUG = process.env.CHECKOUT_COURSE_SLUG || "eigo-mastery";

/**
 * Resolve the Stripe environment from server configuration only.
 * The client is never allowed to choose this.
 */
export function resolvePaymentEnvironment(): PaymentEnvironment {
  const explicit = process.env.PAYMENTS_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "live" || explicit === "sandbox") return explicit;
  // Fall back to whichever credential set is configured; prefer sandbox so an
  // incomplete configuration can never charge real money.
  if (process.env.STRIPE_SANDBOX_API_KEY) return "sandbox";
  if (process.env.STRIPE_LIVE_API_KEY) return "live";
  throw new Error("Stripe is not configured");
}

/**
 * Allowlisted origin for checkout return URLs. Never derived from the request
 * or from client input.
 */
export function getAllowedOrigin(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new Error("SITE_URL must be https");
    }
    return url.origin;
  }
  if (process.env.NODE_ENV !== "production") return "http://localhost:8080";
  throw new Error("SITE_URL is not configured");
}

export function getCheckoutReturnUrl(): string {
  return `${getAllowedOrigin()}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
}

/** Only internal paths are ever accepted as a post-auth redirect target. */
export function safePath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  if (/^\/\\|[\r\n\t]/.test(input)) return fallback;
  return input;
}
