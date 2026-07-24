import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "利用規約 — Eigo Michi" }] }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Placeholder title={t("legal.termsTitle")} />
      </div>
    </PublicLayout>
  );
}
