import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

/**
 * Assert that the caller is an admin. Call this at the top of every admin
 * server function handler, AFTER `.middleware([requireSupabaseAuth])`.
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

/** Sensitive fields never captured in diff snapshots (defense-in-depth). */
const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "email",
  "customer_email",
  "provider_payment_id",
  "provider_checkout_id",
  "attachment_url",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function redact(v: unknown): unknown {
  if (!isPlainObject(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    out[k] = REDACTED_KEYS.has(k) ? "«redacted»" : val;
  }
  return out;
}

/**
 * Shallow diff of two records. Returns { field: { from, to } } for keys that
 * differ between old and new values (ignoring created_at/updated_at noise).
 */
export function diffRecords(
  oldValues: unknown,
  newValues: unknown,
): Record<string, { from: unknown; to: unknown }> | null {
  if (!isPlainObject(oldValues) && !isPlainObject(newValues)) return null;
  const a = isPlainObject(oldValues) ? oldValues : {};
  const b = isPlainObject(newValues) ? newValues : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const skip = new Set(["created_at", "updated_at"]);
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    if (skip.has(k)) continue;
    const before = a[k];
    const after = b[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[k] = {
        from: REDACTED_KEYS.has(k) ? "«redacted»" : before,
        to: REDACTED_KEYS.has(k) ? "«redacted»" : after,
      };
    }
  }
  return Object.keys(diff).length ? diff : null;
}

function extractRequestMeta(): { ip: string | null; ua: string | null } {
  try {
    const req = getRequest();
    const headers = req?.headers;
    if (!headers) return { ip: null, ua: null };
    const fwd = headers.get("x-forwarded-for");
    const ip =
      (fwd ? fwd.split(",")[0].trim() : null) ||
      headers.get("cf-connecting-ip") ||
      headers.get("x-real-ip") ||
      null;
    const ua = headers.get("user-agent");
    return { ip, ua: ua ? ua.slice(0, 500) : null };
  } catch {
    return { ip: null, ua: null };
  }
}

/**
 * Fire-and-forget audit entry. Computes a shallow diff, redacts sensitive
 * fields, and captures IP + user-agent from the current request.
 */
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  params: {
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValues?: unknown;
    newValues?: unknown;
    summary?: string;
  },
): Promise<void> {
  try {
    const changed = diffRecords(params.oldValues, params.newValues);
    const { ip, ua } = extractRequestMeta();
    const { error } = await supabase.rpc("log_admin_action", {
      _action: params.action,
      _entity_type: params.entityType,
      _entity_id: params.entityId ?? "",
      _old_values: (redact(params.oldValues) ?? null) as never,
      _new_values: (redact(params.newValues) ?? null) as never,
      _changed_fields: (changed ?? null) as never,
      _summary: (params.summary ?? null) as never,
      _ip_address: (ip ?? null) as never,
      _user_agent: (ua ?? null) as never,
    });
    if (error) console.error("[admin-audit] failed", error.message);
  } catch (err) {
    console.error("[admin-audit] failed", err);
  }
}
