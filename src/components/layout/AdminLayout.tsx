import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import {
  Gauge,
  BookMarked,
  Layers,
  ListChecks,
  Video,
  Users,
  Receipt,
  Settings,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const nav: Array<{
    to: string;
    label: string;
    icon: typeof Gauge;
    exact?: boolean;
  }> = [
    { to: "/admin", label: t("admin.overview"), icon: Gauge, exact: true },
    { to: "/admin/courses", label: t("admin.courses"), icon: BookMarked },
    { to: "/admin/modules", label: t("admin.modules"), icon: Layers },
    { to: "/admin/lessons", label: t("admin.lessons"), icon: ListChecks },
    { to: "/admin/videos", label: t("admin.videos"), icon: Video },
    { to: "/admin/students", label: t("admin.students"), icon: Users },
    { to: "/admin/orders", label: t("admin.orders"), icon: Receipt },
    { to: "/admin/settings", label: t("admin.settings"), icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--teal)] text-[color:var(--teal-foreground)]">
            A
          </span>
          {t("admin.title")}
        </div>
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Admin">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{
                className: "bg-accent text-accent-foreground",
              }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/60 hover:text-foreground"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4">
          <span className="font-semibold lg:hidden">{t("admin.title")}</span>
          <div className="flex flex-1 items-center justify-end gap-2">
            <LanguageSwitcher />
            <Button asChild variant="outline" size="sm">
              <Link to="/">{t("common.backHome")}</Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
