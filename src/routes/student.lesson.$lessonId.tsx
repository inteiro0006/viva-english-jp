import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  Menu,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/lib/auth/use-session";
import {
  useLessonWorkspace,
  markLessonComplete,
  saveLessonPosition,
  type LessonWorkspaceState,
} from "@/lib/lms/lesson-workspace";

export const Route = createFileRoute("/student/lesson/$lessonId")({
  head: () => ({
    meta: [
      { title: "レッスン — Eigo Michi" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LessonPage,
});

function pickLang(row: Record<string, unknown>, base: "title" | "description", lang: string) {
  const key = lang.startsWith("ja") ? `${base}_ja` : `${base}_en`;
  const v = row[key];
  return typeof v === "string" ? v : "";
}

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { t } = useTranslation();
  const q = useLessonWorkspace(userId, lessonId);

  if (q.isLoading) return <LessonSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("student.lesson.errorTitle")}</h1>
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
        <h1 className="text-2xl font-semibold">{t("student.lesson.notFoundTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("student.lesson.notFoundDesc")}</p>
        <Button asChild className="mt-6">
          <Link to="/student/dashboard">{t("student.course.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }
  if (data.state === "no_access") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-semibold">{t("student.lesson.accessDeniedTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("student.lesson.accessDeniedDesc")}</p>
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

  return <LessonView data={data} />;
}

function LessonView({ data }: { data: Extract<LessonWorkspaceState, { state: "ok" }> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { session } = useSession();
  const userId = session!.user!.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isCompleting, setIsCompleting] = useState(false);
  const [completedLocal, setCompletedLocal] = useState<boolean>(data.progress?.completed ?? false);
  const [progressPct, setProgressPct] = useState<number>(
    data.progress?.progress_percentage ?? 0,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastSavedRef = useRef<number>(0);

  useEffect(() => {
    setCompletedLocal(data.progress?.completed ?? false);
    setProgressPct(data.progress?.progress_percentage ?? 0);
  }, [data.progress?.completed, data.progress?.progress_percentage, data.lesson.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lesson-workspace"] });
    queryClient.invalidateQueries({ queryKey: ["course-workspace"] });
    queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
  };

  const handleComplete = async () => {
    if (completedLocal || isCompleting) return;
    setIsCompleting(true);
    try {
      await markLessonComplete(userId, data.lesson.id, data.lesson.duration_seconds || 60);
      setCompletedLocal(true);
      setProgressPct(100);
      toast.success(t("student.lesson.completedToast"));
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setIsCompleting(false);
    }
  };

  // Simulated progress: for text/quiz/file lessons we don't have a real player yet.
  // Persist position when user interacts with the "mark progress" control.
  // Throttled to at most once per 5s.
  const persistPosition = async (pct: number) => {
    const now = Date.now();
    if (now - lastSavedRef.current < 5000) return;
    lastSavedRef.current = now;
    try {
      const seconds = Math.round(((data.lesson.duration_seconds || 60) * pct) / 100);
      await saveLessonPosition(userId, data.lesson.id, seconds, pct);
    } catch {
      /* silent — non-critical */
    }
  };

  const goTo = (id: string | null) => {
    if (!id) return;
    navigate({ to: "/student/lesson/$lessonId", params: { lessonId: id } });
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-8">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link to="/student/dashboard" className="hover:underline">
          {t("student.myCourse")}
        </Link>
        <span className="mx-2">/</span>
        <Link
          to="/student/course/$courseSlug"
          params={{ courseSlug: data.course.slug }}
          className="hover:underline"
        >
          {pickLang(data.course, "title", lang)}
        </Link>
        <span className="mx-2">/</span>
        <span aria-current="page" className="text-foreground">
          {pickLang(data.module, "title", lang)}
        </span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* Player / main content */}
          <div className="overflow-hidden rounded-2xl bg-black text-white shadow">
            <div className="relative aspect-video w-full">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-900 to-neutral-800">
                <PlayCircle className="h-14 w-14 opacity-70" aria-hidden="true" />
                <p className="px-4 text-center text-sm opacity-80">
                  {t("student.lesson.playerPlaceholder")}
                </p>
                <p className="px-4 text-center text-xs opacity-60">
                  {t("student.lesson.playerPlaceholderNote")}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile drawer toggle */}
          <div className="mt-4 flex items-center gap-2 lg:hidden">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="mr-2 h-4 w-4" />
                  {t("student.lesson.lessonList")}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{pickLang(data.course, "title", lang)}</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <Sidebar data={data} onNavigate={() => setDrawerOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Title + description */}
          <div className="mt-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>{pickLang(data.module, "title", lang)}</span>
              <span>·</span>
              <span>
                {t("student.dashboard.durationMin", {
                  min: Math.max(1, Math.round((data.lesson.duration_seconds ?? 0) / 60)),
                })}
              </span>
              {data.lesson.is_preview ? (
                <Badge variant="outline" className="ml-1">
                  {t("student.lesson.previewBadge")}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="ml-1 capitalize">
                {data.lesson.lesson_type}
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">
              {pickLang(data.lesson, "title", lang)}
            </h1>
            {pickLang(data.lesson, "description", lang) ? (
              <p className="mt-3 whitespace-pre-line text-muted-foreground">
                {pickLang(data.lesson, "description", lang)}
              </p>
            ) : null}
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("student.lesson.yourProgress")}</span>
              <span className="font-medium tabular-nums">{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} />
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleComplete}
              disabled={completedLocal || isCompleting}
              aria-live="polite"
            >
              {completedLocal ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t("student.lesson.completed")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isCompleting ? t("common.loading") : t("student.lesson.markComplete")}
                </>
              )}
            </Button>

            {!completedLocal ? (
              <Button
                variant="outline"
                onClick={() => {
                  const next = Math.min(100, Math.round(progressPct) + 25);
                  setProgressPct(next);
                  void persistPosition(next);
                }}
              >
                +25%
              </Button>
            ) : null}

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => goTo(data.prevLessonId)}
                disabled={!data.prevLessonId}
                aria-label={t("student.lesson.prev")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("student.lesson.prev")}
              </Button>
              <Button
                onClick={() => goTo(data.nextLessonId)}
                disabled={!data.nextLessonId}
                aria-label={t("student.lesson.next")}
              >
                {t("student.lesson.next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Materials */}
          {data.resources.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">{t("student.lesson.materials")}</h2>
              <ul className="mt-3 space-y-2">
                {data.resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent"
                    >
                      <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="flex-1 truncate">
                        {pickLang(r as unknown as Record<string, unknown>, "title", lang)}
                      </span>
                      <Badge variant="outline" className="capitalize">
                        {r.resource_type}
                      </Badge>
                      <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-8">
            <Button asChild variant="ghost">
              <Link
                to="/student/course/$courseSlug"
                params={{ courseSlug: data.course.slug }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("student.lesson.backToCourse")}
              </Link>
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <Card>
            <CardContent className="p-4">
              <Sidebar data={data} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Sidebar({
  data,
  onNavigate,
}: {
  data: Extract<LessonWorkspaceState, { state: "ok" }>;
  onNavigate?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currentModule = data.module.id;
  return (
    <nav aria-label={t("student.lesson.lessonList")}>
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("student.myCourse")}
        </p>
        <p className="font-semibold">{pickLang(data.course, "title", lang)}</p>
      </div>
      <Separator className="mb-3" />
      <ul className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {data.moduleSiblings.map((m) => (
          <li key={m.id}>
            <p className="mb-2 text-sm font-semibold">{pickLang(m, "title", lang)}</p>
            <ul className="space-y-1">
              {m.lessons.map((l) => {
                const isCurrent = l.id === data.lesson.id;
                return (
                  <li key={l.id}>
                    <Link
                      to="/student/lesson/$lessonId"
                      params={{ lessonId: l.id }}
                      onClick={onNavigate}
                      aria-current={isCurrent ? "page" : undefined}
                      className={
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent " +
                        (isCurrent ? "bg-accent font-medium" : "")
                      }
                    >
                      <PlayCircle
                        className={
                          "h-3.5 w-3.5 " +
                          (isCurrent ? "text-primary" : "text-muted-foreground")
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {pickLang(l, "title", lang)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {Math.max(1, Math.round((l.duration_seconds ?? 0) / 60))}m
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {currentModule ? null : null}
    </nav>
  );
}

function LessonSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-8">
      <Skeleton className="h-4 w-64" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="mt-6 h-8 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
        <Skeleton className="hidden h-96 rounded-xl lg:block" />
      </div>
    </div>
  );
}
