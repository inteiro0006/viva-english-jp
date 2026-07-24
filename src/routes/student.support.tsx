import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/student/support")({
  component: () => {
    const { t } = useTranslation();
    return <Placeholder title={t("student.supportTitle")} />;
  },
});
