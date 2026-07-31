import type { AuthError } from "@supabase/supabase-js";
import type { TFunction } from "i18next";

/**
 * Translate a Supabase auth error into a safe, localized message.
 * Never surface raw Supabase internals to the user.
 */
export function localizeAuthError(error: unknown, t: TFunction): string {
  const anyErr = error as AuthError | { message?: string; code?: string } | null;
  const code = (anyErr as { code?: string } | null)?.code ?? "";
  const msg = (anyErr as { message?: string } | null)?.message ?? "";
  const s = `${code} ${msg}`.toLowerCase();

  if (s.includes("invalid login") || s.includes("invalid_credentials"))
    return t("auth.errors.invalidCredentials");
  if (s.includes("email not confirmed") || s.includes("email_not_confirmed"))
    return t("auth.errors.emailNotConfirmed");
  if (
    s.includes("already registered") ||
    s.includes("user_already_exists") ||
    s.includes("already been registered")
  )
    return t("auth.errors.emailTaken");
  if (
    s.includes("rate limit") ||
    s.includes("over_email_send_rate_limit") ||
    s.includes("too many")
  )
    return t("auth.errors.rateLimited");
  if (s.includes("weak_password") || (s.includes("password") && s.includes("pwned")))
    return t("auth.errors.weakPassword");
  if (s.includes("network") || s.includes("fetch")) return t("auth.errors.network");
  if (s.includes("expired") || s.includes("invalid token") || s.includes("otp"))
    return t("auth.errors.linkExpired");
  return t("auth.errors.generic");
}
