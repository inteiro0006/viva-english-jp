import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";
import { courseInputSchema } from "@/lib/admin/schemas";

export const listAdminCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("courses")
      .select("*")
      .order("position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAdminCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: course, error } = await context.supabase
      .from("courses")
      .select("*, course_stages(*), modules(*, lessons(*))")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return course;
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => courseInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: inserted, error } = await context.supabase
      .from("courses")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "course.create",
      entityType: "course",
      entityId: inserted.id,
      newValues: data,
    });
    return inserted;
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), patch: courseInputSchema.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("courses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { data: updated, error } = await context.supabase
      .from("courses")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "course.update",
      entityType: "course",
      entityId: data.id,
      oldValues: prev,
      newValues: updated,
    });
    return updated;
  });

export const duplicateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: source, error: srcErr } = await context.supabase
      .from("courses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (srcErr || !source) throw new Error(srcErr?.message ?? "not_found");
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      slug,
      title_ja,
      title_en,
      ...rest
    } = source;
    const suffix = `-copy-${Date.now().toString(36)}`;
    const { data: copy, error } = await context.supabase
      .from("courses")
      .insert({
        ...rest,
        slug: `${slug}${suffix}`.slice(0, 80),
        title_ja: `${title_ja} (copy)`,
        title_en: `${title_en} (copy)`,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "course.duplicate",
      entityType: "course",
      entityId: copy.id,
      oldValues: { source_id: data.id },
      newValues: { new_id: copy.id },
    });
    return copy;
  });

export const setCourseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published", "archived"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: updated, error } = await context.supabase
      .from("courses")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: `course.${data.status}`,
      entityType: "course",
      entityId: data.id,
      newValues: { status: data.status },
    });
    return updated;
  });

// NOTE: `courses` table has no `position` column in the current schema;
// custom ordering will require a schema change. Placeholder omitted intentionally.
