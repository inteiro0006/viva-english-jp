import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/course")({
  head: () => ({
    meta: [
      { title: "コース紹介 — Eigo Michi" },
      {
        name: "description",
        content: "本コースのカリキュラムと6ステージの学習ロードマップ。",
      },
      { property: "og:title", content: "コース紹介 — Eigo Michi" },
      {
        property: "og:description",
        content: "本コースのカリキュラムと6ステージの学習ロードマップ。",
      },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Placeholder title={t("course.title")} description={t("course.subtitle")} />
      </div>
    </PublicLayout>
  );
}
