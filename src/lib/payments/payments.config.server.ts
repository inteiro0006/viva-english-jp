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

/** Expected settlement currency. Anything else is a configuration error. */
export const COURSE_CURRENCY = "jpy";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Resolve the Stripe environment from server configuration ONLY.
 *
 * In production `PAYMENTS_ENVIRONMENT` is mandatory: we never infer `live`
 * just because a live credential happens to exist, and there is no silent
 * fallback. In development an explicit value still wins, otherwise we fall
 * back to `sandbox` (never `live`).
 */
export function resolvePaymentEnvironment(): PaymentEnvironment {
  const explicit = process.env.PAYMENTS_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "live" || explicit === "sandbox") return explicit;
  if (isProduction()) {
    throw new Error("PAYMENTS_ENVIRONMENT is required in production");
  }
  if (process.env.STRIPE_SANDBOX_API_KEY) return "sandbox";
  throw new Error("Stripe is not configured");
}

/**
 * The publishable token shipped to the browser must belong to the same Stripe
 * environment the server charges in, otherwise the embedded checkout would
 * mount against the wrong account.
 */
export function clientTokenEnvironment(
  token = process.env.VITE_PAYMENTS_CLIENT_TOKEN,
): PaymentEnvironment | null {
  const value = token?.trim();
  if (!value) return null;
  if (value.startsWith("pk_test_")) return "sandbox";
  if (value.startsWith("pk_live_")) return "live";
  return null;
}

/** Throws when the publishable token contradicts the server environment. */
export function assertClientTokenMatches(environment: PaymentEnvironment): void {
  const tokenEnv = clientTokenEnvironment();
  // Not visible to the server in every deployment shape — only enforce a
  // mismatch we can actually observe.
  if (tokenEnv === null) return;
  if (tokenEnv !== environment) {
    throw new Error("payments_environment_mismatch");
  }
}

function normalizeOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash || url.username || url.password) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return null;
  }
  return url.origin;
}

/** Canonical origin for checkout return URLs. `SITE_URL` wins when configured. */
export function getAllowedOrigin(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    const origin = normalizeOrigin(configured);
    if (!origin) throw new Error("SITE_URL is invalid");
    if (isProduction() && !origin.startsWith("https:")) {
      throw new Error("SITE_URL must be https in production");
    }
    return origin;
  }
  if (!isProduction()) return "http://localhost:8080";
  return CANONICAL_SITE_URL;
}

/**
 * Explicit allow-list of origins this deployment may return to.
 * `CHECKOUT_ALLOWED_ORIGINS` is a comma-separated list of exact origins —
 * there is no wildcard, so `*.lovable.app` is no longer blanket-trusted.
 */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([getAllowedOrigin()]);
  for (const raw of (process.env.CHECKOUT_ALLOWED_ORIGINS ?? "").split(",")) {
    const origin = normalizeOrigin(raw);
    if (origin) origins.add(origin);
  }
  if (!isProduction()) {
    origins.add("http://localhost:8080");
    origins.add("http://localhost:3000");
  }
  return [...origins];
}

/**
 * A caller-supplied origin is only honoured when it exactly matches one of the
 * configured origins. Protocol-relative values, backslashes, control
 * characters, credentials and paths are all rejected by `normalizeOrigin`.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (typeof origin !== "string" || origin.length === 0 || origin.length > 255) return false;
  if (/[\s\\\u0000-\u001f\u007f]/.test(origin)) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (normalized !== origin.replace(/\/$/, "")) {
    // Only an exact origin string is accepted (no trailing path).
    if (normalized !== origin) return false;
  }
  return getAllowedOrigins().includes(normalized);
}

/**
 * The browser can only *hint* at an origin; the success path itself is always
 * built by the server.
 */
export function getCheckoutReturnUrl(origin?: string): string {
  const base = origin && isAllowedOrigin(origin) ? normalizeOrigin(origin)! : getAllowedOrigin();
  return `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
}

/** Only internal paths are ever accepted as a post-auth redirect target. */
export function safePath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  if (/^\/\\|[\r\n\t]/.test(input)) return fallback;
  return input;
}
