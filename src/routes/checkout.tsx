import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "お支払い — Eigo Michi" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Placeholder
          title={t("checkout.title")}
          description={t("checkout.subtitle")}
        />
      </div>
    </PublicLayout>
  );
}
