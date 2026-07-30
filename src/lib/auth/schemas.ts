import { z } from "zod";
import type { TFunction } from "i18next";

export const PASSWORD_MIN = 6;

export const passwordField = () => z.string().min(PASSWORD_MIN);

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
