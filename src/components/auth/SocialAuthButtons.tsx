import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2H12Z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3 5.9 15l-2.5 2A9 9 0 0 0 12 21c2.4 0 4.5-.8 6-2.2l-3.2-2.5c-.8.6-1.9.9-2.8.9a4.9 4.9 0 0 1-4.6-3.3Z"
      />
      <path
        fill="#FBBC05"
        d="M3.4 7A9 9 0 0 0 3.4 17l3.2-2.5a5.4 5.4 0 0 1 0-3.4L3.4 7Z"
      />
      <path
        fill="#4285F4"
        d="M12 6.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6A9 9 0 0 0 3.4 7l3.2 2.5A4.9 4.9 0 0 1 12 6.6Z"
      />
    </svg>
  );
}

/**
 * Google / Apple sign-in. Works for both sign-up and sign-in flows.
 */
export function SocialAuthButtons({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);

  async function signIn(provider: "google" | "apple") {
    if (pending) return;
    setPending(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? t("auth.errors.generic"));
        return;
      }
      if (result.redirected) return;
      window.location.href = "/student/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.errors.generic"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("auth.orContinueWith")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 grid gap-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => signIn("google")}
        >
          <GoogleIcon />
          {t("auth.continueWithGoogle")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => signIn("apple")}
        >
          <Apple className="size-4" aria-hidden />
          {t("auth.continueWithApple")}
        </Button>
      </div>
    </div>
  );
}
