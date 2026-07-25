import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LessonRow = {
  id: string;
  module_id: string;
  title_ja: string;
  title_en: string;
  description_ja: string | null;
  description_en: string | null;
  duration_seconds: number;
  position: number;
  is_preview: boolean;
  lesson_type: "video" | "text" | "quiz" | "file";
  cloudflare_video_uid: string | null;
};

export type ModuleRow = {
  id: string;
  course_id: string;
  stage_id: string | null;
  title_ja: string;
  title_en: string;
  description_ja: string | null;
  description_en: string | null;
  position: number;
  release_type: "immediate" | "date" | "after_previous";
  release_at: string | null;
};

export type CourseRow = {
  id: string;
  slug: string;
  title_ja: string;
  title_en: string;
};

export type ResourceRow = {
  id: string;
  title_ja: string;
  title_en: string;
  url: string;
  resource_type: string;
  position: number;
};

export type ProgressRow = {
  lesson_id: string;
  progress_seconds: number;
  progress_percentage: number;
  completed: boolean;
  last_watched_at: string | null;
};

export type LessonWorkspaceState =
  | { state: "not_found" }
  | { state: "no_access" }
  | {
      state: "ok";
      lesson: LessonRow;
      module: ModuleRow;
      course: CourseRow;
      siblings: LessonRow[]; // lessons in same module
      moduleSiblings: {
        id: string;
        title_ja: string;
        title_en: string;
        position: number;
        lessons: { id: string; title_ja: string; title_en: string; position: number; duration_seconds: number }[];
      }[];
      resources: ResourceRow[];
      progress: ProgressRow | null;
      prevLessonId: string | null;
      nextLessonId: string | null;
    };

export function useLessonWorkspace(userId: string | undefined, lessonId: string | undefined) {
  return useQuery({
    queryKey: ["lesson-workspace", userId, lessonId],
    enabled: !!userId && !!lessonId,
    staleTime: 15_000,
    queryFn: async (): Promise<LessonWorkspaceState> => {
      if (!userId || !lessonId) throw new Error("Missing input");

      // RLS enforces: lesson visible only if published AND (preview OR enrolled)
      const lessonRes = await supabase
        .from("lessons")
        .select(
          "id, module_id, title_ja, title_en, description_ja, description_en, duration_seconds, position, is_preview, lesson_type, cloudflare_video_uid",
        )
        .eq("id", lessonId)
        .eq("status", "published")
        .maybeSingle();
      if (lessonRes.error) throw new Error(lessonRes.error.message);
      if (!lessonRes.data) {
        // Could be not-found OR blocked by RLS. Check if row exists ignoring RLS via a probe on modules→courses is not possible from client.
        return { state: "no_access" };
      }
      const lesson = lessonRes.data as LessonRow;

      const moduleRes = await supabase
        .from("modules")
        .select(
          "id, course_id, stage_id, title_ja, title_en, description_ja, description_en, position, release_type, release_at",
        )
        .eq("id", lesson.module_id)
        .eq("status", "published")
        .maybeSingle();
      if (moduleRes.error) throw new Error(moduleRes.error.message);
      if (!moduleRes.data) return { state: "not_found" };
      const mod = moduleRes.data as ModuleRow;

      // Client-side release gate (RLS on modules does not check release_at)
      const now = new Date();
      if (mod.release_type === "date" && mod.release_at && new Date(mod.release_at) > now) {
        return { state: "no_access" };
      }

      const courseRes = await supabase
        .from("courses")
        .select("id, slug, title_ja, title_en")
        .eq("id", mod.course_id)
        .eq("status", "published")
        .maybeSingle();
      if (courseRes.error) throw new Error(courseRes.error.message);
      if (!courseRes.data) return { state: "not_found" };
      const course = courseRes.data as CourseRow;

      // Enrollment check via RLS-visible enrollments table
      if (!lesson.is_preview) {
        const enrollRes = await supabase
          .from("enrollments")
          .select("id, expires_at")
          .eq("user_id", userId)
          .eq("course_id", course.id)
          .eq("status", "active")
          .limit(1);
        if (enrollRes.error) throw new Error(enrollRes.error.message);
        const e = enrollRes.data?.[0];
        const active = e && (!e.expires_at || new Date(e.expires_at) > new Date());
        if (!active) return { state: "no_access" };
      }

      // Fetch full curriculum for sidebar + prev/next
      const modulesRes = await supabase
        .from("modules")
        .select("id, title_ja, title_en, position, release_type, release_at")
        .eq("course_id", course.id)
        .eq("status", "published")
        .order("position");
      if (modulesRes.error) throw new Error(modulesRes.error.message);
      const allModules = modulesRes.data ?? [];
      const allLessonsRes = await supabase
        .from("lessons")
        .select("id, module_id, title_ja, title_en, position, duration_seconds")
        .in(
          "module_id",
          allModules.map((m) => m.id),
        )
        .eq("status", "published")
        .order("position");
      if (allLessonsRes.error) throw new Error(allLessonsRes.error.message);
      const allLessons = allLessonsRes.data ?? [];

      const moduleSiblings = allModules.map((m) => ({
        id: m.id,
        title_ja: m.title_ja,
        title_en: m.title_en,
        position: m.position,
        lessons: allLessons.filter((l) => l.module_id === m.id),
      }));

      const siblings = allLessons.filter((l) => l.module_id === lesson.module_id) as LessonRow[];

      // Flatten to compute prev/next respecting module then lesson position
      const orderedModIds = allModules.map((m) => m.id);
      const flat: string[] = [];
      for (const mid of orderedModIds) {
        for (const l of allLessons.filter((x) => x.module_id === mid)) flat.push(l.id);
      }
      const idx = flat.indexOf(lesson.id);
      const prevLessonId = idx > 0 ? flat[idx - 1] : null;
      const nextLessonId = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

      const [resourcesRes, progressRes] = await Promise.all([
        supabase
          .from("lesson_resources")
          .select("id, title_ja, title_en, url, resource_type, position")
          .eq("lesson_id", lesson.id)
          .order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, progress_seconds, progress_percentage, completed, last_watched_at")
          .eq("user_id", userId)
          .eq("lesson_id", lesson.id)
          .maybeSingle(),
      ]);
      if (resourcesRes.error) throw new Error(resourcesRes.error.message);
      if (progressRes.error) throw new Error(progressRes.error.message);

      return {
        state: "ok",
        lesson,
        module: mod,
        course,
        siblings,
        moduleSiblings,
        resources: (resourcesRes.data ?? []) as ResourceRow[],
        progress: (progressRes.data as ProgressRow | null) ?? null,
        prevLessonId,
        nextLessonId,
      };
    },
  });
}

export async function markLessonComplete(userId: string, lessonId: string, durationSeconds: number) {
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      progress_seconds: Math.max(1, durationSeconds),
      progress_percentage: 100,
      completed: true,
      completed_at: new Date().toISOString(),
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw new Error(error.message);
}

export async function saveLessonPosition(
  userId: string,
  lessonId: string,
  progressSeconds: number,
  progressPercentage: number,
) {
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      progress_seconds: Math.round(progressSeconds),
      progress_percentage: Math.min(100, Math.max(0, Math.round(progressPercentage))),
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw new Error(error.message);
}
