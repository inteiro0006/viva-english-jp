import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { getCheckoutOrderStatus } from "@/lib/payments/checkout.functions";

export const Route = createFileRoute("/payment/success")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "お支払い完了 — Eigo Academy" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaymentSuccessPage,
});

type Status = "loading" | "paid" | "pending" | "error";

function PaymentSuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session_id: sessionId } = Route.useSearch();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // ~24s

    const poll = async () => {
      try {
        const order = await getCheckoutOrderStatus({ data: { sessionId } });
        if (cancelled) return;
        if (order?.status === "paid") {
          setStatus("paid");
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          setStatus("pending");
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <PublicLayout>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="size-12 animate-spin text-[color:var(--brand)]" aria-hidden />
            <h1 className="font-display text-2xl font-bold">
              {t("payment.confirmingTitle")}
            </h1>
            <p className="text-muted-foreground">{t("payment.confirmingBody")}</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="size-14 text-[color:var(--brand)]" aria-hidden />
            <h1 className="font-display text-3xl font-bold">
              {t("payment.successTitle")}
            </h1>
            <p className="text-muted-foreground">{t("payment.successBody")}</p>
            <Button
              size="lg"
              className="mt-4"
              onClick={() => navigate({ to: "/student/dashboard" })}
            >
              {t("nav.dashboard")}
            </Button>
          </>
        )}
        {status === "pending" && (
          <>
            <Loader2 className="size-12 text-[color:var(--highlight)]" aria-hidden />
            <h1 className="font-display text-2xl font-bold">
              {t("payment.pendingTitle")}
            </h1>
            <p className="text-muted-foreground">{t("payment.pendingBody")}</p>
            <Button asChild size="lg" variant="outline" className="mt-4">
              <Link to="/student/dashboard">{t("nav.dashboard")}</Link>
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <AlertTriangle className="size-12 text-[color:var(--urgent)]" aria-hidden />
            <h1 className="font-display text-2xl font-bold">
              {t("payment.errorTitle")}
            </h1>
            <p className="text-muted-foreground">{t("payment.errorBody")}</p>
            <Button asChild size="lg" className="mt-4">
              <Link to="/checkout">{t("checkout.retry")}</Link>
            </Button>
          </>
        )}
      </section>
    </PublicLayout>
  );
}
