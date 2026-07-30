import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { makeRegisterSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/auth/messages";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "新規登録 — Eigo Michi" },
      { name: "description", content: "アカウントを新規作成。" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(() => makeRegisterSchema(t), [t]);
  const currentLang: SupportedLanguage = i18n.language?.startsWith("ja")
    ? "ja"
    : "en";
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirm_password: "",
      accept_terms: false as unknown as true,
      marketing_consent: false,
      preferred_language: currentLang,
    },
    mode: "onBlur",
  });

  const password = form.watch("password");

  async function onSubmit(values: z.infer<typeof schema>) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/verify-email`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo,
          data: {
            full_name: values.full_name,
            preferred_language: values.preferred_language,
            marketing_consent: values.marketing_consent,
          },
        },
      });
      if (error) {
        toast.error(localizeAuthError(error, t));
        return;
      }
      // If Supabase returned identities: [] the email is already registered.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error(t("auth.errors.emailTaken"));
        return;
      }
      toast.success(t("auth.messages.registerSuccess"));
      await navigate({
        to: "/verify-email",
        search: { email: values.email },
        replace: true,
      });
    } catch (err) {
      toast.error(localizeAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <div className="grid gap-2">
          <Label htmlFor="full_name">{t("auth.name")}</Label>
          <Input
            id="full_name"
            autoComplete="name"
            aria-invalid={!!form.formState.errors.full_name}
            {...form.register("full_name")}
          />
          {form.formState.errors.full_name ? (
            <p className="text-xs text-[color:var(--urgent)]">
              {form.formState.errors.full_name.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!form.formState.errors.email}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-[color:var(--urgent)]">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register("password")}
          />
          <PasswordRequirements value={password ?? ""} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm_password">{t("auth.confirmPassword")}</Label>
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.confirm_password}
            {...form.register("confirm_password")}
          />
          {form.formState.errors.confirm_password ? (
            <p className="text-xs text-[color:var(--urgent)]">
              {form.formState.errors.confirm_password.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="preferred_language">{t("language.label")}</Label>
          <select
            id="preferred_language"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("preferred_language")}
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>
                {lng === "ja" ? "日本語" : "English"}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={form.watch("accept_terms") === true}
            onCheckedChange={(v) =>
              form.setValue("accept_terms", (v === true) as unknown as true, {
                shouldValidate: true,
              })
            }
            aria-invalid={!!form.formState.errors.accept_terms}
          />
          <span className="text-muted-foreground">
            {t("auth.acceptTerms.prefix")}{" "}
            <Link to="/terms" className="text-[color:var(--brand)] hover:underline">
              {t("footer.terms")}
            </Link>{" "}
            {t("auth.acceptTerms.and")}{" "}
            <Link to="/privacy" className="text-[color:var(--brand)] hover:underline">
              {t("footer.privacy")}
            </Link>
            {t("auth.acceptTerms.suffix")}
          </span>
        </label>
        {form.formState.errors.accept_terms ? (
          <p className="-mt-2 text-xs text-[color:var(--urgent)]">
            {form.formState.errors.accept_terms.message as string}
          </p>
        ) : null}

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={form.watch("marketing_consent") === true}
            onCheckedChange={(v) =>
              form.setValue("marketing_consent", v === true, {
                shouldDirty: true,
              })
            }
          />
          <span className="text-muted-foreground">
            {t("auth.marketingConsent")}
          </span>
        </label>

        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? t("common.loading") : t("auth.registerTitle")}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link
            to="/login"
            className="font-medium text-[color:var(--brand)] hover:underline"
          >
            {t("nav.login")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
