import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { makeForgotSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/auth/messages";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "パスワード再設定 — Eigo Michi" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const schema = useMemo(() => makeForgotSchema(), []);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo,
      });
      if (error) {
        // Do not reveal whether the email exists.
        toast.error(localizeAuthError(error, t));
      }
      setSent(true);
    } catch (err) {
      toast.error(localizeAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
            {t("auth.messages.resetSent")}
          </p>
          <Button asChild variant="outline">
            <Link to="/login">{t("nav.login")}</Link>
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
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
          <Button type="submit" disabled={submitting}>
            {submitting ? t("common.loading") : t("auth.submit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-[color:var(--brand)] hover:underline">
              {t("common.backHome")}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
