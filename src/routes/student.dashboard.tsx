import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PlayCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({ meta: [{ title: "ダッシュボード — Eigo Michi" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const modules = Array.from({ length: 9 }, (_, i) => ({
    n: i + 1,
    locked: i > 2,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--teal)] p-6 text-[color:var(--brand-foreground)] shadow-sm">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-2">
            <p className="text-sm opacity-90">{t("student.welcome")}</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Andre-san</h1>
          </div>
          <div className="min-w-[220px] rounded-xl bg-white/15 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wide opacity-80">
              {t("student.progress")}
            </p>
            <p className="mt-1 text-2xl font-semibold">8%</p>
            <Progress value={8} className="mt-2 bg-white/30" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("student.continueLearning")}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
              <div className="aspect-video rounded-xl bg-gradient-to-br from-[color:var(--brand)]/20 to-[color:var(--highlight)]/20" />
              <div className="flex flex-col gap-3">
                <span className="text-xs uppercase text-muted-foreground">
                  Stage 1 · Module 001
                </span>
                <h3 className="text-lg font-semibold">Lesson 01</h3>
                <Progress value={25} />
                <Button asChild className="mt-2 w-fit">
                  <Link to="/student/lesson/$lessonId" params={{ lessonId: "1" }}>
                    <PlayCircle className="mr-2 size-4" aria-hidden />
                    {t("common.continue")}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-6">
            <h2 className="text-lg font-semibold">{t("student.myCourse")}</h2>
            <Link
              to="/student/course/$courseSlug"
              params={{ courseSlug: "foundation" }}
              className="text-sm text-[color:var(--brand)] hover:underline"
            >
              {t("common.learnMore")} →
            </Link>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("student.modules")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {modules.map((m) => (
            <div
              key={m.n}
              className={`relative flex aspect-square flex-col justify-between rounded-2xl border p-4 ${
                m.locked
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-transparent bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
              }`}
            >
              <span className="text-4xl font-bold">{m.n}</span>
              <span className="text-xs">
                Module {String(m.n).padStart(3, "0")}
              </span>
              {m.locked ? (
                <Lock className="absolute right-3 top-3 size-4" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
