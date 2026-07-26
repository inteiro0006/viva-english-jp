import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/cancel")({
  head: () => ({ meta: [{ title: "お支払いキャンセル — Eigo Michi" }
      { name: "robots", content: "noindex, nofollow" },] }),
  component: PaymentCancelPage,
});

function PaymentCancelPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <XCircle className="size-14 text-[color:var(--urgent)]" aria-hidden />
        <h1 className="text-3xl font-bold">{t("payment.cancelTitle")}</h1>
        <p className="text-muted-foreground">{t("payment.cancelBody")}</p>
        <Button asChild size="lg" variant="outline" className="mt-4">
          <Link to="/pricing">{t("pricing.cta")}</Link>
        </Button>
      </section>
    </PublicLayout>
  );
}
