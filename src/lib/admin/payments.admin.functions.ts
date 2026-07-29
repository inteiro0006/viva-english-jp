import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";

import type { Database } from "@/integrations/supabase/types";

export type PaymentEventRow = Database["public"]["Tables"]["payment_events"]["Row"] & {
  order_id: string | null;
  user_id: string | null;
  course_id: string | null;
};

function extractMetadata(payload: any): {
  orderId: string | null;
  userId: string | null;
  courseId: string | null;
} {
  const obj = payload?.data?.object ?? {};
  const meta = obj?.metadata ?? {};
  return {
    orderId: (meta.orderId as string) ?? null,
    userId: (meta.userId as string) ?? null,
    courseId: (meta.courseId as string) ?? null,
  };
}

export const listPaymentEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "processed", "failed", "pending"]).default("all"),
        eventType: z.string().max(120).optional(),
        search: z.string().max(200).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 25;
    let q = context.supabase
      .from("payment_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);

    if (data.status === "processed") q = q.eq("processed", true);
    else if (data.status === "failed")
      q = q.eq("processed", false).not("processing_error", "is", null);
    else if (data.status === "pending")
      q = q.eq("processed", false).is("processing_error", null);

    if (data.eventType) q = q.eq("event_type", data.eventType);
    if (data.search) q = q.ilike("provider_event_id", `%${data.search}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const enriched: PaymentEventRow[] = (rows ?? []).map((r) => {
      const md = extractMetadata(r.payload);
      return {
        ...r,
        order_id: md.orderId,
        user_id: md.userId,
        course_id: md.courseId,
      };
    });

    // KPI counters (all-time; cheap on this table).
    const [{ count: total }, { count: processed }, { count: pending }, failedRes] =
      await Promise.all([
        context.supabase
          .from("payment_events")
          .select("*", { count: "exact", head: true }),
        context.supabase
          .from("payment_events")
          .select("*", { count: "exact", head: true })
          .eq("processed", true),
        context.supabase
          .from("payment_events")
          .select("*", { count: "exact", head: true })
          .eq("processed", false)
          .is("processing_error", null),
        context.supabase
          .from("payment_events")
          .select("*", { count: "exact", head: true })
          .eq("processed", false)
          .not("processing_error", "is", null),
      ]);

    // Distinct event types for filter.
    const { data: typeRows } = await context.supabase
      .from("payment_events")
      .select("event_type")
      .order("event_type", { ascending: true })
      .limit(500);
    const eventTypes = Array.from(
      new Set((typeRows ?? []).map((t) => t.event_type)),
    );

    return {
      rows: enriched,
      total: count ?? 0,
      pageSize,
      kpis: {
        total: total ?? 0,
        processed: processed ?? 0,
        pending: pending ?? 0,
        failed: failedRes.count ?? 0,
      },
      eventTypes,
    };
  });

export const getPaymentEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("payment_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");

    const md = extractMetadata(row.payload);
    let order = null;
    let enrollment = null;
    let user: { id: string; full_name: string | null } | null = null;

    if (md.orderId) {
      const { data: o } = await context.supabase
        .from("orders")
        .select("id, status, amount, currency, paid_at, provider_payment_id, user_id, course_id, customer_email")
        .eq("id", md.orderId)
        .maybeSingle();
      order = o ?? null;
    }
    if (md.userId && md.courseId) {
      const { data: e } = await context.supabase
        .from("enrollments")
        .select("id, status, created_at, expires_at, order_id")
        .eq("user_id", md.userId)
        .eq("course_id", md.courseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      enrollment = e ?? null;
    }
    if (md.userId) {
      const { data: p } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", md.userId)
        .maybeSingle();
      user = p ?? null;
    }

    return { event: row, metadata: md, order, enrollment, user };
  });

export const reprocessPaymentEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("payment_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");

    const { dispatchStripeEvent, getStripeAdminClient } = await import(
      "@/lib/payments/stripe-handlers.server"
    );
    const admin = getStripeAdminClient();
    const payload = row.payload as any;

    let handled = false;
    let processingError: string | null = null;
    try {
      const res = await dispatchStripeEvent({
        type: row.event_type,
        data: payload?.data ?? { object: payload },
      });
      handled = res.handled;
    } catch (err) {
      processingError = err instanceof Error ? err.message : String(err);
    }

    await admin
      .from("payment_events")
      .update({
        processed: !processingError,
        processing_error: processingError,
      })
      .eq("id", row.id);

    await logAdminAction(context.supabase, {
      action: "payment_event.reprocess",
      entityType: "payment_event",
      entityId: row.id,
      oldValues: {
        processed: row.processed,
        processing_error: row.processing_error,
      },
      newValues: {
        processed: !processingError,
        processing_error: processingError,
        handled,
      },
      summary: `Reprocessed ${row.event_type} (${row.provider_event_id})`,
    });

    if (processingError) throw new Error(processingError);
    return { ok: true, handled };
  });

export const manualEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        courseId: z.string().uuid(),
        orderId: z.string().uuid().optional(),
        markOrderPaid: z.boolean().default(false),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getStripeAdminClient } = await import(
      "@/lib/payments/stripe-handlers.server"
    );
    const admin = getStripeAdminClient();

    const { data: existing } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", data.userId)
      .eq("course_id", data.courseId)
      .eq("status", "active")
      .limit(1);

    if (existing && existing.length > 0) {
      await logAdminAction(context.supabase, {
        action: "enrollment.manual_create",
        entityType: "enrollment",
        entityId: existing[0].id,
        newValues: { skipped: "already_active", ...data },
        summary: data.note ?? "Manual enrollment skipped (already active)",
      });
      return { ok: true, alreadyActive: true, enrollmentId: existing[0].id };
    }

    const { data: inserted, error } = await admin
      .from("enrollments")
      .insert({
        user_id: data.userId,
        course_id: data.courseId,
        order_id: data.orderId ?? null,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.orderId && data.markOrderPaid) {
      await admin
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", data.orderId);
    }

    await logAdminAction(context.supabase, {
      action: "enrollment.manual_create",
      entityType: "enrollment",
      entityId: inserted.id,
      newValues: { ...data },
      summary:
        data.note ??
        `Manual enrollment for user ${data.userId} in course ${data.courseId}`,
    });

    return { ok: true, alreadyActive: false, enrollmentId: inserted.id };
  });
