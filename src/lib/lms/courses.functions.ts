import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getPublishedCourseBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: course, error } = await supabase
      .from("courses")
      .select(
        "id, slug, title_ja, title_en, description_ja, description_en, thumbnail_url, cover_url, price_jpy, access_type, access_duration_days",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return course;
  });

export const listPublishedCourses = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title_ja, title_en, thumbnail_url, price_jpy")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getCourseCurriculum = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const [stagesRes, modulesRes, lessonsRes] = await Promise.all([
      supabase
        .from("course_stages")
        .select("id, title_ja, title_en, description_ja, description_en, position")
        .eq("course_id", data.courseId)
        .eq("status", "published")
        .order("position"),
      supabase
        .from("modules")
        .select(
          "id, stage_id, title_ja, title_en, description_ja, description_en, position, release_type, release_at",
        )
        .eq("course_id", data.courseId)
        .eq("status", "published")
        .order("position"),
      supabase
        .from("lessons")
        .select(
          "id, module_id, title_ja, title_en, lesson_type, duration_seconds, position, is_preview",
        )
        .eq("status", "published")
        .order("position"),
    ]);
    if (stagesRes.error) throw new Error(stagesRes.error.message);
    if (modulesRes.error) throw new Error(modulesRes.error.message);
    if (lessonsRes.error) throw new Error(lessonsRes.error.message);
    return {
      stages: stagesRes.data ?? [],
      modules: modulesRes.data ?? [],
      lessons: lessonsRes.data ?? [],
    };
  });
