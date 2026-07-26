import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";
import { lessonInputSchema } from "@/lib/admin/schemas";

export const listAdminLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        moduleId: z.string().uuid().optional(),
        courseId: z.string().uuid().optional(),
        search: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("lessons")
      .select("*, modules(id, course_id, title_ja, title_en, courses(id, title_ja, title_en))")
      .order("position", { ascending: true });
    if (data.moduleId) q = q.eq("module_id", data.moduleId);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) q = q.ilike("title_ja", `%${data.search}%`);
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    let out = rows ?? [];
    if (data.courseId) {
      out = out.filter((l: { modules: { course_id: string } | null }) =>
        l.modules?.course_id === data.courseId,
      );
    }
    return out;
  });

export const createLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => lessonInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: inserted, error } = await context.supabase
      .from("lessons")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "lesson.create",
      entityType: "lesson",
      entityId: inserted.id,
      newValues: data,
    });
    return inserted;
  });

export const updateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), patch: lessonInputSchema.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("lessons")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { data: updated, error } = await context.supabase
      .from("lessons")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "lesson.update",
      entityType: "lesson",
      entityId: data.id,
      oldValues: prev,
      newValues: updated,
    });
    return updated;
  });

export const setLessonPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: updated, error } = await context.supabase
      .from("lessons")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: `lesson.${data.status}`,
      entityType: "lesson",
      entityId: data.id,
      newValues: { status: data.status },
    });
    return updated;
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("lessons")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "lesson.delete",
      entityType: "lesson",
      entityId: data.id,
      oldValues: prev,
    });
    return { ok: true };
  });

export const reorderLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ moduleId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("lessons")
        .update({ position: i })
        .eq("id", data.ids[i])
        .eq("module_id", data.moduleId);
      if (error) throw new Error(error.message);
    }
    await logAdminAction(context.supabase, {
      action: "lesson.reorder",
      entityType: "module",
      entityId: data.moduleId,
      newValues: { order: data.ids },
    });
    return { ok: true };
  });
