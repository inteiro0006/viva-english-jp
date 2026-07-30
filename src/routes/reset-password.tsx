import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { makeResetSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/auth/messages";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "新しいパスワード — Eigo Michi" },
      { name: "robots", content: "noindex, nofollow" },],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState<"checking" | "valid" | "invalid">(
    "checking",
  );
  const [done, setDone] = useState(false);

  // Supabase sends recovery link with tokens in the URL hash. The
  // supabase-js client hydrates the session automatically on load; we
  // just wait for the "PASSWORD_RECOVERY" event or an existing session.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(data.session ? "valid" : "invalid");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady("valid");
    });
    // Give the client a moment to parse the URL fragment.
    const t = setTimeout(() => {
      if (!active) return;
      setReady((r) => (r === "checking" ? "invalid" : r));
    }, 2000);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const schema = useMemo(() => makeResetSchema(t), [t]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm_password: "" },
  });
  const password = form.watch("password");

  async function onSubmit(values: z.infer<typeof schema>) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) {
        toast.error(localizeAuthError(error, t));
        return;
      }
      await supabase.auth.signOut();
      setDone(true);
      toast.success(t("auth.messages.resetSuccess"));
      setTimeout(() => {
        void navigate({ to: "/login", replace: true });
      }, 1200);
    } catch (err) {
      toast.error(localizeAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.newPassword")}
      subtitle={t("auth.resetSubtitle")}
    >
      {ready === "checking" ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : ready === "invalid" ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
            {t("auth.errors.linkExpired")}
          </p>
          <Button asChild>
            <Link to="/forgot-password">{t("auth.resetTitle")}</Link>
          </Button>
        </div>
      ) : done ? (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          {t("auth.messages.resetSuccess")}
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="password">{t("auth.newPassword")}</Label>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? t("common.loading") : t("auth.submit")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
