import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { LayoutDashboard, BookOpen, User, LifeBuoy } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";

export function StudentLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const nav = [
    { to: "/student/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/student/course/foundation", label: t("nav.course"), icon: BookOpen },
    { to: "/student/profile", label: t("nav.profile"), icon: User },
    { to: "/student/support", label: t("nav.support"), icon: LifeBuoy },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/student/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--brand)] text-[color:var(--brand-foreground)]">
              英
            </span>
            <span>{t("brand.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild variant="outline" size="sm">
              <Link to="/">{t("nav.logout")}</Link>
            </Button>
          </div>
        </div>
        <nav
          className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4"
          aria-label="Student"
        >
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: false }}
              activeProps={{
                className:
                  "border-b-2 border-[color:var(--brand)] text-foreground",
              }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium hover:text-foreground"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
