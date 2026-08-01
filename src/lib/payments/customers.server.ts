// SERVER-ONLY: Stripe customer ownership.
//
// A Stripe Customer is bound to a Supabase user through `payment_customers`.
// E-mail is NEVER treated as proof of ownership: two accounts can share or
// reuse an address, and inheriting an old Customer that way would leak
// payment history between users.
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PaymentEnvironment } from "./payments.config.server";

export async function resolveCustomerForUser(args: {
  stripe: Stripe;
  db: SupabaseClient<Database>;
  userId: string;
  environment: PaymentEnvironment;
  email?: string;
}): Promise<string> {
  const { stripe, db, userId, environment, email } = args;
  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) throw new Error("invalid_user_id");

  const { data: mapped, error: mapErr } = await db
    .from("payment_customers")
    .select("provider_customer_id")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .eq("environment", environment)
    .maybeSingle();
  if (mapErr) throw new Error(mapErr.message);

  if (mapped?.provider_customer_id) {
    // Confirm the customer still exists in this environment before reusing it.
    try {
      const existing = await stripe.customers.retrieve(mapped.provider_customer_id);
      if (!("deleted" in existing) || !existing.deleted) return existing.id;
    } catch (err) {
      console.warn("[payments] mapped Stripe customer unusable, recreating", err);
    }
  }

  const created = await stripe.customers.create(
    {
      ...(email ? { email } : {}),
      metadata: { userId, environment },
    },
    // Stable key: one Customer per user per environment, even if the request
    // is retried after an indeterminate network failure.
    { idempotencyKey: `customer:${environment}:${userId}` },
  );

  const { error: upsertErr } = await db.from("payment_customers").upsert(
    {
      user_id: userId,
      provider: "stripe",
      environment,
      provider_customer_id: created.id,
    },
    { onConflict: "user_id,provider,environment" },
  );
  if (upsertErr) throw new Error(upsertErr.message);

  return created.id;
}
