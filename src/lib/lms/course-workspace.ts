import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  DashboardCourse,
  DashboardStage,
  DashboardModule,
  DashboardLesson,
  DashboardProgressRow,
} from "./dashboard-data";

export type CourseWorkspaceState =
  | { state: "not_found" }
  | { state: "no_access"; course: DashboardCourse }
  | {
      state: "ok";
      course: DashboardCourse;
      stages: DashboardStage[];
      modules: DashboardModule[];
      lessons: DashboardLesson[];
      progress: DashboardProgressRow[];
      enrolledAt: string | null;
      expiresAt: string | null;
    };

export function useCourseWorkspace(userId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: ["course-workspace", userId, slug],
    enabled: !!userId && !!slug,
    staleTime: 30_000,
    queryFn: async (): Promise<CourseWorkspaceState> => {
      if (!userId || !slug) throw new Error("Missing input");

      const courseRes = await supabase
        .from("courses")
        .select(
          "id, slug, title_ja, title_en, description_ja, description_en, thumbnail_url, cover_url",
        )
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (courseRes.error) throw new Error(courseRes.error.message);
      if (!courseRes.data) return { state: "not_found" };
      const course = courseRes.data as DashboardCourse;

      const enrollRes = await supabase
        .from("enrollments")
        .select("enrolled_at, expires_at, status")
        .eq("user_id", userId)
        .eq("course_id", course.id)
        .eq("status", "active")
        .order("enrolled_at", { ascending: false })
        .limit(1);
      if (enrollRes.error) throw new Error(enrollRes.error.message);
      const enroll = enrollRes.data?.[0];
      const active =
        enroll && (!enroll.expires_at || new Date(enroll.expires_at) > new Date())
          ? enroll
          : null;
      if (!active) return { state: "no_access", course };

      const [stagesRes, modulesRes] = await Promise.all([
        supabase
          .from("course_stages")
          .select("id, title_ja, title_en, position")
          .eq("course_id", course.id)
          .eq("status", "published")
          .order("position"),
        supabase
          .from("modules")
          .select(
            "id, stage_id, title_ja, title_en, description_ja, description_en, thumbnail_url, position, release_type, release_at, status",
          )
          .eq("course_id", course.id)
          .eq("status", "published")
          .order("position"),
      ]);
      if (stagesRes.error) throw new Error(stagesRes.error.message);
      if (modulesRes.error) throw new Error(modulesRes.error.message);

      const modules = (modulesRes.data ?? []) as DashboardModule[];
      const moduleIds = modules.map((m) => m.id);

      const [lessonsRes, progressRes] = await Promise.all([
        moduleIds.length
          ? supabase
              .from("lessons")
              .select("id, module_id, title_ja, title_en, duration_seconds, position, is_preview")
              .in("module_id", moduleIds)
              .eq("status", "published")
              .order("position")
          : Promise.resolve({ data: [], error: null } as const),
        supabase
          .from("lesson_progress")
          .select("lesson_id, progress_percentage, completed, last_watched_at")
          .eq("user_id", userId),
      ]);
      if (lessonsRes.error) throw new Error(lessonsRes.error.message);
      if (progressRes.error) throw new Error(progressRes.error.message);

      return {
        state: "ok",
        course,
        stages: (stagesRes.data ?? []) as DashboardStage[],
        modules,
        lessons: (lessonsRes.data ?? []) as DashboardLesson[],
        progress: (progressRes.data ?? []) as DashboardProgressRow[],
        enrolledAt: active.enrolled_at ?? null,
        expiresAt: active.expires_at ?? null,
      };
    },
  });
}

// Shared module lock computation
export type ModuleView = {
  id: string;
  stage_id: string | null;
  title_ja: string;
  title_en: string;
  description_ja: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  position: number;
  release_type: DashboardModule["release_type"];
  release_at: string | null;
  lessons: DashboardLesson[];
  completedCount: number;
  totalCount: number;
  progressPct: number;
  totalDurationSeconds: number;
  status: "not_started" | "in_progress" | "completed" | "locked" | "coming_soon";
  lockReason: "date" | "sequence" | null;
  /**
   * Whether this module's lessons should count in course-level progress
   * denominators. Modules that are still scheduled for the future are
   * excluded so they don't distort the current view.
   */
  countsForProgress: boolean;
};

export function computeModuleViews(
  modules: DashboardModule[],
  lessons: DashboardLesson[],
  progress: DashboardProgressRow[],
): ModuleView[] {
  const now = new Date();
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  const views: ModuleView[] = [];
  let previousCompleted = true;

  for (const m of modules) {
    const modLessons = lessons.filter((l) => l.module_id === m.id);
    const completed = modLessons.filter((l) => byLesson.get(l.id)?.completed).length;
    const total = modLessons.length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    const totalDurationSeconds = modLessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);

    let status: ModuleView["status"] = "not_started";
    let lockReason: ModuleView["lockReason"] = null;
    let countsForProgress = true;

    if (m.release_type === "date" && m.release_at && new Date(m.release_at) > now) {
      status = "coming_soon";
      lockReason = "date";
      countsForProgress = false;
    } else if (m.release_type === "after_previous" && !previousCompleted) {
      status = "locked";
      lockReason = "sequence";
    } else if (total > 0 && completed === total) {
      status = "completed";
    } else if (completed > 0) {
      status = "in_progress";
    }

    views.push({
      id: m.id,
      stage_id: m.stage_id,
      title_ja: m.title_ja,
      title_en: m.title_en,
      description_ja: m.description_ja,
      description_en: m.description_en,
      thumbnail_url: m.thumbnail_url,
      position: m.position,
      release_type: m.release_type,
      release_at: m.release_at,
      lessons: modLessons,
      completedCount: completed,
      totalCount: total,
      progressPct: pct,
      totalDurationSeconds,
      status,
      lockReason,
      countsForProgress,
    });

    if (m.release_type === "after_previous") {
      previousCompleted = total > 0 && completed === total;
    }
  }
  return views;
}

export type CourseProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  lastWatchedAt: string | null;
};

/**
 * Consistent course-level progress:
 * denominator = published lessons in modules currently released
 * (future-date modules are excluded so they don't drag % down).
 */
export function computeCourseProgress(
  modules: ModuleView[],
  progress: DashboardProgressRow[],
): CourseProgressSummary {
  const eligible = modules.filter((m) => m.countsForProgress);
  const eligibleIds = new Set(eligible.flatMap((m) => m.lessons.map((l) => l.id)));
  const totalLessons = eligibleIds.size;
  const eligibleProgress = progress.filter((p) => eligibleIds.has(p.lesson_id));
  const completedLessons = eligibleProgress.filter((p) => p.completed).length;
  const percentage =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const lastWatchedAt =
    progress
      .filter((p) => p.last_watched_at)
      .map((p) => p.last_watched_at as string)
      .sort()
      .pop() ?? null;
  return { totalLessons, completedLessons, percentage, lastWatchedAt };
}
