import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"]).optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 25;
    let q = context.supabase
      .from("orders")
      .select("*, courses(title_ja, title_en, slug)", { count: "exact" })
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
      .select("*, courses(title_ja, title_en, slug)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let orderWithProfile = order as
      | (typeof order & { profiles: { full_name: string | null } | null })
      | null;
    if (order?.user_id) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", order.user_id)
        .maybeSingle();
      orderWithProfile = { ...order, profiles: prof ?? null } as typeof orderWithProfile;
    }
    // Events are linked through the Stripe object metadata written at checkout.
    const { data: events, error: eventsErr } = order
      ? await context.supabase
          .from("payment_events")
          .select("*")
          .eq("environment", order.environment)
          .filter("payload->data->object->metadata->>orderId", "eq", order.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [], error: null };
    if (eventsErr) throw new Error(eventsErr.message);
    return { order: orderWithProfile, events: events ?? [] };
  });

/**
 * initiateRefund
 * Calls the Stripe refund API for a paid order (full or partial) and audits it.
 *
 * Double-refund safety has three layers:
 *  1. an in-flight `refund_requests` row for the same order short-circuits a
 *     duplicate click (the key is per REQUEST, so two legitimate partial
 *     refunds of the same amount are still possible later);
 *  2. that request id is sent to Stripe as its idempotency key, so a retried
 *     network call resolves to the same Stripe refund;
 *  3. the refundable balance is recomputed from Stripe before requesting.
 * Order/enrollment status is settled by the refund webhooks, which remain the
 * single source of truth for fulfillment state.
 */
export const initiateRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().max(500).optional(),
        amount: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !order) throw new Error("not_found");
    if (order.status !== "paid" && order.status !== "partially_refunded") {
      throw new Error("only_paid_orders_refundable");
    }
    if (!order.provider_payment_id) throw new Error("missing_payment_intent");

    const environment = order.environment === "live" ? "live" : "sandbox";
    const { createStripeRefund, getRefundedTotal } = await import("@/lib/payments/refunds.server");
    const { assertRefundAmount, refundIdempotencyKey, refundableBalance } =
      await import("@/lib/payments/order-state");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authoritative refundable balance straight from Stripe.
    const { charged, refunded } = await getRefundedTotal(environment, order.provider_payment_id);
    const remaining = refundableBalance(charged, refunded);
    if (remaining <= 0) throw new Error("already_fully_refunded");
    const requestedAmount = data.amount ?? remaining;
    try {
      assertRefundAmount(requestedAmount, charged, refunded);
    } catch {
      throw new Error("amount_exceeds_refundable");
    }

    // A refund already being processed for this order blocks a duplicate click
    // without collapsing two legitimate refunds of the same value.
    const { data: inFlight, error: inFlightErr } = await supabaseAdmin
      .from("refund_requests")
      .select("id, status, provider_refund_id, requested_amount")
      .eq("order_id", order.id)
      .in("status", ["requested", "processing"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (inFlightErr) throw new Error(inFlightErr.message);
    if (inFlight && inFlight.length > 0 && inFlight[0].provider_refund_id) {
      return {
        ok: true,
        pending: true,
        refundId: inFlight[0].provider_refund_id,
        amount: inFlight[0].requested_amount,
        note: "already_in_flight" as string | null,
      };
    }

    // One request row == one Stripe idempotency key.
    const requestId = inFlight?.[0]?.id ?? crypto.randomUUID();
    const idempotencyKey = refundIdempotencyKey(order.id, requestId);

    if (!inFlight || inFlight.length === 0) {
      const { error: reqErr } = await supabaseAdmin.from("refund_requests").insert({
        id: requestId,
        order_id: order.id,
        environment,
        requested_amount: requestedAmount,
        currency: order.currency,
        reason: data.reason ?? null,
        requested_by: context.userId,
        idempotency_key: idempotencyKey,
        status: "processing",
      });
      if (reqErr) throw new Error("refund_request_failed");
    }

    let refund;
    try {
      refund = await createStripeRefund({
        environment,
        paymentIntentId: order.provider_payment_id,
        // Full refunds omit the amount so Stripe refunds the exact remainder.
        amount: requestedAmount === remaining ? undefined : requestedAmount,
        reason: data.reason,
        orderId: order.id,
        idempotencyKey,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "refund_failed";
      await supabaseAdmin
        .from("refund_requests")
        .update({ status: "failed", processing_error: message.slice(0, 500) })
        .eq("id", requestId);
      await logAdminAction(context.supabase, {
        action: "order.refund_failed",
        entityType: "order",
        entityId: order.id,
        oldValues: { status: order.status },
        newValues: {
          error: message,
          amount: requestedAmount,
          reason: data.reason ?? null,
        },
      });
      throw e;
    }

    const { error: settleErr } = await supabaseAdmin
      .from("refund_requests")
      .update({
        provider_refund_id: refund.refundId,
        status: refund.status === "succeeded" ? "succeeded" : "pending",
        processing_error: null,
      })
      .eq("id", requestId);
    // The refund exists on Stripe; a bookkeeping failure must be visible.
    if (settleErr) console.error("[refund] could not persist refund result:", settleErr.message);

    await logAdminAction(context.supabase, {
      action: "order.refunded",
      entityType: "order",
      entityId: order.id,
      oldValues: { status: order.status },
      newValues: {
        refund_id: refund.refundId,
        refund_status: refund.status,
        amount: refund.amount,
        currency: refund.currency,
        partial: requestedAmount < remaining,
        reason: data.reason ?? null,
      },
    });

    return {
      ok: true,
      pending: refund.status === "pending",
      refundId: refund.refundId,
      amount: refund.amount,
      note: null as string | null,
    };
  });
