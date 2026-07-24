import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/commercial")({
  head: () => ({
    meta: [
      { title: "特定商取引法に基づく表記 — Eigo Michi" },
      { name: "description", content: "特定商取引法に基づく表記。" },
    ],
  }),
  component: CommercialPage,
});

function CommercialPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-3xl px-4">
        <Placeholder title={t("legal.commercial")} description={t("placeholder.note")} />
      </div>
    </PublicLayout>
  );
}
