import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitBranch, GitCommit, RefreshCw, Upload } from "lucide-react";
import { getRepositoryStatus, type RepoStatus } from "@/lib/admin/system.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/system")({
  component: AdminSystemPage,
});

function AdminSystemPage() {
  const { t, i18n } = useTranslation();
  const fetchStatus = useServerFn(getRepositoryStatus);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "system", "repo"],
    queryFn: () => fetchStatus() as Promise<RepoStatus>,
  });

  const fmt = (iso: string | null | undefined) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language === "ja" ? "ja-JP" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(iso))
      : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.system_.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.system_.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
          {t("admin.system_.refresh")}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.configured ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.system_.notConfigured")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{t("admin.system_.notConfiguredDesc")}</p>
            <ul className="list-disc pl-5">
              <li>
                <code>GITHUB_REPOSITORY</code> — {t("admin.system_.envRepo")}
              </li>
              <li>
                <code>GITHUB_TOKEN</code> — {t("admin.system_.envToken")}
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : data.error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{t("admin.system_.error")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{t("admin.system_.errorDesc")}</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{data.error}</pre>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="size-4" aria-hidden />
                {t("admin.system_.branch")}
              </CardTitle>
              {data.isPrivate !== null && (
                <Badge variant="outline">
                  {data.isPrivate ? t("admin.system_.private") : t("admin.system_.public")}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-mono text-lg">{data.branch ?? "—"}</p>
              {data.htmlUrl && (
                <a
                  href={data.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {data.repo}
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="size-4" aria-hidden />
                {t("admin.system_.lastPush")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg tabular-nums">{fmt(data.lastPushAt)}</p>
              <p className="text-xs text-muted-foreground">
                {t("admin.system_.checkedAt", { time: fmt(data.checkedAt) })}
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCommit className="size-4" aria-hidden />
                {t("admin.system_.lastCommit")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.lastCommit ? (
                <>
                  <p className="font-medium">{data.lastCommit.message || "—"}</p>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {data.lastCommit.shortSha}
                    </code>
                    <span>{data.lastCommit.author ?? "—"}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{fmt(data.lastCommit.committedAt)}</span>
                  </div>
                  {data.lastCommit.url && (
                    <a
                      href={data.lastCommit.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block underline underline-offset-4"
                    >
                      {t("admin.system_.viewOnGitHub")}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">{t("common.empty")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
