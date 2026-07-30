import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "サインイン中 — Eigo Michi" },
      { name: "description", content: "サインイン処理を完了しています。" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthCallbackPage,
});

const REDIRECT_KEY = "app.postLoginRedirect";

function safePath(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;

    async function resolveTarget() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const roleSet = new Set((roles ?? []).map((r) => r.role));
      const saved = safePath(window.sessionStorage.getItem(REDIRECT_KEY));
      window.sessionStorage.removeItem(REDIRECT_KEY);
      if (saved) return saved;
      if (roleSet.has("admin")) return "/admin";
      if (roleSet.has("student")) return "/student/dashboard";
      return "/pricing";
    }

    async function go() {
      const target = await resolveTarget();
      if (!active) return;
      await navigate({ to: target ?? "/login", replace: true });
    }

    // The session may still be hydrating right after the OAuth redirect.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void go();
    });
    void go();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-[color:var(--brand)]" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    </div>
  );
}
