import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin/require-admin";

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entityType: z.string().optional(),
        action: z.string().optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 50;
    let q = context.supabase
      .from("admin_audit_logs")
      .select("*, profiles:admin_id(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, pageSize };
  });
