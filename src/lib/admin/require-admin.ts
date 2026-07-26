import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Assert that the caller is an admin. Call this at the top of every admin
 * server function handler, AFTER `.middleware([requireSupabaseAuth])`.
 *
 * Uses the has_role() SECURITY DEFINER function; RLS is not enough because
 * some admin operations touch tables where reads may pass but writes must
 * still be gated.
 */
export async function assertAdmin(ctx: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

/** Fire-and-forget audit log entry. Failures are logged, not thrown. */
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  params: {
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValues?: unknown;
    newValues?: unknown;
  },
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_admin_action", {
      _action: params.action,
      _entity_type: params.entityType,
      _entity_id: params.entityId ?? "",
      _old_values: (params.oldValues ?? null) as never,
      _new_values: (params.newValues ?? null) as never,
    });
    if (error) console.error("[admin-audit] failed", error.message);
  } catch (err) {
    console.error("[admin-audit] failed", err);
  }
}
