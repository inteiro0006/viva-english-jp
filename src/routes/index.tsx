import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Ear,
  Headphones,
  Laptop,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Mic2,
  Play,
  Rocket,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Type,
  UserPlus,
  X,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { COURSE_PRICE_JPY, formatJpy } from "@/config/site";
import { demoTestimonials } from "@/data/testimonials";

const SITE_URL = "https://viva-english-jp.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eigo Michi — 日本人のための本格英語オンライン講座" },
      {
        name: "description",
        content:
          "日本人学習者のために設計された、実践型オンライン英語コース。日本語のサポートで、仕事・旅行・日常で使える英語力を、自分のペースで身につけましょう。",
      },
      {
        property: "og:title",
        content: "Eigo Michi — 日本人のための本格英語オンライン講座",
      },
      {
        property: "og:description",
        content:
          "実践型オンライン英語コース。自分のペースで、仕事・旅行・日常で使える英語力を。",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:site_name", content: "Eigo Michi" },
      { property: "og:locale", content: "ja_JP" },
      { property: "og:locale:alternate", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Eigo Michi — 日本人のための本格英語オンライン講座" },
      {
        name: "twitter:description",
        content:
          "日本語で丁寧に導く、実践型オンライン英語コース。自分のペースで、使える英語力を。",
      },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
      { rel: "alternate", hreflang: "ja", href: `${SITE_URL}/?lang=ja` },
      { rel: "alternate", hreflang: "en", href: `${SITE_URL}/?lang=en` },
      { rel: "alternate", hreflang: "x-default", href: `${SITE_URL}/` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Course",
          name: "Eigo Michi — 日本人のための本格英語オンライン講座",
          description:
            "日本語のサポート付きで学ぶ、実践型オンライン英語プログラム。",
          inLanguage: ["ja", "en"],
          provider: {
            "@type": "Organization",
            name: "Eigo Michi",
            url: SITE_URL,
          },
          offers: {
            "@type": "Offer",
            price: "49800",
            priceCurrency: "JPY",
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}/checkout`,
          },
        }),
      },
    ],
  }),
  component: LandingPage,
});


const trustIcons = [Save, Clock, Smartphone, LineChart, MessageCircle] as const;

const methodPillars = [
  { key: "comprehension", icon: BrainCircuit },
  { key: "pronunciation", icon: Mic2 },
  { key: "vocabulary", icon: Type },
  { key: "sentence", icon: ListChecks },
  { key: "listening", icon: Ear },
  { key: "conversation", icon: MessagesSquare },
  { key: "review", icon: Sparkles },
] as const;

const platformFeatures = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "modules", icon: BookOpen },
  { key: "current", icon: Play },
  { key: "progress", icon: LineChart },
  { key: "history", icon: Clock },
  { key: "mobile", icon: Smartphone },
] as const;

const stageKeys = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

const howSteps = [
  { key: "signup", icon: UserPlus },
  { key: "pay", icon: CreditCard },
  { key: "unlock", icon: Rocket },
  { key: "learn", icon: LineChart },
] as const;

const faqKeys = [
  "beginner",
  "payment",
  "subscription",
  "mobile",
  "expiry",
  "download",
  "password",
  "start",
  "receipt",
  "support",
] as const;

const audienceForKeys = [
  "beginners",
  "professionals",
  "travelers",
  "students",
  "interview",
  "communication",
] as const;

const audienceNotForKeys = ["instant", "advanced", "shortcut"] as const;

function LandingPage() {
  const { t, i18n } = useTranslation();
  const isJa = (i18n.language || "ja").startsWith("ja");
  const priceLabel = formatJpy(COURSE_PRICE_JPY);
  const trustItems = t("landing.trust.items", { returnObjects: true }) as string[];
  const beforeItems = t("landing.transformation.before", {
    returnObjects: true,
  }) as string[];
  const afterItems = t("landing.transformation.after", {
    returnObjects: true,
  }) as string[];
  const includedItems = t("landing.offer.included", {
    returnObjects: true,
  }) as string[];

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 40% at 20% 10%, color-mix(in oklab, var(--brand) 18%, transparent), transparent 70%), radial-gradient(45% 35% at 90% 20%, color-mix(in oklab, var(--highlight) 20%, transparent), transparent 70%)",
          }}
        />
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div className="flex flex-col justify-center gap-6 motion-safe:animate-fade-in">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="size-1.5 rounded-full bg-[color:var(--brand)]" />
              {t("landing.hero.eyebrow")}
            </span>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              {t("landing.hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/" hash="curriculum">
                  {t("landing.hero.ctaSecondary")}
                </Link>
              </Button>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="size-4 text-[color:var(--brand)]" aria-hidden />
              {t("landing.hero.note")}
            </p>
          </div>

          <div className="relative motion-safe:animate-fade-in">
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[color:var(--brand)]/15 via-transparent to-[color:var(--highlight)]/15 blur-2xl"
            />
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  aria-hidden
                  className="grid size-7 place-items-center rounded-md bg-[color:var(--brand)] font-display text-xs text-[color:var(--brand-foreground)]"
                >
                  {t("brand.logoMark")}
                </span>
                {t("brand.name")}
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight">
                {t("auth.registerTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("auth.registerSubtitle")}
              </p>

              <SocialAuthButtons className="mt-5" />

              <Button asChild size="lg" className="mt-4 w-full">
                <Link to="/register">
                  <UserPlus className="mr-2 size-4" aria-hidden />
                  {t("landing.hero.ctaPrimary")}
                </Link>
              </Button>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("auth.haveAccount")}{" "}
                <Link
                  to="/login"
                  className="font-medium text-[color:var(--brand)] underline-offset-4 hover:underline"
                >
                  {t("nav.login")}
                </Link>
              </p>

              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="size-3.5 text-[color:var(--brand)]" aria-hidden />
                {t("landing.hero.note")}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 text-sm">
          {trustItems.map((label, i) => {
            const Icon = trustIcons[i % trustIcons.length];
            return (
              <span key={label} className="inline-flex items-center gap-2">
                <Icon className="size-4 text-[color:var(--brand)]" aria-hidden />
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      </section>

      {/* FEATURES / PROBLEM */}
      <section id="features" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <header className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.problem.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("landing.problem.subtitle")}
            </p>
          </header>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(["years", "fear", "consistency", "materials", "listening", "needs"] as const).map(
              (k) => (
                <Card key={k} className="border-border/70">
                  <CardContent className="py-6">
                    <h3 className="text-base font-semibold">
                      {t(`landing.problem.items.${k}.title`)}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t(`landing.problem.items.${k}.desc`)}
                    </p>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        </div>
      </section>

      {/* TRANSFORMATION */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <header className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.transformation.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("landing.transformation.subtitle")}
            </p>
          </header>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card className="border-dashed">
              <CardContent className="py-6">
                <h3 className="text-lg font-semibold text-muted-foreground">
                  {t("landing.transformation.beforeTitle")}
                </h3>
                <ul className="mt-4 space-y-2">
                  {beforeItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <X className="mt-0.5 size-4 shrink-0 text-[color:var(--urgent)]" aria-hidden />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-[color:var(--brand)]/30 shadow-sm">
              <CardContent className="py-6">
                <h3 className="text-lg font-semibold">
                  {t("landing.transformation.afterTitle")}
                </h3>
                <ul className="mt-4 space-y-2">
                  {afterItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-[color:var(--brand)]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <header className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.how.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("landing.how.subtitle")}</p>
          </header>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {howSteps.map((s, i) => (
              <li
                key={s.key}
                className="relative rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 place-items-center rounded-full bg-[color:var(--brand)]/10 text-sm font-bold text-[color:var(--brand)]"
                  >
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-[color:var(--brand)]" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold">
                  {t(`landing.how.steps.${s.key}.title`)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`landing.how.steps.${s.key}.desc`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* METHODOLOGY */}
      <section id="method" className="scroll-mt-20 border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <header className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.method.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("landing.method.subtitle")}</p>
          </header>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {methodPillars.map((p) => (
              <Card key={p.key} className="border-border/70">
                <CardContent className="flex flex-col gap-3 py-6">
                  <div className="grid size-10 place-items-center rounded-xl bg-[color:var(--brand)]/10 text-[color:var(--brand)]">
                    <p.icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold">
                    {t(`landing.method.pillars.${p.key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`landing.method.pillars.${p.key}.desc`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CURRICULUM */}
      <section id="curriculum" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <header className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.curriculum.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("landing.curriculum.subtitle")}
            </p>
          </header>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {stageKeys.map((k, i) => {
              const status = t(`landing.curriculum.stages.${k}.status`) as
                | "available"
                | "coming_soon";
              const samples = t(`landing.curriculum.stages.${k}.samples`, {
                returnObjects: true,
              }) as string[];
              return (
                <Card key={k} className="border-border/70">
                  <CardContent className="py-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--brand)]/10 font-display text-lg font-bold text-[color:var(--brand)]"
                        >
                          {i + 1}
                        </span>
                        <h3 className="text-lg font-semibold">
                          {t(`landing.curriculum.stages.${k}.title`)}
                        </h3>
                      </div>
                      <Badge
                        variant={status === "available" ? "default" : "secondary"}
                        className={
                          status === "available"
                            ? "bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                            : ""
                        }
                      >
                        {t(`landing.curriculum.status.${status}`)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t("landing.curriculum.objectiveLabel")}:
                      </span>{" "}
                      {t(`landing.curriculum.stages.${k}.objective`)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">
                          {t(`landing.curriculum.stages.${k}.modules`)}
                        </strong>{" "}
                        {t("landing.curriculum.modulesLabel")}
                      </span>
                      <span>
                        <strong className="text-foreground">
                          {t(`landing.curriculum.stages.${k}.lessons`)}
                        </strong>{" "}
                        {t("landing.curriculum.lessonsLabel")}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("landing.curriculum.sampleLabel")}
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {samples.map((s) => (
                          <li
                            key={s}
                            className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLATFORM PREVIEW */}
      <section className="border-t border-border bg-[color:var(--teal)] text-[color:var(--teal-foreground)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col justify-center gap-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.platform.title")}
            </h2>
            <p className="text-white/80">{t("landing.platform.subtitle")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {platformFeatures.map((f) => (
                <div key={f.key} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10">
                    <f.icon className="size-4" aria-hidden />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {t(`landing.platform.features.${f.key}.title`)}
                    </div>
                    <p className="text-xs text-white/70">
                      {t(`landing.platform.features.${f.key}.desc`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-[color:var(--highlight)]/30 blur-2xl"
            />
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 text-sm">
                <div className="flex items-center gap-2">
                  <Laptop className="size-4" aria-hidden />
                  <span>{t("landing.platform.mockup.greeting")}</span>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  32%
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/8 p-3 sm:col-span-2">
                  <div className="text-xs text-white/70">
                    {t("landing.platform.mockup.todayLesson")}
                  </div>
                  <div className="mt-1 text-base font-semibold">
                    Stage 2 — Making Questions
                  </div>
                  <button className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand)] px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-foreground)]">
                    <Play className="size-3" aria-hidden />
                    {t("landing.platform.mockup.resume")}
                  </button>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-xl bg-white/8 p-3">
                    <div className="text-xs text-white/70">
                      {t("landing.platform.mockup.modules")}
                    </div>
                    <div className="mt-1 text-lg font-bold">30</div>
                  </div>
                  <div className="rounded-xl bg-white/8 p-3">
                    <div className="text-xs text-white/70">
                      {t("landing.platform.mockup.history")}
                    </div>
                    <div className="mt-1 flex gap-1" aria-hidden>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <span
                          key={n}
                          className={`h-6 w-1.5 rounded-full ${
                            n <= 5 ? "bg-[color:var(--brand)]" : "bg-white/20"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className={`aspect-square rounded-lg text-center text-sm font-bold leading-[2.25rem] ${
                      n <= 2
                        ? "bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                        : "bg-white/10"
                    }`}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section>
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-20 md:grid-cols-2">
          <Card>
            <CardContent className="py-6">
              <h3 className="text-lg font-semibold">
                {t("landing.audience.forTitle")}
              </h3>
              <ul className="mt-4 grid gap-2">
                {audienceForKeys.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[color:var(--brand)]"
                      aria-hidden
                    />
                    <span>{t(`landing.audience.for.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="py-6">
              <h3 className="text-lg font-semibold text-muted-foreground">
                {t("landing.audience.notForTitle")}
              </h3>
              <ul className="mt-4 grid gap-2">
                {audienceNotForKeys.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm">
                    <X
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="text-muted-foreground">
                      {t(`landing.audience.notFor.${k}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* OFFER */}
      <section id="offer" className="scroll-mt-20 border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-20">
          <header className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.offer.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("landing.offer.subtitle")}
            </p>
          </header>
          <Card className="mt-10 overflow-hidden border-[color:var(--brand)]/30 shadow-lg">
            <CardContent className="grid gap-8 p-8 md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <Badge className="bg-[color:var(--highlight)] text-[color:var(--highlight-foreground)]">
                  {t("landing.offer.oneTime")}
                </Badge>
                <h3 className="mt-3 font-display text-2xl font-bold">
                  {t("landing.offer.planName")}
                </h3>
                <div className="mt-4">
                  {priceLabel ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tracking-tight">
                        {priceLabel}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {t("landing.offer.oneTime")}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                      <Sparkles className="size-4" aria-hidden />
                      {t("landing.offer.priceComingSoon")}
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link to="/checkout">
                      {t("landing.offer.cta")}
                      <ArrowRight className="ml-2 size-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/pricing">{t("nav.pricing")}</Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("landing.offer.notice")}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-5">
                <h4 className="text-sm font-semibold">
                  {t("landing.offer.includedTitle")}
                </h4>
                <ul className="mt-3 space-y-2">
                  {includedItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-[color:var(--brand)]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <header className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.testimonials.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("landing.testimonials.subtitle")}
            </p>
          </header>
          <div
            role="note"
            className="mt-6 rounded-lg border border-dashed border-[color:var(--highlight)]/60 bg-[color:var(--highlight)]/10 px-4 py-2 text-xs text-[color:var(--highlight-foreground)]"
          >
            {t("landing.testimonials.demoBanner")}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {demoTestimonials
              .filter((tItem) => tItem.published)
              .map((tItem) => {
                const quote = isJa ? tItem.quoteJa : tItem.quoteEn;
                return (
                  <Card key={tItem.id} className="border-border/70">
                    <CardContent className="flex h-full flex-col gap-4 py-6">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-1"
                          aria-label={`${tItem.rating} / 5`}
                        >
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              aria-hidden
                              className={`size-4 ${
                                i < tItem.rating
                                  ? "fill-[color:var(--highlight)] text-[color:var(--highlight)]"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        {tItem.isDemo && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {t("common.demoLabel")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90">{quote}</p>
                      <div className="mt-auto flex items-center gap-3 border-t border-border pt-4">
                        <div
                          aria-hidden
                          className="grid size-9 place-items-center rounded-full bg-[color:var(--brand)]/10 text-sm font-bold text-[color:var(--brand)]"
                        >
                          {tItem.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{tItem.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {tItem.profession}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-20">
          <header className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.faq.title")}
            </h2>
          </header>
          <Accordion type="single" collapsible className="mt-8">
            {faqKeys.map((k) => (
              <AccordionItem key={k} value={k}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {t(`landing.faq.items.${k}.q`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {t(`landing.faq.items.${k}.a`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-border bg-[color:var(--brand)] text-[color:var(--brand-foreground)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(40% 60% at 80% 30%, color-mix(in oklab, var(--highlight) 60%, transparent), transparent 70%)",
          }}
        />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-4 py-20 text-center">
          <Headphones className="size-8 opacity-90" aria-hidden />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("landing.finalCta.title")}
          </h2>
          <p className="max-w-xl opacity-90">{t("landing.finalCta.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/checkout">
                {t("landing.finalCta.cta")}
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-[color:var(--brand-foreground)] hover:bg-white/10"
            >
              <Link to="/" hash="curriculum">
                {t("landing.finalCta.secondary")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
