import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Clock, MessageCircle } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { t } = useTranslation();

  const benefits = [
    { key: "method", icon: BookOpen },
    { key: "pace", icon: Clock },
    { key: "support", icon: MessageCircle },
  ] as const;

  const stages = [1, 2, 3, 4, 5, 6];

  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <span className="size-1.5 rounded-full bg-[color:var(--brand)]" />
              {t("brand.tagline")}
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("landing.heroTitle")}
              <span className="mt-2 block">
                <span className="bg-[color:var(--highlight)]/25 px-2 py-0.5 text-[color:var(--foreground)]">
                  {t("landing.heroHighlight")}
                </span>
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  {t("landing.cta")}
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/course">{t("common.learnMore")}</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[color:var(--brand)]/10 via-transparent to-[color:var(--highlight)]/10" />
            <div className="grid gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {t("student.progress")}
                </span>
                <span className="text-sm text-muted-foreground">0 / 120</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[8%] rounded-full bg-[color:var(--brand)]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {stages.slice(0, 3).map((n) => (
                  <div
                    key={n}
                    className="aspect-square rounded-xl bg-[color:var(--brand)]/10 p-3 text-3xl font-bold text-[color:var(--brand)]"
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            {t("landing.benefits.title")}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {benefits.map((b) => (
              <Card key={b.key}>
                <CardContent className="flex flex-col gap-3 py-6">
                  <b.icon className="size-6 text-[color:var(--brand)]" aria-hidden />
                  <h3 className="text-lg font-semibold">
                    {t(`landing.benefits.items.${b.key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`landing.benefits.items.${b.key}.desc`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              {t("landing.stages.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("landing.stages.subtitle")}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {stages.map((n) => (
              <div
                key={n}
                className="flex aspect-square flex-col justify-between rounded-2xl border border-border bg-card p-4"
              >
                <span className="text-4xl font-bold text-[color:var(--brand)]">
                  {n}
                </span>
                <span className="text-xs text-muted-foreground">
                  Stage {n}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-[color:var(--brand)] text-[color:var(--brand-foreground)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            {t("landing.finalCta.title")}
          </h2>
          <p className="max-w-2xl opacity-90">
            {t("landing.finalCta.subtitle")}
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-2">
            <Link to="/pricing">{t("landing.finalCta.action")}</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
