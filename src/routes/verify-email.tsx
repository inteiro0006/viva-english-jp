import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { MailCheck, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { localizeAuthError } from "@/lib/auth/messages";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "メール確認 — Eigo Michi" }
      { name: "robots", content: "noindex, nofollow" },],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { email } = Route.useSearch();
  const [confirmed, setConfirmed] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // If Supabase redirected here after clicking the confirmation link, the
    // client hydrates a session from the URL hash. React to that.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setConfirmed(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) setConfirmed(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/verify-email`
          : undefined;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
      if (error) {
        toast.error(localizeAuthError(error, t));
        return;
      }
      toast.success(t("auth.messages.resent"));
    } finally {
      setResending(false);
    }
  }

  if (confirmed) {
    return (
      <AuthShell title={t("auth.verify.doneTitle")}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
            <CheckCircle2 className="size-5 text-[color:var(--brand)]" aria-hidden />
            <span>{t("auth.verify.doneBody")}</span>
          </div>
          <Button
            onClick={() => void navigate({ to: "/student/dashboard", replace: true })}
          >
            {t("common.continue")}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.verify.title")} subtitle={t("auth.verify.subtitle")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
          <MailCheck className="mt-0.5 size-5 text-[color:var(--brand)]" aria-hidden />
          <div>
            <p className="font-medium">{t("auth.verify.checkInbox")}</p>
            {email ? (
              <p className="mt-1 text-muted-foreground">{email}</p>
            ) : null}
            <p className="mt-2 text-muted-foreground">
              {t("auth.verify.instructions")}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={!email || resending}
          >
            {resending ? t("common.loading") : t("auth.verify.resend")}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/login">{t("nav.login")}</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
