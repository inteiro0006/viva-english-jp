import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";
import { moduleInputSchema } from "@/lib/admin/schemas";

export const listAdminModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("modules")
      .select("*, courses(id, title_ja, title_en, slug)")
      .order("position", { ascending: true });
    if (data.courseId) q = q.eq("course_id", data.courseId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => moduleInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: inserted, error } = await context.supabase
      .from("modules")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "module.create",
      entityType: "module",
      entityId: inserted.id,
      newValues: data,
    });
    return inserted;
  });

export const updateModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), patch: moduleInputSchema.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("modules")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { data: updated, error } = await context.supabase
      .from("modules")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "module.update",
      entityType: "module",
      entityId: data.id,
      oldValues: prev,
      newValues: updated,
    });
    return updated;
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("modules")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "module.delete",
      entityType: "module",
      entityId: data.id,
      oldValues: prev,
    });
    return { ok: true };
  });

export const reorderModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ courseId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("modules")
        .update({ position: i })
        .eq("id", data.ids[i])
        .eq("course_id", data.courseId);
      if (error) throw new Error(error.message);
    }
    await logAdminAction(context.supabase, {
      action: "module.reorder",
      entityType: "course",
      entityId: data.courseId,
      newValues: { order: data.ids },
    });
    return { ok: true };
  });
