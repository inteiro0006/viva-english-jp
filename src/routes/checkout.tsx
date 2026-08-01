import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, isPaymentsConfigured } from "@/lib/stripe";
import { createCourseCheckoutSession, getCoursePrice } from "@/lib/payments/checkout.functions";
import { COURSE_PRICE_JPY, formatJpy } from "@/config/site";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "お支払い — Eigo Academy" },
      { name: "description", content: "Secure checkout for Eigo Academy." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Display price comes from Stripe (source of truth); the static config value
  // is only a fallback while the request is in flight.
  const [livePrice, setLivePrice] = useState<{ amount: number; currency: string } | null>(null);
  const priceLabel =
    livePrice && livePrice.currency === "jpy"
      ? formatJpy(livePrice.amount)
      : formatJpy(COURSE_PRICE_JPY);

  useEffect(() => {
    let mounted = true;
    getCoursePrice()
      .then((price) => {
        if (mounted && price) setLivePrice({ amount: price.amount, currency: price.currency });
      })
      .catch(() => {
        /* falls back to the configured display price */
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/register", search: { redirect: "/checkout" } as never });
        return;
      }
      setAuthed(true);
      setAuthChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const fetchClientSecret = useMemo(() => {
    return async (): Promise<string> => {
      // No client-supplied data: user, course, price, currency, environment
      // and return URL are all resolved server-side.
      const result = await createCourseCheckoutSession({
        data: { origin: window.location.origin },
      });
      if ("error" in result) {
        if (result.error === "already_enrolled") {
          navigate({ to: "/student/dashboard" });
          throw new Error(t("checkout.alreadyEnrolled"));
        }
        throw new Error(t(`checkout.errors.${result.error}`));
      }
      if (!result.clientSecret) throw new Error(t("checkout.errors.checkout_failed"));
      return result.clientSecret;
    };
  }, [navigate, t]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (!isPaymentsConfigured()) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-16">
          <Alert variant="destructive">
            <AlertDescription>{t("checkout.notConfigured")}</AlertDescription>
          </Alert>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PaymentTestModeBanner />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_1.1fr]">
        <aside className="space-y-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {t("checkout.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("checkout.subtitle")}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("checkout.productLabel")}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold">
                  {t("checkout.productName")}
                </h2>
              </div>
              {priceLabel ? (
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">{priceLabel}</p>
                  <p className="text-xs text-muted-foreground">{t("checkout.oneTimePayment")}</p>
                </div>
              ) : null}
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {(t("checkout.included", { returnObjects: true }) as string[]).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-[color:var(--brand)]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-[color:var(--brand)]"
                aria-hidden
              />
              <span>{t("checkout.trustSecure")}</span>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles
                className="mt-0.5 size-4 shrink-0 text-[color:var(--highlight)]"
                aria-hidden
              />
              <span>{t("checkout.trustInstant")}</span>
            </div>
          </div>
        </aside>

        <section aria-labelledby="checkout-form-heading">
          <h2 id="checkout-form-heading" className="sr-only">
            {t("checkout.formHeading")}
          </h2>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!authChecked || !authed ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div id="checkout" className="overflow-hidden rounded-2xl border border-border bg-card">
              <ErrorBoundary onError={setError}>
                <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </ErrorBoundary>
            </div>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}

// Minimal error boundary to surface fetchClientSecret failures.
import * as React from "react";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (msg: string) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
