import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "プライバシーポリシー — Eigo Michi" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Placeholder title={t("legal.privacyTitle")} />
      </div>
    </PublicLayout>
  );
}
