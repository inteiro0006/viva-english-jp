import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_URL } from "@/config/site";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "料金プラン — Eigo Michi" },
      {
        name: "description",
        content:
          "一度きりのお支払いで、Eigo Michi の全レッスンに生涯アクセス。追加費用や月額課金はありません。",
      },
      { property: "og:title", content: "料金プラン — Eigo Michi" },
      {
        property: "og:description",
        content: "一度きりのお支払いで、全レッスンに生涯アクセス。",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/pricing` },
      { property: "og:locale", content: "ja_JP" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/pricing` },
      { rel: "alternate", hreflang: "ja", href: `${SITE_URL}/pricing?lang=ja` },
      { rel: "alternate", hreflang: "en", href: `${SITE_URL}/pricing?lang=en` },
      { rel: "alternate", hreflang: "x-default", href: `${SITE_URL}/pricing` },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { t } = useTranslation();
  const perks = [
    t("landing.benefits.items.method.title"),
    t("landing.benefits.items.pace.title"),
    t("landing.benefits.items.support.title"),
  ];
  return (
    <PublicLayout>
      <section className="mx-auto w-full max-w-4xl px-4 py-16">
        <header className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{t("pricing.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("pricing.subtitle")}</p>
        </header>
        <Card className="mt-10">
          <CardContent className="flex flex-col gap-6 py-8">
            <div>
              <h2 className="text-2xl font-semibold">{t("pricing.planTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("pricing.planDesc")}</p>
            </div>
            <ul className="grid gap-2">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-[color:var(--brand)]" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/checkout">{t("pricing.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
