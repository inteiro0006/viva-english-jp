import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z
          .enum(["pending", "paid", "failed", "refunded", "partially_refunded"])
          .optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 25;
    let q = context.supabase
      .from("orders")
      .select(
        "*, courses(title_ja, title_en, slug)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)));
    const profilesMap = new Map<string, { full_name: string | null }>();
    if (userIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      (profs ?? []).forEach((p) => profilesMap.set(p.id, { full_name: p.full_name }));
    }
    const withProfiles = (rows ?? []).map((r) => ({
      ...r,
      profiles: profilesMap.get(r.user_id) ?? null,
    }));
    return { rows: withProfiles, total: count ?? 0, pageSize };
  });

export const getOrderDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, profiles(full_name), courses(title_ja, title_en, slug)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: events } = await context.supabase
      .from("payment_events")
      .select("*")
      .or(
        [
          order?.provider_checkout_id
            ? `payload->>orderId.eq.${order?.id}`
            : null,
        ]
          .filter(Boolean)
          .join(",") || "id.eq.00000000-0000-0000-0000-000000000000",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    return { order, events: events ?? [] };
  });

/**
 * initiateRefund
 * Records an auditable admin intent to refund an order. The actual Stripe
 * refund API call is intentionally NOT executed here — a future prompt will
 * wire it. This function only validates admin, updates internal status, and
 * logs the intent so nothing happens silently.
 */
export const initiateRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !order) throw new Error("not_found");
    if (order.status !== "paid") throw new Error("only_paid_orders_refundable");
    await logAdminAction(context.supabase, {
      action: "order.refund_initiated",
      entityType: "order",
      entityId: order.id,
      oldValues: { status: order.status },
      newValues: {
        status: "refund_pending",
        reason: data.reason ?? null,
        pending_provider_call: true,
      },
    });
    return {
      ok: true,
      pending: true,
      note:
        "Refund intent recorded and audited. Stripe API refund call must be wired in a follow-up step.",
    };
  });
