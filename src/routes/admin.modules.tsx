import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/modules")({
  component: AdminModulesPage,
});

function AdminModulesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.modules")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.modules_.subtitle")}</p>
      </header>
      <Card>
        <CardContent className="space-y-2 py-8 text-center text-sm">
          <p>{t("admin.modules_.editViaCourse")}</p>
          <Link to="/admin/courses" className="text-primary underline">
            {t("admin.modules_.goToCourses")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
