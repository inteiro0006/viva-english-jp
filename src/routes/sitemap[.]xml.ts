import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { SITE_URL as BASE_URL } from "@/config/site";

interface Entry {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
  hreflang?: boolean;
}

// Public, indexable routes only. Protected areas (student/*, admin/*, checkout,
// login, register, forgot/reset password, verify-email, payment/*, certificate/*)
// are intentionally excluded and additionally blocked via robots.txt + noindex.
const ENTRIES: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0", hreflang: true },
  { path: "/pricing", changefreq: "monthly", priority: "0.8", hreflang: true },
  { path: "/course", changefreq: "monthly", priority: "0.8", hreflang: true },
  { path: "/commercial", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = ENTRIES.map((e) => {
          const loc = `${BASE_URL}${e.path}`;
          const altLinks = e.hreflang
            ? [
                `    <xhtml:link rel="alternate" hreflang="ja" href="${loc}?lang=ja" />`,
                `    <xhtml:link rel="alternate" hreflang="en" href="${loc}?lang=en" />`,
                `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`,
              ].join("\n")
            : "";
          return [
            `  <url>`,
            `    <loc>${loc}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            altLinks || null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
