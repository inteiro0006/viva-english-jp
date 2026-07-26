import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Placeholder } from "@/components/Placeholder";

const SITE_URL = "https://viva-english-jp.lovable.app";

export const Route = createFileRoute("/course")({
  head: () => ({
    meta: [
      { title: "コース紹介 — Eigo Michi" },
      {
        name: "description",
        content:
          "Eigo Michi のカリキュラム。6ステージで理解・発音・語彙・作文・リスニング・会話を体系的に学ぶロードマップ。",
      },
      { property: "og:title", content: "コース紹介 — Eigo Michi" },
      {
        property: "og:description",
        content: "6ステージで英語を体系的に学ぶ、日本人のためのオンライン講座。",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/course` },
      { property: "og:locale", content: "ja_JP" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/course` },
      { rel: "alternate", hreflang: "ja", href: `${SITE_URL}/course?lang=ja` },
      { rel: "alternate", hreflang: "en", href: `${SITE_URL}/course?lang=en` },
      { rel: "alternate", hreflang: "x-default", href: `${SITE_URL}/course` },
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
