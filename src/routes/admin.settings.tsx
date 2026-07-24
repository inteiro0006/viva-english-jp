import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/admin/settings")({
  component: () => {
    const { t } = useTranslation();
    return <Placeholder title={t("admin.settings")} />;
  },
});
