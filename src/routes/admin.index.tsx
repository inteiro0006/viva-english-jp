import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  BookMarked,
  Receipt,
  JapaneseYen,
  Activity,
  Video,
  LifeBuoy,
} from "lucide-react";
import { getAdminDashboard } from "@/lib/admin/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const fetchStats = useServerFn(getAdminDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });

  const formatJpy = (n: number) =>
    new Intl.NumberFormat(i18n.language === "en" ? "en-US" : "ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(n);

  const kpis = [
    { label: t("admin.dash.students"), value: data?.totalStudents ?? 0, icon: Users },
    { label: t("admin.dash.enrollments"), value: data?.activeEnrollments ?? 0, icon: BookMarked },
    { label: t("admin.dash.paidOrders"), value: data?.paidOrders ?? 0, icon: Receipt },
    {
      label: t("admin.dash.revenue"),
      value: data ? formatJpy(data.revenueJpy) : "—",
      icon: JapaneseYen,
    },
    {
      label: t("admin.dash.avgCompletion"),
      value: data ? `${data.averageCompletion}%` : "—",
      icon: Activity,
    },
    { label: t("admin.dash.processingVideos"), value: data?.processingVideos ?? 0, icon: Video },
    { label: t("admin.dash.openSupport"), value: data?.openSupport ?? 0, icon: LifeBuoy },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.overview")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.dash.subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
              <k.icon className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{k.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.dash.topLessons")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : data && data.topLessons.length > 0 ? (
              <ul className="space-y-2">
                {data.topLessons.map((l, idx) => (
                  <li key={l.id} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="grid size-6 place-items-center rounded bg-muted font-mono text-xs">
                        {idx + 1}
                      </span>
                      <span className="truncate">
                        {i18n.language === "en" ? l.title_en : l.title_ja}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {l.watches} {t("admin.dash.views")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.dash.recentEnrollments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : data && data.recentEnrollments.length > 0 ? (
              <SparkList rows={data.recentEnrollments} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SparkList({ rows }: { rows: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.slice(-14).map((r) => (
        <li key={r.date} className="flex items-center gap-3 text-xs">
          <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{r.date}</span>
          <span className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
            <span
              className="absolute inset-y-0 left-0 bg-[color:var(--teal)]"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right font-medium tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
