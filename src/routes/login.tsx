import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { makeLoginSchema } from "@/lib/auth/schemas";
import { localizeAuthError } from "@/lib/auth/messages";

const REMEMBER_KEY = "app.rememberEmail";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "ログイン — Eigo Michi" },
      { name: "description", content: "アカウントにログイン。" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(() => makeLoginSchema(t), [t]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember_email: false },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      form.setValue("email", saved);
      form.setValue("remember_email", true);
    }
  }, [form]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error(localizeAuthError(error, t));
        return;
      }
      if (typeof window !== "undefined") {
        if (values.remember_email) {
          window.localStorage.setItem(REMEMBER_KEY, values.email);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      let target = redirect || "/student/dashboard";
      if (userId) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const roleSet = new Set((roles ?? []).map((r) => r.role));
        if (roleSet.has("admin")) target = redirect || "/admin";
        else if (roleSet.has("student")) target = redirect || "/student/dashboard";
        else target = redirect || "/pricing";
      }
      toast.success(t("auth.messages.loginSuccess"));
      await navigate({ to: target, replace: true });
    } catch (err) {
      toast.error(localizeAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
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
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-[color:var(--brand)] hover:underline"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-[color:var(--urgent)]">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={form.watch("remember_email")}
            onCheckedChange={(v) =>
              form.setValue("remember_email", v === true, { shouldDirty: true })
            }
          />
          {t("auth.rememberEmail")}
        </label>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? t("common.loading") : t("auth.loginTitle")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link
            to="/register"
            className="font-medium text-[color:var(--brand)] hover:underline"
          >
            {t("nav.register")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
