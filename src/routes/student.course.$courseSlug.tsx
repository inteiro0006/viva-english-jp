import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth/use-session";
import {
  useCourseWorkspace,
  computeModuleViews,
  type ModuleView,
  type CourseWorkspaceState,
} from "@/lib/lms/course-workspace";
import type { DashboardLesson, DashboardProgressRow } from "@/lib/lms/dashboard-data";

export const Route = createFileRoute("/student/course/$courseSlug")({
  head: () => ({
    meta: [
      { title: "コース — Eigo Michi" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursePage,
});

function pickLang(row: Record<string, unknown>, base: "title" | "description", lang: string) {
  const key = lang.startsWith("ja") ? `${base}_ja` : `${base}_en`;
  const v = row[key];
  return typeof v === "string" ? v : "";
}

function formatMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function CoursePage() {
  const { courseSlug } = Route.useParams();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { t, i18n } = useTranslation();
  const q = useCourseWorkspace(userId, courseSlug);

  if (q.isLoading) return <CourseSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("student.course.errorTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{q.error?.message}</p>
        <Button className="mt-6" onClick={() => q.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  const data = q.data!;
  if (data.state === "not_found") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("student.course.notFoundTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("student.course.notFoundDesc")}</p>
        <Button asChild className="mt-6">
          <Link to="/student/dashboard">{t("student.course.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }
  if (data.state === "no_access") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("student.course.noAccessTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("student.course.noAccessDesc")}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link to="/checkout">{t("student.course.buyCta")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/student/dashboard">{t("student.course.backToDashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <CourseView data={data} lang={i18n.language} t={t} />;
}

function CourseView({
  data,
  lang,
  t,
}: {
  data: Extract<CourseWorkspaceState, { state: "ok" }>;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const moduleViews = useMemo(
    () => computeModuleViews(data.modules, data.lessons, data.progress),
    [data.modules, data.lessons, data.progress],
  );

  const totalLessons = data.lessons.length;
  const completedLessons = data.progress.filter((p) => p.completed).length;
  const overallPct = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const totalStudiedSeconds = data.progress.reduce((s, p) => s + (p.progress_percentage ?? 0), 0);
  const totalStudiedMinutes = useMemo(() => {
    const byLesson = new Map(data.lessons.map((l) => [l.id, l.duration_seconds]));
    return Math.round(
      data.progress.reduce(
        (s, p) => s + ((byLesson.get(p.lesson_id) ?? 0) * (p.progress_percentage ?? 0)) / 100,
        0,
      ) / 60,
    );
  }, [data.progress, data.lessons]);

  // pick continue lesson: last watched incomplete, else first unlocked
  const continueLesson = useMemo(() => {
    const byLesson = new Map(data.progress.map((p) => [p.lesson_id, p]));
    const sortedProgress = [...data.progress]
      .filter((p) => !p.completed && p.last_watched_at)
      .sort(
        (a, b) =>
          new Date(b.last_watched_at ?? 0).getTime() -
          new Date(a.last_watched_at ?? 0).getTime(),
      );
    if (sortedProgress[0]) return sortedProgress[0].lesson_id;
    for (const mv of moduleViews) {
      if (mv.status === "locked" || mv.status === "coming_soon") continue;
      for (const l of mv.lessons) {
        if (!byLesson.get(l.id)?.completed) return l.id;
      }
    }
    return moduleViews.flatMap((m) => m.lessons)[0]?.id ?? null;
  }, [data.progress, moduleViews]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link to="/student/dashboard" className="hover:underline">
          {t("student.myCourse")}
        </Link>
        <span className="mx-2">/</span>
        <span aria-current="page" className="text-foreground">
          {pickLang(data.course, "title", lang)}
        </span>
      </nav>

      <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-8 text-primary-foreground shadow-lg">
          {data.course.cover_url ? (
            <img
              src={data.course.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
          ) : null}
          <div className="relative">
            <p className="text-sm opacity-90">{t("student.myCourse")}</p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">
              {pickLang(data.course, "title", lang)}
            </h1>
            {pickLang(data.course, "description", lang) ? (
              <p className="mt-3 max-w-2xl text-base opacity-95">
                {pickLang(data.course, "description", lang)}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {continueLesson ? (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/student/lesson/$lessonId" params={{ lessonId: continueLesson }}>
                    <PlayCircle className="mr-2 h-5 w-5" />
                    {t("student.course.continue")}
                  </Link>
                </Button>
              ) : null}
              <div className="text-sm opacity-95">
                {t("student.dashboard.lessonsCompleted", {
                  completed: completedLessons,
                  total: totalLessons,
                })}
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("student.dashboard.overallProgress")}
              </span>
              <span className="text-2xl font-bold">{overallPct}%</span>
            </div>
            <Progress value={overallPct} className="mt-3" />
            <Separator className="my-4" />
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">{t("student.course.stagesCount")}</span>
                <span className="font-medium">{data.stages.length}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">{t("student.course.modulesCount")}</span>
                <span className="font-medium">{data.modules.length}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">{t("student.course.lessonsCount")}</span>
                <span className="font-medium">
                  {completedLessons} / {totalLessons}
                </span>
              </li>
              {totalStudiedMinutes > 0 && totalStudiedSeconds > 0 ? (
                <li className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("student.course.timeStudied")}
                  </span>
                  <span className="font-medium">
                    {t("student.dashboard.durationMin", { min: totalStudiedMinutes })}
                  </span>
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 space-y-8">
        {data.stages.length === 0 ? (
          <StageBlock
            key="__no_stage"
            title={t("student.stages")}
            modules={moduleViews}
            lang={lang}
            t={t}
          />
        ) : (
          data.stages.map((stage) => {
            const mods = moduleViews.filter((m) => m.stage_id === stage.id);
            if (mods.length === 0) return null;
            return (
              <StageBlock
                key={stage.id}
                title={pickLang(stage, "title", lang)}
                position={stage.position}
                modules={mods}
                lang={lang}
                t={t}
              />
            );
          })
        )}
      </section>
    </div>
  );
}

function StageBlock({
  title,
  position,
  modules,
  lang,
  t,
}: {
  title: string;
  position?: number;
  modules: ModuleView[];
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        {position ? (
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("student.dashboard.stageProgress")} {position}
          </span>
        ) : null}
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((m) => (
          <ModuleCard key={m.id} module={m} lang={lang} t={t} />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  module: m,
  lang,
  t,
}: {
  module: ModuleView;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const isLocked = m.status === "locked" || m.status === "coming_soon";
  const title = pickLang(m, "title", lang);
  const desc = pickLang(m, "description", lang);
  return (
    <Card className={isLocked ? "opacity-70" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{title}</h3>
            {desc ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{desc}</p>
            ) : null}
          </div>
          <StatusBadge status={m.status} t={t} />
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {t("student.dashboard.lessonCount", { count: m.totalCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {t("student.dashboard.durationMin", { min: formatMinutes(m.totalDurationSeconds) })}
          </span>
        </div>
        {m.lockReason === "date" && m.release_at ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("student.dashboard.dateReleaseHint", {
              date: new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(
                new Date(m.release_at),
              ),
            })}
          </p>
        ) : m.lockReason === "sequence" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("student.dashboard.lockedHint")}
          </p>
        ) : null}
        <div className="mt-4">
          <Progress value={m.progressPct} />
          <div className="mt-1 text-right text-xs text-muted-foreground">{m.progressPct}%</div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {m.lessons.slice(0, 6).map((l, idx) => (
            <LessonRow key={l.id} lesson={l} index={idx + 1} moduleLocked={isLocked} lang={lang} t={t} />
          ))}
          {m.lessons.length > 6 ? (
            <li className="pt-1 text-xs text-muted-foreground">
              +{m.lessons.length - 6}
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}

function LessonRow({
  lesson,
  index,
  moduleLocked,
  lang,
  t,
}: {
  lesson: DashboardLesson;
  index: number;
  moduleLocked: boolean;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  // We use progress via context is not needed for course page list — but we can rely on visual states via icon
  const title = pickLang(lesson as unknown as Record<string, unknown>, "title", lang);
  const min = formatMinutes(lesson.duration_seconds ?? 0);
  if (moduleLocked) {
    return (
      <li className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span className="tabular-nums w-6">{index}.</span>
        <span className="truncate">{title}</span>
        <span className="ml-auto shrink-0 text-xs">
          {t("student.dashboard.durationMin", { min })}
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 text-sm">
      <PlayCircle className="h-3.5 w-3.5 text-primary" />
      <span className="tabular-nums w-6 text-muted-foreground">{index}.</span>
      <Link
        to="/student/lesson/$lessonId"
        params={{ lessonId: lesson.id }}
        className="min-w-0 truncate hover:underline"
      >
        {title}
      </Link>
      {lesson.is_preview ? (
        <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">
          {t("student.lesson.previewBadge")}
        </Badge>
      ) : null}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {t("student.dashboard.durationMin", { min })}
      </span>
    </li>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: ModuleView["status"];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const map = {
    not_started: { label: t("student.dashboard.status.notStarted"), variant: "outline" as const },
    in_progress: { label: t("student.dashboard.status.inProgress"), variant: "default" as const },
    completed: { label: t("student.dashboard.status.completed"), variant: "secondary" as const },
    locked: { label: t("student.dashboard.status.locked"), variant: "outline" as const },
    coming_soon: {
      label: t("student.dashboard.status.comingSoon"),
      variant: "outline" as const,
    },
  } as const;
  const s = map[status];
  return (
    <Badge variant={s.variant} className="shrink-0 gap-1">
      {status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : null}
      {status === "locked" || status === "coming_soon" ? <Lock className="h-3 w-3" /> : null}
      {status === "in_progress" ? <Sparkles className="h-3 w-3" /> : null}
      {s.label}
    </Badge>
  );
}

function CourseSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
