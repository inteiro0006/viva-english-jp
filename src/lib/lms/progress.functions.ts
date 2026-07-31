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

/**
 * Records watch position. The database derives the percentage from the real
 * lesson duration and owns the `completed` flag (>= 90% watched), so clients
 * cannot fake progress or unlock a certificate.
 */
export const upsertLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lessonId: z.string().uuid(),
        progressSeconds: z.number().int().min(0),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("record_lesson_progress", {
      _lesson_id: data.lessonId,
      _position_seconds: data.progressSeconds,
    });
    if (error) throw new Error(error.message);
    return rows?.[0] ?? { ok: true };
  });
