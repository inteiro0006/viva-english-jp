import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/success")({
  head: () => ({ meta: [{ title: "お支払い完了 — Eigo Michi" }] }),
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CheckCircle2 className="size-14 text-[color:var(--brand)]" aria-hidden />
        <h1 className="text-3xl font-bold">{t("payment.successTitle")}</h1>
        <p className="text-muted-foreground">{t("payment.successBody")}</p>
        <Button asChild size="lg" className="mt-4">
          <Link to="/student/dashboard">{t("nav.dashboard")}</Link>
        </Button>
      </section>
    </PublicLayout>
  );
}
