/**
 * SERVER-ONLY payment configuration.
 *
 * Everything the checkout needs is resolved here from server configuration —
 * never from client input. Do not import this from client-reachable modules
 * at module scope.
 */

import { SITE_URL as CANONICAL_SITE_URL } from "@/config/site";

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
 * Canonical origin for checkout return URLs. `SITE_URL` wins when configured;
 * otherwise we fall back to the project's public origin. Never taken from
 * client input without passing `isAllowedOrigin()` first.
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
  return CANONICAL_SITE_URL;
}

/**
 * Preview/published deployments of this project may run on several hosts.
 * A caller-supplied origin is only honoured when it is one of them, so the
 * return URL can never be pointed at an attacker-controlled domain.
 */
export function isAllowedOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (origin !== url.origin) return false;
  if (url.origin === getAllowedOrigin()) return true;
  if (url.protocol === "http:" && url.hostname === "localhost") return true;
  return url.protocol === "https:" && /(^|\.)lovable\.app$/.test(url.hostname);
}

export function getCheckoutReturnUrl(origin?: string): string {
  const base = origin && isAllowedOrigin(origin) ? new URL(origin).origin : getAllowedOrigin();
  return `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
}

/** Only internal paths are ever accepted as a post-auth redirect target. */
export function safePath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  if (/^\/\\|[\r\n\t]/.test(input)) return fallback;
  return input;
}
