import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const COURSE_PRICE_LOOKUP_KEY = "eigo_academy_onetime";
const COURSE_SLUG = "eigo-mastery";

type CheckoutResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
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

export const createCourseCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        returnUrl: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const env: StripeEnv = data.environment;
    const { supabase, userId } = context;

    // Resolve the course.
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title_ja, title_en")
      .eq("slug", COURSE_SLUG)
      .eq("status", "published")
      .maybeSingle();
    if (courseErr || !course) return { error: "Course unavailable" };

    // Block duplicate purchase.
    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("status", "active")
      .limit(1);
    if (existing && existing.length > 0) {
      return { error: "already_enrolled" };
    }

    // Get email from auth session.
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? undefined;

    try {
      const stripe = createStripeClient(env);

      const prices = await stripe.prices.list({ lookup_keys: [COURSE_PRICE_LOOKUP_KEY] });
      if (!prices.data.length) return { error: "Price not configured" };
      const price = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      // Create pending order first (source of truth for later reconciliation).
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          course_id: course.id,
          amount: (price.unit_amount ?? 0),
          currency: (price.currency ?? "jpy").toLowerCase(),
          customer_email: email ?? null,
          provider: "stripe",
          status: "pending",
        })
        .select("id")
        .single();
      if (orderErr || !order) return { error: "Could not create order" };

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        payment_intent_data: {
          description: "Eigo Academy",
          metadata: {
            userId,
            courseId: course.id,
            orderId: order.id,
          },
        },
        metadata: {
          userId,
          courseId: course.id,
          orderId: order.id,
        },
      });

      await supabase
        .from("orders")
        .update({ provider_checkout_id: session.id })
        .eq("id", order.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getCheckoutOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sessionId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, status, course_id, courses(slug)")
      .eq("provider_checkout_id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return order;
  });
