import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Public, translatable error codes. Internal Stripe / Postgres messages are
 * logged on the server and never returned to the browser.
 */
export type CheckoutErrorCode =
  | "already_enrolled"
  | "course_unavailable"
  | "price_unavailable"
  | "order_failed"
  | "checkout_failed"
  | "not_configured";

export type CheckoutResult = { clientSecret: string } | { error: CheckoutErrorCode };

/**
 * Create (or reuse) the embedded Stripe Checkout session for the course.
 *
 * The client supplies NOTHING: user, course, price, currency, environment and
 * return URL are all resolved from the verified session and from server
 * configuration. The order row is written with the service role — end users
 * have SELECT-only access to `orders`.
 */
export const createCourseCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).optional().parse(data ?? {}))
  .handler(async ({ context }): Promise<CheckoutResult> => {
    const { createCheckoutSessionForUser } = await import("./checkout.server");
    return createCheckoutSessionForUser({
      userId: context.userId,
      email: context.claims?.email as string | undefined,
    });
  });

/** Read-only status poll for the success page (own orders only, via RLS). */
export const getCheckoutOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sessionId: z.string().min(1).max(255) }).parse(data))
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
