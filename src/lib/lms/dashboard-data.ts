import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type ReleaseType = Database["public"]["Enums"]["release_type"];

export type DashboardCourse = {
  id: string;
  slug: string;
  title_ja: string;
  title_en: string;
  description_ja: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
};

export type DashboardStage = {
  id: string;
  title_ja: string;
  title_en: string;
  position: number;
};

export type DashboardModule = {
  id: string;
  stage_id: string | null;
  title_ja: string;
  title_en: string;
  description_ja: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  position: number;
  release_type: ReleaseType;
  release_at: string | null;
  status: ContentStatus;
};

export type DashboardLesson = {
  id: string;
  module_id: string;
  title_ja: string;
  title_en: string;
  duration_seconds: number;
  position: number;
  is_preview: boolean;
};

export type DashboardProgressRow = {
  lesson_id: string;
  progress_percentage: number;
  completed: boolean;
  last_watched_at: string | null;
};

export type DashboardProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  preferred_language: "ja" | "en";
};

export type DashboardData =
  | { state: "no_enrollment"; profile: DashboardProfile | null }
  | {
      state: "enrolled";
      profile: DashboardProfile | null;
      course: DashboardCourse;
      stages: DashboardStage[];
      modules: DashboardModule[];
      lessons: DashboardLesson[];
      progress: DashboardProgressRow[];
    };

export function useDashboardData(userId: string | undefined) {
  return useQuery({
    queryKey: ["student-dashboard", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<DashboardData> => {
      if (!userId) throw new Error("No user");

      const [profileRes, enrollRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, preferred_language")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("enrollments")
          .select(
            "course_id, status, expires_at, courses:course_id (id, slug, title_ja, title_en, description_ja, description_en, thumbnail_url, cover_url)",
          )
          .eq("user_id", userId)
          .eq("status", "active")
          .order("enrolled_at", { ascending: false })
          .limit(1),
      ]);
      if (profileRes.error) throw new Error(profileRes.error.message);
      if (enrollRes.error) throw new Error(enrollRes.error.message);

      const profile = (profileRes.data as DashboardProfile | null) ?? null;
      const enrollRow = enrollRes.data?.[0];
      const active =
        enrollRow && (!enrollRow.expires_at || new Date(enrollRow.expires_at) > new Date())
          ? enrollRow
          : null;
      const course = active?.courses as DashboardCourse | null | undefined;
      if (!active || !course) return { state: "no_enrollment", profile };

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
        state: "enrolled",
        profile,
        course,
        stages: (stagesRes.data ?? []) as DashboardStage[],
        modules,
        lessons: (lessonsRes.data ?? []) as DashboardLesson[],
        progress: (progressRes.data ?? []) as DashboardProgressRow[],
      };
    },
  });
}
