// SERVER-ONLY: performs real Stripe refund API calls.
// Never import this from client-reachable module scope — load it inside a handler.
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

export type RefundResult = {
  refundId: string;
  status: string | null;
  amount: number;
  currency: string;
  paymentIntentId: string;
};

/**
 * Creates a refund on Stripe for the given payment intent.
 * Omit `amount` for a full refund; pass a positive integer (minor units) for a partial one.
 */
export async function createStripeRefund(params: {
  environment: StripeEnv;
  paymentIntentId: string;
  amount?: number;
  reason?: string;
  orderId: string;
}): Promise<RefundResult> {
  const stripe = createStripeClient(params.environment);
  try {
    const refund = await stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      ...(params.amount ? { amount: params.amount } : {}),
      metadata: {
        orderId: params.orderId,
        ...(params.reason ? { adminReason: params.reason.slice(0, 400) } : {}),
      },
    });
    return {
      refundId: refund.id,
      status: refund.status ?? null,
      amount: refund.amount,
      currency: refund.currency,
      paymentIntentId: params.paymentIntentId,
    };
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}
