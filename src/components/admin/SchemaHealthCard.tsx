import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Stethoscope } from "lucide-react";
import { getSchemaHealth, type HealthCheck } from "@/lib/admin/health.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES = {
  ok: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  error: { icon: ShieldAlert, className: "text-destructive" },
} as const;

export function SchemaHealthCard() {
  const { t } = useTranslation();
  const fetchHealth = useServerFn(getSchemaHealth);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin", "schema-health"],
    queryFn: () => fetchHealth(),
    staleTime: 60_000,
  });

  const problems = (data?.checks ?? []).filter((c) => c.status !== "ok");
  const visible: HealthCheck[] = showAll ? (data?.checks ?? []) : problems;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4" aria-hidden />
            {t("admin.health.title", "バックエンドの状態 / Backend health")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(
              "admin.health.subtitle",
              "Checks that every table, field and link the app expects still exists.",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t("admin.health.recheck", "Re-run check")}
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
          <span className="ml-2">{t("admin.health.recheck", "Re-run check")}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {t(
              "admin.health.unavailable",
              "The health check could not run. The backend may be unreachable right now.",
            )}
          </p>
        ) : data ? (
          <>
            <div
              className={`rounded-md border p-3 text-sm ${
                data.status === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : data.status === "warn"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-destructive/40 bg-destructive/10"
              }`}
              role={data.status === "error" ? "alert" : undefined}
            >
              <p className="font-medium">
                {data.status === "ok"
                  ? t("admin.health.allGood", "Everything matches — no missing tables or links.")
                  : data.status === "warn"
                    ? t("admin.health.someWarnings", "Mostly healthy, but a few items need review.")
                    : t(
                        "admin.health.hasErrors",
                        "Parts of the database the app depends on are missing. Some screens will fail until this is fixed.",
                      )}
              </p>
              <p className="mt-1 text-muted-foreground">
                {data.okCount} OK · {data.warnCount} warnings · {data.errorCount} errors ·{" "}
                {new Date(data.checkedAt).toLocaleTimeString()}
              </p>
            </div>

            {visible.length > 0 && (
              <ul className="space-y-2">
                {visible.map((c) => {
                  const S = STATUS_STYLES[c.status];
                  return (
                    <li key={c.id} className="flex items-start gap-3 text-sm">
                      <S.icon className={`mt-0.5 size-4 shrink-0 ${S.className}`} aria-hidden />
                      <div className="min-w-0">
                        <span className="font-medium">{c.label}</span>
                        <p className="text-muted-foreground">{c.message}</p>
                        {c.detail && (
                          <p className="mt-0.5 break-words font-mono text-xs text-muted-foreground/70">
                            {c.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? t("admin.health.showProblems", "Show only problems")
                : t("admin.health.showAll", "Show all checks")}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
