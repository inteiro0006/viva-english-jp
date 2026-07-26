import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PlayCircle,
  Lock,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  Sparkles,
  LifeBuoy,
  Mail,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth/use-session";
import {
  useDashboardData,
  type DashboardData,
} from "@/lib/lms/dashboard-data";
import {
  computeModuleViews,
  computeCourseProgress,
  type ModuleView,
} from "@/lib/lms/course-workspace";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({
    meta: [
      { title: "ダッシュボード — Eigo Michi" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

// ---------- helpers ----------

function pickLang<T extends Record<string, unknown>>(row: T, base: "title" | "description", lang: string): string {
  const key = lang.startsWith("ja") ? `${base}_ja` : `${base}_en`;
  const val = row[key];
  return typeof val === "string" ? val : "";
}

function greetingKey(): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

function formatMinutes(seconds: number, locale: string) {
  const min = Math.max(1, Math.round(seconds / 60));
  return new Intl.NumberFormat(locale).format(min);
}

function formatRelativeDate(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

// ---------- module lock computation ----------

type ModuleView = Omit<DashboardModule, "status"> & {
  lessons: DashboardLesson[];
  completedCount: number;
  totalCount: number;
  progressPct: number;
  status: "not_started" | "in_progress" | "completed" | "locked" | "coming_soon";
  lockReason: "date" | "sequence" | null;
};

function computeModuleViews(
  modules: DashboardModule[],
  lessons: DashboardLesson[],
  progress: DashboardProgressRow[],
): ModuleView[] {
  const now = new Date();
  const progressByLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  const views: ModuleView[] = [];
  let previousCompleted = true; // first module has no predecessor

  for (const m of modules) {
    const modLessons = lessons.filter((l) => l.module_id === m.id);
    const completed = modLessons.filter(
      (l) => progressByLesson.get(l.id)?.completed,
    ).length;
    const total = modLessons.length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    let status: ModuleView["status"] = "not_started";
    let lockReason: ModuleView["lockReason"] = null;

    if (m.release_type === "date" && m.release_at && new Date(m.release_at) > now) {
      status = "coming_soon";
      lockReason = "date";
    } else if (m.release_type === "after_previous" && !previousCompleted) {
      status = "locked";
      lockReason = "sequence";
    } else if (total > 0 && completed === total) {
      status = "completed";
    } else if (completed > 0) {
      status = "in_progress";
    }

    views.push({
      ...m,
      lessons: modLessons,
      completedCount: completed,
      totalCount: total,
      progressPct: pct,
      status,
      lockReason,
    });

    previousCompleted = total > 0 && completed === total;
  }
  return views;
}

// ---------- page ----------

function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const query = useDashboardData(user?.id);

  if (sessionLoading || query.isLoading) return <DashboardSkeleton />;
  if (query.isError) return <DashboardError onRetry={() => query.refetch()} />;
  if (!query.data) return <DashboardSkeleton />;

  if (query.data.state === "no_enrollment") return <NoEnrollmentState data={query.data} />;
  return <EnrolledDashboard data={query.data} />;
}

// ---------- enrolled ----------

function EnrolledDashboard({ data }: { data: Extract<DashboardData, { state: "enrolled" }> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [activeStageId, setActiveStageId] = useState<string | "all">(() => data.stages[0]?.id ?? "all");

  const moduleViews = useMemo(
    () => computeModuleViews(data.modules, data.lessons, data.progress),
    [data.modules, data.lessons, data.progress],
  );

  const totalLessons = data.lessons.length;
  const completedLessons = data.progress.filter((p) => p.completed).length;
  const overallPct =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  const progressByLesson = useMemo(
    () => new Map(data.progress.map((p) => [p.lesson_id, p])),
    [data.progress],
  );

  // Find continue-lesson: most recently watched incomplete lesson.
  const continueLesson = useMemo(() => {
    const accessibleModuleIds = new Set(
      moduleViews
        .filter((m) => m.status !== "locked" && m.status !== "coming_soon")
        .map((m) => m.id),
    );
    const accessibleLessons = data.lessons.filter((l) => accessibleModuleIds.has(l.module_id));

    const watched = accessibleLessons
      .map((l) => ({ lesson: l, prog: progressByLesson.get(l.id) }))
      .filter((x) => x.prog && !x.prog.completed && x.prog.last_watched_at)
      .sort(
        (a, b) =>
          new Date(b.prog!.last_watched_at!).getTime() -
          new Date(a.prog!.last_watched_at!).getTime(),
      );
    if (watched[0]) return watched[0];

    const nextUnfinished = accessibleLessons.find((l) => !progressByLesson.get(l.id)?.completed);
    if (nextUnfinished) return { lesson: nextUnfinished, prog: undefined };
    return null;
  }, [data.lessons, moduleViews, progressByLesson]);

  const courseCompleted = totalLessons > 0 && completedLessons === totalLessons;
  const displayName = data.profile?.full_name?.trim() || (lang.startsWith("ja") ? "ゲスト" : "friend");

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <section
        aria-label={t("student.welcome")}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[color:var(--brand)] via-[color:var(--teal,var(--brand))] to-[color:var(--brand)] p-6 text-[color:var(--brand-foreground)] shadow-sm sm:p-8"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-2">
            <p className="text-sm/relaxed opacity-90">
              {t(`student.greeting.${greetingKey()}`, { name: displayName })}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {pickLang(data.course, "title", lang)}
            </h1>
            <p className="text-sm opacity-90">
              {t("student.dashboard.lessonsCompleted", {
                completed: completedLessons,
                total: totalLessons,
              })}
            </p>
            {data.progress.some((p) => p.last_watched_at) && (
              <p className="text-xs opacity-80">
                {t("student.dashboard.lastActivity")}:{" "}
                {formatRelativeDate(
                  [...data.progress]
                    .filter((p) => p.last_watched_at)
                    .sort(
                      (a, b) =>
                        new Date(b.last_watched_at!).getTime() -
                        new Date(a.last_watched_at!).getTime(),
                    )[0]?.last_watched_at,
                  lang.startsWith("ja") ? "ja-JP" : "en-US",
                )}
              </p>
            )}
          </div>
          <div className="min-w-[240px] rounded-2xl bg-white/15 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wide opacity-80">
              {t("student.dashboard.overallProgress")}
            </p>
            <p className="mt-1 text-3xl font-semibold">{overallPct}%</p>
            <Progress value={overallPct} className="mt-3 h-2 bg-white/25" aria-label={t("student.dashboard.overallProgress")} />
          </div>
        </div>
      </section>

      {courseCompleted && <CompletedBanner />}

      {/* Continue + up next */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ContinueCard
          data={data}
          continueLesson={continueLesson}
          moduleViews={moduleViews}
        />
        <UpNextList
          data={data}
          moduleViews={moduleViews}
          currentLessonId={continueLesson?.lesson.id}
          progressByLesson={progressByLesson}
        />
      </section>

      {/* Stages */}
      {data.stages.length > 0 && (
        <section aria-label={t("student.stages")}>
          <h2 className="mb-3 text-lg font-semibold">{t("student.stages")}</h2>
          <Tabs value={activeStageId} onValueChange={setActiveStageId}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="rounded-full border border-border bg-background px-4 py-2 data-[state=active]:border-[color:var(--brand)] data-[state=active]:bg-[color:var(--brand)] data-[state=active]:text-[color:var(--brand-foreground)]"
              >
                {t("student.dashboard.status.available")}
              </TabsTrigger>
              {data.stages.map((s) => {
                const stageModules = moduleViews.filter((m) => m.stage_id === s.id);
                const stageTotal = stageModules.reduce((a, m) => a + m.totalCount, 0);
                const stageDone = stageModules.reduce((a, m) => a + m.completedCount, 0);
                const pct = stageTotal === 0 ? 0 : Math.round((stageDone / stageTotal) * 100);
                return (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-background px-4 py-2 text-left data-[state=active]:border-[color:var(--brand)] data-[state=active]:bg-[color:var(--brand)]/5"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      Stage {s.position + 1}
                    </span>
                    <span className="text-sm font-semibold">{pickLang(s, "title", lang)}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <ModulesGrid modules={moduleViews} courseSlug={data.course.slug} />
            </TabsContent>
            {data.stages.map((s) => (
              <TabsContent key={s.id} value={s.id} className="mt-6">
                <ModulesGrid
                  modules={moduleViews.filter((m) => m.stage_id === s.id)}
                  courseSlug={data.course.slug}
                />
              </TabsContent>
            ))}
          </Tabs>
        </section>
      )}

      {/* Support + Profile */}
      <section className="grid gap-6 md:grid-cols-2">
        <SupportBlock />
        <ProfileSummary
          fullName={displayName}
          email={undefined}
          language={data.profile?.preferred_language ?? "ja"}
        />
      </section>
    </div>
  );
}

// ---------- continue card ----------

function ContinueCard({
  data,
  continueLesson,
  moduleViews,
}: {
  data: Extract<DashboardData, { state: "enrolled" }>;
  continueLesson: { lesson: DashboardLesson; prog: DashboardProgressRow | undefined } | null;
  moduleViews: ModuleView[];
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  if (!continueLesson) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-8">
          <Sparkles className="size-6 text-[color:var(--brand)]" aria-hidden />
          <h2 className="text-lg font-semibold">{t("student.dashboard.completedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("student.dashboard.completedDesc")}</p>
          <Button asChild>
            <Link to="/student/course/$courseSlug" params={{ courseSlug: data.course.slug }}>
              {t("student.dashboard.reviewLessons")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const module = moduleViews.find((m) => m.id === continueLesson.lesson.module_id);
  const stage = module ? data.stages.find((s) => s.id === module.stage_id) : undefined;
  const pct = Math.round(continueLesson.prog?.progress_percentage ?? 0);
  const started = pct > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5 p-0 sm:grid-cols-[260px_1fr]">
        <div
          className="relative aspect-video bg-gradient-to-br from-[color:var(--brand)]/25 via-[color:var(--highlight)]/15 to-[color:var(--teal,var(--brand))]/25 sm:aspect-auto"
          role="img"
          aria-label={pickLang(continueLesson.lesson, "title", lang)}
        >
          {module?.thumbnail_url ? (
            <img
              src={module.thumbnail_url}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <PlayCircle className="size-14 text-[color:var(--brand)]" aria-hidden />
            </div>
          )}
          {started && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
              <div
                className="h-full bg-[color:var(--brand)]"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-4 p-6">
          <div className="min-w-0 space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              {stage && <span>{pickLang(stage, "title", lang)}</span>}
              {stage && module && <span aria-hidden>·</span>}
              {module && <span className="truncate">{pickLang(module, "title", lang)}</span>}
            </p>
            <h2 className="text-xl font-semibold sm:text-2xl">
              {pickLang(continueLesson.lesson, "title", lang)}
            </h2>
            <p className="flex items-center gap-3 text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden />
              {t("student.dashboard.durationMin", {
                min: formatMinutes(continueLesson.lesson.duration_seconds, lang),
              })}
              {started && (
                <>
                  <span aria-hidden>·</span>
                  <span>{pct}%</span>
                </>
              )}
            </p>
            {started && <Progress value={pct} className="h-1.5" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="min-h-11">
              <Link
                to="/student/lesson/$lessonId"
                params={{ lessonId: continueLesson.lesson.id }}
              >
                <PlayCircle className="mr-2 size-4" aria-hidden />
                {started
                  ? t("student.dashboard.continue")
                  : t("student.dashboard.startLearning")}
              </Link>
            </Button>
            {started && (
              <Button asChild variant="outline" size="lg" className="min-h-11">
                <Link
                  to="/student/lesson/$lessonId"
                  params={{ lessonId: continueLesson.lesson.id }}
                  search={{ restart: "1" } as never}
                >
                  {t("student.dashboard.startFromBeginning")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- up next ----------

function UpNextList({
  data,
  moduleViews,
  currentLessonId,
  progressByLesson,
}: {
  data: Extract<DashboardData, { state: "enrolled" }>;
  moduleViews: ModuleView[];
  currentLessonId: string | undefined;
  progressByLesson: Map<string, DashboardProgressRow>;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Take next 5 accessible lessons after current one across modules in order.
  const list = useMemo(() => {
    const items: {
      lesson: DashboardLesson;
      module: ModuleView;
      status: "current" | "completed" | "available" | "locked";
    }[] = [];
    for (const m of moduleViews) {
      const locked = m.status === "locked" || m.status === "coming_soon";
      for (const l of m.lessons) {
        const prog = progressByLesson.get(l.id);
        const status: "current" | "completed" | "available" | "locked" =
          l.id === currentLessonId
            ? "current"
            : prog?.completed
              ? "completed"
              : locked
                ? "locked"
                : "available";
        items.push({ lesson: l, module: m, status });
      }
    }
    // Prioritize: current first, then not-completed available/locked, cap 6
    const currentIdx = items.findIndex((i) => i.status === "current");
    const start = currentIdx >= 0 ? currentIdx : 0;
    return items.slice(start, start + 6);
  }, [moduleViews, currentLessonId, progressByLesson]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-6">
        <h2 className="text-lg font-semibold">{t("student.dashboard.upNext")}</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("student.dashboard.noMoreLessons")}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border" aria-label={t("student.dashboard.upNext")}>
            {list.map((item, idx) => {
              const locked = item.status === "locked";
              const completed = item.status === "completed";
              const isCurrent = item.status === "current";
              const inner = (
                <span className="flex min-w-0 items-center gap-3 py-3">
                  <span
                    className={[
                      "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      completed
                        ? "bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                        : locked
                          ? "bg-muted text-muted-foreground"
                          : isCurrent
                            ? "bg-[color:var(--highlight)]/20 text-[color:var(--highlight)]"
                            : "bg-muted",
                    ].join(" ")}
                    aria-hidden
                  >
                    {completed ? (
                      <CheckCircle2 className="size-4" />
                    ) : locked ? (
                      <Lock className="size-4" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {pickLang(item.lesson, "title", lang)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {pickLang(item.module, "title", lang)} ·{" "}
                      {t("student.dashboard.durationMin", {
                        min: formatMinutes(item.lesson.duration_seconds, lang),
                      })}
                    </span>
                  </span>
                  {isCurrent && (
                    <ArrowRight className="size-4 shrink-0 text-[color:var(--brand)]" aria-hidden />
                  )}
                </span>
              );
              if (locked) {
                return (
                  <li key={item.lesson.id} aria-disabled className="opacity-60">
                    {inner}
                    <span className="sr-only">{t("student.dashboard.status.locked")}</span>
                  </li>
                );
              }
              return (
                <li key={item.lesson.id}>
                  <Link
                    to="/student/lesson/$lessonId"
                    params={{ lessonId: item.lesson.id }}
                    className="block rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        <Button asChild variant="ghost" size="sm" className="mt-2 self-start">
          <Link to="/student/course/$courseSlug" params={{ courseSlug: data.course.slug }}>
            {t("common.learnMore")} <ArrowRight className="ml-1 size-3" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- modules grid ----------

function ModulesGrid({ modules, courseSlug }: { modules: ModuleView[]; courseSlug: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  if (modules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {t("common.empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((m) => {
        const locked = m.status === "locked" || m.status === "coming_soon";
        const statusKey =
          m.status === "completed"
            ? "completed"
            : m.status === "in_progress"
              ? "inProgress"
              : m.status === "locked"
                ? "locked"
                : m.status === "coming_soon"
                  ? "comingSoon"
                  : "notStarted";
        const statusColor =
          m.status === "completed"
            ? "bg-[color:var(--brand)]/10 text-[color:var(--brand)] border-[color:var(--brand)]/30"
            : m.status === "in_progress"
              ? "bg-[color:var(--highlight)]/10 text-[color:var(--highlight)] border-[color:var(--highlight)]/30"
              : "bg-muted text-muted-foreground border-border";
        return (
          <Card
            key={m.id}
            className={locked ? "opacity-80" : "transition hover:shadow-md"}
            aria-disabled={locked || undefined}
          >
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  #{String(m.position + 1).padStart(2, "0")}
                </span>
                <Badge variant="outline" className={`gap-1 ${statusColor}`}>
                  {m.status === "completed" && <CheckCircle2 className="size-3" aria-hidden />}
                  {locked && <Lock className="size-3" aria-hidden />}
                  {t(`student.dashboard.status.${statusKey}`)}
                </Badge>
              </div>
              <div
                className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[color:var(--brand)]/15 to-[color:var(--highlight)]/15"
                aria-hidden
              >
                {m.thumbnail_url ? (
                  <img src={m.thumbnail_url} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <BookOpen className="size-8 text-[color:var(--brand)]" />
                )}
                {locked && (
                  <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
                    <Lock className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="truncate text-base font-semibold">{pickLang(m, "title", lang)}</h3>
                {pickLang(m, "description", lang) && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {pickLang(m, "description", lang)}
                  </p>
                )}
              </div>
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("student.dashboard.lessonCount", { count: m.totalCount })}</span>
                  <span>
                    {m.completedCount}/{m.totalCount} · {m.progressPct}%
                  </span>
                </div>
                <Progress value={m.progressPct} className="h-1.5" aria-label={t("student.dashboard.moduleProgress")} />
                {locked ? (
                  <p className="text-xs text-muted-foreground">
                    {m.lockReason === "date" && m.release_at
                      ? t("student.dashboard.dateReleaseHint", {
                          date: new Intl.DateTimeFormat(lang.startsWith("ja") ? "ja-JP" : "en-US", {
                            dateStyle: "medium",
                          }).format(new Date(m.release_at)),
                        })
                      : t("student.dashboard.lockedHint")}
                  </p>
                ) : (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link
                      to="/student/course/$courseSlug"
                      params={{ courseSlug }}
                      hash={`module-${m.id}`}
                    >
                      {t("student.dashboard.openModule")}
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- support & profile ----------

function SupportBlock() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 py-6">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-5 text-[color:var(--brand)]" aria-hidden />
          <h2 className="text-lg font-semibold">{t("student.dashboard.supportTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("student.dashboard.supportDesc")}</p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/student/support">{t("student.dashboard.supportCta")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/" hash="faq">{t("student.dashboard.faqCta")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSummary({
  fullName,
  email,
  language,
}: {
  fullName: string;
  email: string | undefined;
  language: "ja" | "en";
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 py-6">
        <div className="flex items-center gap-2">
          <UserCircle2 className="size-5 text-[color:var(--brand)]" aria-hidden />
          <h2 className="text-lg font-semibold">{t("student.dashboard.profileSummary")}</h2>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("nav.profile")}</dt>
            <dd className="truncate font-medium">{fullName}</dd>
          </div>
          {email && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                <Mail className="inline size-3.5" aria-hidden /> Email
              </dt>
              <dd className="truncate">{email}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("language.label")}</dt>
            <dd>{t(`language.${language}`)}</dd>
          </div>
        </dl>
        <Button asChild variant="outline" size="sm" className="mt-auto self-start">
          <Link to="/student/profile">{t("student.dashboard.editProfile")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- states: no enrollment / completed / skeleton / error ----------

function NoEnrollmentState({ data }: { data: Extract<DashboardData, { state: "no_enrollment" }> }) {
  const { t } = useTranslation();
  const displayName = data.profile?.full_name?.trim() || "";
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-gradient-to-br from-[color:var(--brand)] to-[color:var(--teal,var(--brand))] p-8 text-[color:var(--brand-foreground)] shadow-sm">
        <p className="text-sm opacity-90">
          {t(`student.greeting.${greetingKey()}`, { name: displayName || "friend" })}
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {t("student.dashboard.noEnrollmentTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-sm opacity-90">
          {t("student.dashboard.noEnrollmentDesc")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg" variant="secondary" className="min-h-11">
            <Link to="/checkout">{t("student.dashboard.goToCheckout")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-11 bg-transparent text-[color:var(--brand-foreground)] border-white/40 hover:bg-white/10">
            <Link to="/student/support">{t("student.dashboard.supportCta")}</Link>
          </Button>
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <SupportBlock />
        <ProfileSummary
          fullName={displayName || "-"}
          email={undefined}
          language={data.profile?.preferred_language ?? "ja"}
        />
      </section>
    </div>
  );
}

function CompletedBanner() {
  const { t } = useTranslation();
  return (
    <section
      className="rounded-2xl border border-[color:var(--brand)]/30 bg-[color:var(--brand)]/5 p-5"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-[color:var(--brand)]" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("student.dashboard.completedTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("student.dashboard.completedDesc")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("student.dashboard.certificateSoon")}
          </p>
        </div>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8" role="alert">
      <h2 className="text-lg font-semibold text-foreground">
        {t("student.dashboard.errorTitle")}
      </h2>
      <Button onClick={onRetry} variant="outline" className="mt-4">
        {t("student.dashboard.errorRetry")}
      </Button>
    </div>
  );
}
