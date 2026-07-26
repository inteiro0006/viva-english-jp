import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";

export const listSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("platform_settings")
      .select("*")
      .order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1), value: z.unknown() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("platform_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    const { data: updated, error } = await context.supabase
      .from("platform_settings")
      .update({ value: data.value as never, updated_by: context.userId })
      .eq("key", data.key)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "setting.update",
      entityType: "setting",
      entityId: data.key,
      oldValues: prev?.value ?? null,
      newValues: data.value,
    });
    return updated;
  });
