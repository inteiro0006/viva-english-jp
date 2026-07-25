import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCourseProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("get_course_progress", {
      _uid: context.userId,
      _course_id: data.courseId,
    });
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const getNextLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: lessonId, error } = await context.supabase.rpc("get_next_lesson", {
      _uid: context.userId,
      _course_id: data.courseId,
    });
    if (error) throw new Error(error.message);
    return lessonId as string | null;
  });

export const upsertLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lessonId: z.string().uuid(),
        progressSeconds: z.number().int().min(0),
        progressPercentage: z.number().min(0).max(100),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: context.userId,
          lesson_id: data.lessonId,
          progress_seconds: data.progressSeconds,
          progress_percentage: data.progressPercentage,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
