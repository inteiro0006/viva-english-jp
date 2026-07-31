// SERVER-ONLY checkout logic. Never import from client-reachable modules at
// module scope — always `await import()` inside a handler.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import {
  CHECKOUT_COURSE_SLUG,
  COURSE_PRICE_LOOKUP_KEY,
  getCheckoutReturnUrl,
  resolvePaymentEnvironment,
} from "./payments.config.server";
import type { CheckoutErrorCode, CheckoutResult } from "./checkout.functions";

let _admin: SupabaseClient<Database> | null = null;
function admin(): SupabaseClient<Database> {
  if (!_admin) {
    _admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

function fail(code: CheckoutErrorCode, detail?: unknown): CheckoutResult {
  if (detail) console.error(`[checkout] ${code}:`, detail);
  return { error: code };
}

async function resolveCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      return c.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export async function createCheckoutSessionForUser(args: {
  userId: string;
  email?: string;
}): Promise<CheckoutResult> {
  const { userId, email } = args;

  let environment: "sandbox" | "live";
  let returnUrl: string;
  try {
    environment = resolvePaymentEnvironment();
    returnUrl = getCheckoutReturnUrl();
  } catch (err) {
    return fail("not_configured", err);
  }

  const db = admin();

  // Course is resolved server-side; only published courses can be sold.
  const { data: course, error: courseErr } = await db
    .from("courses")
    .select("id, slug, status")
    .eq("slug", CHECKOUT_COURSE_SLUG)
    .eq("status", "published")
    .maybeSingle();
  if (courseErr) return fail("course_unavailable", courseErr.message);
  if (!course) return fail("course_unavailable");

  // Block duplicate purchase.
  const { data: active, error: enrollErr } = await db
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .eq("status", "active")
    .limit(1);
  if (enrollErr) return fail("order_failed", enrollErr.message);
  if (active && active.length > 0) return { error: "already_enrolled" };

  try {
    const stripe = createStripeClient(environment);

    const prices = await stripe.prices.list({
      lookup_keys: [COURSE_PRICE_LOOKUP_KEY],
      active: true,
    });
    if (!prices.data.length) return fail("price_unavailable");
    const price = prices.data[0];
    const amount = price.unit_amount ?? 0;
    const currency = (price.currency ?? "jpy").toLowerCase();
    if (amount <= 0) return fail("price_unavailable");

    // Reuse a still-open pending order/session instead of leaking abandoned
    // Checkout sessions on every page load.
    const { data: pending } = await db
      .from("orders")
      .select("id, provider_checkout_id, amount, currency")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("status", "pending")
      .eq("environment", environment)
      .eq("amount", amount)
      .eq("currency", currency)
      .not("provider_checkout_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.provider_checkout_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(pending.provider_checkout_id);
        if (existing.status === "open" && existing.client_secret) {
          return { clientSecret: existing.client_secret };
        }
      } catch (err) {
        console.warn("[checkout] could not reuse pending session", err);
      }
    }

    const customerId = await resolveCustomer(stripe, { email, userId });

    // Pending order first: it is the reconciliation source of truth.
    const { data: order, error: orderErr } = await db
      .from("orders")
      .insert({
        user_id: userId,
        course_id: course.id,
        amount,
        currency,
        customer_email: email ?? null,
        provider: "stripe",
        environment,
        status: "pending",
      })
      .select("id")
      .single();
    if (orderErr || !order) return fail("order_failed", orderErr?.message);

    const session = await stripe.checkout.sessions.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        payment_intent_data: {
          description: "Eigo Academy",
          metadata: { userId, courseId: course.id, orderId: order.id, environment },
        },
        metadata: { userId, courseId: course.id, orderId: order.id, environment },
      },
      { idempotencyKey: `checkout:${order.id}` },
    );

    const { error: updateErr } = await db
      .from("orders")
      .update({ provider_checkout_id: session.id })
      .eq("id", order.id);
    if (updateErr) return fail("order_failed", updateErr.message);

    if (!session.client_secret) return fail("checkout_failed");
    return { clientSecret: session.client_secret };
  } catch (error) {
    return fail("checkout_failed", getStripeErrorMessage(error));
  }
}
