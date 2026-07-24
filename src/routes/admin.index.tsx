import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { t } = useTranslation();
  const stats = [
    { label: t("admin.students"), value: "—" },
    { label: t("admin.orders"), value: "—" },
    { label: t("admin.courses"), value: "—" },
    { label: t("admin.lessons"), value: "—" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("admin.overview")}</h1>
        <p className="text-sm text-muted-foreground">{t("placeholder.note")}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-5">
              <p className="text-xs uppercase text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
