import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlayCircle, Lock, CheckCircle2, BookOpen, Play, LifeBuoy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentTabs } from "@/components/lms/StudentTabs";
import { useSession } from "@/lib/auth/use-session";
import {
  useDashboardData,
  type DashboardData,
  type DashboardLesson,
  type DashboardProgressRow,
} from "@/lib/lms/dashboard-data";
import {
  computeModuleViews,
  computeCourseProgress,
  type ModuleView,
} from "@/lib/lms/course-workspace";
import { CertificateCard } from "@/components/lms/CertificateCard";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({
    meta: [{ title: "ダッシュボード — Eigo Michi" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardPage,
});

// ---------- helpers ----------

function pickLang<T extends Record<string, unknown>>(
  row: T,
  base: "title" | "description",
  lang: string,
): string {
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

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

const CARD = "rounded-md border border-border bg-card shadow-sm";

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
  const [activeStageId, setActiveStageId] = useState<string | "all">(
    () => data.stages[0]?.id ?? "all",
  );

  const moduleViews = useMemo(
    () => computeModuleViews(data.modules, data.lessons, data.progress),
    [data.modules, data.lessons, data.progress],
  );

  const courseProgress = useMemo(
    () => computeCourseProgress(moduleViews, data.progress),
    [moduleViews, data.progress],
  );
  const overallPct = courseProgress.percentage;

  const progressByLesson = useMemo(
    () => new Map(data.progress.map((p) => [p.lesson_id, p])),
    [data.progress],
  );

  // Continue lesson: most recently watched incomplete lesson, else next unfinished.
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

  const displayName =
    data.profile?.full_name?.trim() || (lang.startsWith("ja") ? "ゲスト" : "friend");

  const visibleModules =
    activeStageId === "all"
      ? moduleViews
      : moduleViews.filter((m) => m.stage_id === activeStageId);

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome banner + tabs */}
      <section aria-label={t("student.welcome")} className="overflow-hidden">
        <div className="rounded-t-md bg-[color:var(--lms-accent)] px-5 py-6 text-[color:var(--lms-accent-foreground)] sm:px-8 sm:py-8">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              {data.profile?.avatar_url ? (
                <img
                  src={data.profile.avatar_url}
                  alt=""
                  className="size-16 shrink-0 rounded-full border-2 border-white/70 object-cover sm:size-24"
                />
              ) : (
                <span
                  className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-white/70 bg-white/15 text-2xl font-semibold sm:size-24 sm:text-4xl"
                  aria-hidden
                >
                  {initials(displayName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm opacity-90">{t("student.welcome")},</p>
                <h1 className="truncate text-xl font-bold sm:text-2xl">{displayName}</h1>
                <p className="mt-1 truncate text-xs opacity-90">
                  {pickLang(data.course, "title", lang)}
                </p>
              </div>
            </div>
            <div className="w-full rounded-md bg-card p-4 text-card-foreground shadow-sm md:w-[260px]">
              <p className="text-xs text-muted-foreground">
                {t("student.dashboard.overallProgress")}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {t("student.dashboard.pctComplete", { pct: overallPct })}
              </p>
              <Progress
                value={overallPct}
                className="mt-3 h-1.5"
                aria-label={t("student.dashboard.overallProgress")}
              />
            </div>
          </div>
        </div>
        <StudentTabs className="rounded-t-none border-t-0" />
      </section>

      {/* Start here + up next */}
      <section className={`${CARD} grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]`}>
        <StartHereBlock
          data={data}
          continueLesson={continueLesson}
          moduleViews={moduleViews}
          progressByLesson={progressByLesson}
        />
        <UpNextList
          moduleViews={moduleViews}
          currentLessonId={continueLesson?.lesson.id}
          progressByLesson={progressByLesson}
        />
      </section>

      {/* Stages + modules */}
      <section aria-label={t("student.stages")} className={`${CARD} overflow-hidden`}>
        {data.stages.length > 0 && (
          <div
            role="tablist"
            aria-label={t("student.stages")}
            className="flex overflow-x-auto bg-[color:var(--lms-accent)]"
          >
            {data.stages.map((s, idx) => {
              const active = activeStageId === s.id;
              return (
                <button
                  key={s.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setActiveStageId(s.id)}
                  className={[
                    "min-w-[140px] flex-1 px-4 py-3 text-center text-xs font-medium text-[color:var(--lms-accent-foreground)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:text-sm",
                    active
                      ? "bg-[color:var(--lms-accent-strong)]"
                      : "hover:bg-[color:var(--lms-accent-strong)]/60",
                  ].join(" ")}
                >
                  {t("student.dashboard.stageLabel", { n: idx + 1 })}:{" "}
                  {pickLang(s, "title", lang)}
                </button>
              );
            })}
          </div>
        )}
        <ModulesGrid modules={visibleModules} courseSlug={data.course.slug} />
      </section>

      <CertificateCard courseId={data.course.id} />

      {/* Support + contact */}
      <section className="grid gap-6 md:grid-cols-2">
        <SupportBlock />
        <ContactBlock />
      </section>
    </div>
  );
}

// ---------- start here ----------

function StartHereBlock({
  data,
  continueLesson,
  moduleViews,
  progressByLesson,
}: {
  data: Extract<DashboardData, { state: "enrolled" }>;
  continueLesson: { lesson: DashboardLesson; prog: DashboardProgressRow | undefined } | null;
  moduleViews: ModuleView[];
  progressByLesson: Map<string, DashboardProgressRow>;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  if (!continueLesson) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <h2 className="text-lg font-semibold text-[color:var(--lms-link)]">
          {t("student.dashboard.completedTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("student.dashboard.completedDesc")}</p>
        <Button asChild className="min-h-11">
          <Link to="/student/course/$courseSlug" params={{ courseSlug: data.course.slug }}>
            {t("student.dashboard.reviewLessons")}
          </Link>
        </Button>
      </div>
    );
  }

  const module = moduleViews.find((m) => m.id === continueLesson.lesson.module_id);
  const stage = module ? data.stages.find((s) => s.id === module.stage_id) : undefined;
  const stageIndex = stage ? data.stages.findIndex((s) => s.id === stage.id) : -1;
  const lessonIndex = module
    ? module.lessons.findIndex((l) => l.id === continueLesson.lesson.id) + 1
    : 1;
  const lessonTotal = module?.totalCount ?? 1;
  const modulePct = module?.progressPct ?? 0;
  const started = (continueLesson.prog?.progress_percentage ?? 0) > 0;
  const completedInModule = module
    ? module.lessons.filter((l) => progressByLesson.get(l.id)?.completed).length
    : 0;

  return (
    <div className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[color:var(--lms-link)]">
        {t("student.dashboard.startHere")}
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-start">
        <Link
          to="/student/lesson/$lessonId"
          params={{ lessonId: continueLesson.lesson.id }}
          className="group relative block aspect-video overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lms-accent)]"
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
            <span className="grid size-full place-items-center bg-[color:var(--lms-accent)]/15">
              <BookOpen className="size-8 text-[color:var(--lms-accent)]" aria-hidden />
            </span>
          )}
          <span
            className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-full bg-background/85 text-[color:var(--lms-link)] shadow-sm transition group-hover:scale-105"
            aria-hidden
          >
            <Play className="size-4 fill-current" />
          </span>
        </Link>

        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-[color:var(--lms-link)]">
            {stage && (
              <span>
                {t("student.dashboard.stageLabel", { n: stageIndex + 1 })}:{" "}
                {pickLang(stage, "title", lang)}
              </span>
            )}
            {stage && module && <span aria-hidden>›</span>}
            {module && <span className="truncate">{pickLang(module, "title", lang)}</span>}
          </p>
          <h3 className="mt-1 text-lg font-semibold sm:text-xl">
            {pickLang(continueLesson.lesson, "title", lang)}
          </h3>

          <dl className="mt-3 flex gap-8 text-xs">
            <div>
              <dt className="text-muted-foreground">{t("student.dashboard.lessonLabel")}</dt>
              <dd className="mt-0.5 font-medium">
                {lessonIndex}/{lessonTotal}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("student.dashboard.moduleLabelShort")}</dt>
              <dd className="mt-0.5 font-medium">
                {t("student.dashboard.pctComplete", { pct: modulePct })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("student.dashboard.status.completed")}</dt>
              <dd className="mt-0.5 font-medium">
                {completedInModule}/{lessonTotal}
              </dd>
            </div>
          </dl>

          <Progress
            value={modulePct}
            className="mt-3 h-1"
            aria-label={t("student.dashboard.moduleProgress")}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              className="min-h-11 bg-[color:var(--lms-cta)] text-[color:var(--lms-cta-foreground)] hover:bg-[color:var(--lms-cta-hover)]"
            >
              <Link to="/student/lesson/$lessonId" params={{ lessonId: continueLesson.lesson.id }}>
                <Play className="mr-2 size-4 fill-current" aria-hidden />
                {started ? t("student.dashboard.continue") : t("student.dashboard.startHere")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/student/course/$courseSlug" params={{ courseSlug: data.course.slug }}>
                {t("student.dashboard.openModule")}
              </Link>
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- up next ----------

function UpNextList({
  moduleViews,
  currentLessonId,
  progressByLesson,
}: {
  moduleViews: ModuleView[];
  currentLessonId: string | undefined;
  progressByLesson: Map<string, DashboardProgressRow>;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const list = useMemo(() => {
    const items: {
      lesson: DashboardLesson;
      module: ModuleView;
      index: number;
      total: number;
      status: "current" | "completed" | "available" | "locked";
    }[] = [];
    for (const m of moduleViews) {
      const locked = m.status === "locked" || m.status === "coming_soon";
      m.lessons.forEach((l, idx) => {
        const prog = progressByLesson.get(l.id);
        items.push({
          lesson: l,
          module: m,
          index: idx + 1,
          total: m.lessons.length,
          status:
            l.id === currentLessonId
              ? "current"
              : prog?.completed
                ? "completed"
                : locked
                  ? "locked"
                  : "available",
        });
      });
    }
    const currentIdx = items.findIndex((i) => i.status === "current");
    const start = currentIdx >= 0 ? currentIdx + 1 : 0;
    return items.slice(start, start + 3);
  }, [moduleViews, currentLessonId, progressByLesson]);

  return (
    <div className="border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("student.dashboard.noMoreLessons")}</p>
      ) : (
        <ol className="flex flex-col" aria-label={t("student.dashboard.upNext")}>
          {list.map((item) => {
            const locked = item.status === "locked";
            const inner = (
              <span className="flex min-w-0 items-start gap-3 py-3">
                <span className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                  {item.module.thumbnail_url ? (
                    <img
                      src={item.module.thumbnail_url}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span
                    className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-background/85 text-[color:var(--lms-link)]"
                    aria-hidden
                  >
                    {locked ? (
                      <Lock className="size-2.5" />
                    ) : item.status === "completed" ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <Play className="size-2.5 fill-current" />
                    )}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium text-[color:var(--lms-link)]">
                    {pickLang(item.lesson, "title", lang)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {t("student.dashboard.lessonLabel")} {item.index}/{item.total}
                  </span>
                </span>
              </span>
            );
            return (
              <li key={item.lesson.id} className="border-b border-border last:border-b-0">
                {locked ? (
                  <span aria-disabled className="block opacity-60">
                    {inner}
                    <span className="sr-only">{t("student.dashboard.status.locked")}</span>
                  </span>
                ) : (
                  <Link
                    to="/student/lesson/$lessonId"
                    params={{ lessonId: item.lesson.id }}
                    className="block rounded hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lms-accent)]"
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ---------- modules grid ----------

function ModulesGrid({ modules, courseSlug }: { modules: ModuleView[]; courseSlug: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  if (modules.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{t("common.empty")}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6 sm:p-6">
      {modules.map((m) => {
        const locked = m.status === "locked" || m.status === "coming_soon";
        const tile = `var(--lms-tile-${(m.position % 6) + 1})`;
        const label = pickLang(m, "title", lang);
        const tileInner = (
          <>
            <span
              className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-md"
              style={{ backgroundColor: tile }}
              aria-hidden
            >
              {m.thumbnail_url ? (
                <img src={m.thumbnail_url} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <span className="text-3xl font-bold text-[color:var(--lms-accent-foreground)] opacity-90">
                  {m.position + 1}
                </span>
              )}
              {locked && (
                <span className="absolute inset-0 grid place-items-center bg-background/45">
                  <Lock className="size-4 text-foreground/70" />
                </span>
              )}
              {!locked && m.status === "completed" && (
                <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-background/85 text-[color:var(--brand)]">
                  <CheckCircle2 className="size-3.5" />
                </span>
              )}
            </span>
            <span className="mt-2 block">
              <span
                className={[
                  "block text-xs font-semibold",
                  locked ? "text-muted-foreground" : "text-[color:var(--lms-link)]",
                ].join(" ")}
              >
                {label}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {locked
                  ? t("student.dashboard.status.comingSoon")
                  : t("student.dashboard.lessonsAvailable", { count: m.totalCount })}
              </span>
            </span>
          </>
        );

        return (
          <li key={m.id}>
            {locked ? (
              <span aria-disabled className="block opacity-70">
                {tileInner}
              </span>
            ) : (
              <Link
                to="/student/course/$courseSlug"
                params={{ courseSlug }}
                hash={`module-${m.id}`}
                className="block rounded-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lms-accent)]"
              >
                {tileInner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- support & contact ----------

function SupportBlock() {
  const { t } = useTranslation();
  return (
    <div className={`${CARD} flex h-full flex-col gap-3 p-5 sm:p-6`}>
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-5 text-[color:var(--lms-link)]" aria-hidden />
        <h2 className="text-base font-semibold text-[color:var(--lms-link)]">
          {t("student.dashboard.supportTitle")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("student.dashboard.supportDesc")}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Button asChild size="sm">
          <Link to="/student/support">{t("student.dashboard.supportCta")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/" hash="faq">
            {t("student.dashboard.faqCta")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ContactBlock() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md bg-[color:var(--lms-accent)] p-6 text-center text-[color:var(--lms-accent-foreground)] shadow-sm">
      <Mail className="size-10" aria-hidden />
      <h2 className="text-base font-semibold">{t("student.dashboard.contactTitle")}</h2>
      <p className="text-sm opacity-90">{t("student.dashboard.contactDesc")}</p>
      <Button asChild variant="secondary" size="sm" className="mt-1">
        <Link to="/student/support">{t("student.dashboard.supportCta")}</Link>
      </Button>
    </div>
  );
}

// ---------- states ----------

function NoEnrollmentState({ data }: { data: Extract<DashboardData, { state: "no_enrollment" }> }) {
  const { t } = useTranslation();
  const displayName = data.profile?.full_name?.trim() || "";
  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden">
        <div className="rounded-t-md bg-[color:var(--lms-accent)] p-6 text-[color:var(--lms-accent-foreground)] sm:p-8">
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
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-11 border-white/40 bg-transparent text-[color:var(--lms-accent-foreground)] hover:bg-white/10"
            >
              <Link to="/student/support">{t("student.dashboard.supportCta")}</Link>
            </Button>
          </div>
        </div>
        <StudentTabs className="rounded-t-none border-t-0" />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <SupportBlock />
        <ContactBlock />
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-[168px] w-full rounded-t-md" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-md" />
      <div className={`${CARD} p-5`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-8" role="alert">
      <h2 className="text-lg font-semibold text-foreground">{t("student.dashboard.errorTitle")}</h2>
      <Button onClick={onRetry} variant="outline" className="mt-4">
        {t("student.dashboard.errorRetry")}
      </Button>
    </div>
  );
}

// Keep PlayCircle import referenced for lesson CTA fallback styling parity.
export const __unusedIcons = { PlayCircle };
