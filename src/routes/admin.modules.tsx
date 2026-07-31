import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listAdminCourses } from "@/lib/admin/courses.admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/modules")({
  component: AdminModulesPage,
});

type CourseRow = {
  id: string;
  slug: string;
  title_ja: string;
  title_en: string;
  status: "draft" | "published" | "archived";
  modules?: { count: number }[] | { count: number } | null;
};

function moduleCount(c: CourseRow): number {
  const m = c.modules;
  if (!m) return 0;
  if (Array.isArray(m)) return m[0]?.count ?? 0;
  return m.count ?? 0;
}

function AdminModulesPage() {
  const { t, i18n } = useTranslation();
  const fetchCourses = useServerFn(listAdminCourses);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: () => fetchCourses(),
  });

  const courses = (data ?? []) as unknown as CourseRow[];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.modules")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.modules_.browseSubtitle")}</p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("admin.modules_.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => {
            const title = i18n.language === "en" ? c.title_en : c.title_ja;
            const count = moduleCount(c);
            return (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-medium">{title}</h2>
                      <Badge
                        variant={
                          c.status === "published"
                            ? "default"
                            : c.status === "archived"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {t(`admin.status.${c.status}`)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{c.slug}</span>
                      <span>·</span>
                      <span>{t("admin.modules_.moduleCount", { count })}</span>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      to="/admin/courses/$courseId"
                      params={{ courseId: c.id }}
                      search={{ tab: "curriculum" }}
                    >
                      {t("admin.modules_.editCurriculum")}
                      <ChevronRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
