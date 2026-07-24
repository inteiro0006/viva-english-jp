import { z } from "zod";
import type { TFunction } from "i18next";

export const PASSWORD_MIN = 8;

/** Password rule checks (used by UI hints and refined validators). */
export function passwordChecks(value: string) {
  return {
    length: value.length >= PASSWORD_MIN,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /\d/.test(value),
  };
}

export function isStrongPassword(value: string): boolean {
  const c = passwordChecks(value);
  return c.length && c.lower && c.upper && c.digit;
}

export const passwordField = () =>
  z
    .string()
    .min(PASSWORD_MIN)
    .refine(isStrongPassword);

export const emailField = () => z.string().trim().email().max(255);

export function makeRegisterSchema(t: TFunction) {
  return z
    .object({
      full_name: z
        .string()
        .trim()
        .min(1, t("auth.errors.nameRequired"))
        .max(120, t("auth.errors.nameTooLong")),
      email: emailField().transform((v) => v.toLowerCase()),
      password: passwordField(),
      confirm_password: z.string(),
      accept_terms: z.literal(true, {
        errorMap: () => ({ message: t("auth.errors.termsRequired") }),
      }),
      marketing_consent: z.boolean(),
      preferred_language: z.enum(["ja", "en"]),
    })
    .refine((v) => v.password === v.confirm_password, {
      message: t("auth.errors.passwordMismatch"),
      path: ["confirm_password"],
    });
}

export function makeLoginSchema(t: TFunction) {
  return z.object({
    email: emailField().transform((v) => v.toLowerCase()),
    password: z.string().min(1, t("auth.errors.passwordRequired")),
    remember_email: z.boolean(),
  });
}

export function makeForgotSchema() {
  return z.object({ email: emailField().transform((v) => v.toLowerCase()) });
}

export function makeResetSchema(t: TFunction) {
  return z
    .object({
      password: passwordField(),
      confirm_password: z.string(),
    })
    .refine((v) => v.password === v.confirm_password, {
      message: t("auth.errors.passwordMismatch"),
      path: ["confirm_password"],
    });
}
