import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin/require-admin";
import type { Json } from "@/integrations/supabase/types";

export type AuditLogRow = {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  changed_fields: Json | null;
  old_values: Json | null;
  new_values: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        action: z.string().optional(),
        adminId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 50;
    let q = context.supabase
      .from("admin_audit_logs")
      .select(
        "id, admin_id, action, entity_type, entity_id, summary, changed_fields, old_values, new_values, ip_address, user_agent, created_at, profiles:admin_id(full_name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.entityId) q = q.eq("entity_id", data.entityId);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.adminId) q = q.eq("admin_id", data.adminId);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const mapped: AuditLogRow[] = (rows ?? []).map((r) => {
      const rec = r as unknown as {
        id: string;
        admin_id: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        summary: string | null;
        changed_fields: Json | null;
        old_values: Json | null;
        new_values: Json | null;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
        profiles: { full_name: string } | null;
      };
      return {
        id: rec.id,
        admin_id: rec.admin_id,
        admin_name: rec.profiles?.full_name ?? null,
        action: rec.action,
        entity_type: rec.entity_type,
        entity_id: rec.entity_id,
        summary: rec.summary,
        changed_fields: rec.changed_fields ?? null,
        old_values: rec.old_values ?? null,
        new_values: rec.new_values ?? null,
        ip_address: rec.ip_address ? String(rec.ip_address) : null,
        user_agent: rec.user_agent,
        created_at: rec.created_at,
      };
    });
    return { rows: mapped, total: count ?? 0, pageSize };
  });

/** List distinct admin actors that appear in the audit log (for filter dropdown). */
export const listAuditAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_audit_logs")
      .select("admin_id, profiles:admin_id(full_name)")
      .not("admin_id", "is", null)
      .limit(500);
    if (error) throw new Error(error.message);
    const seen = new Map<string, string>();
    for (const r of data ?? []) {
      const rec = r as unknown as {
        admin_id: string | null;
        profiles: { full_name: string } | null;
      };
      if (rec.admin_id && !seen.has(rec.admin_id)) {
        seen.set(rec.admin_id, rec.profiles?.full_name ?? rec.admin_id.slice(0, 8));
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  });
