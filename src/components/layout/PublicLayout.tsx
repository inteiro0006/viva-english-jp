import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--brand)] text-[color:var(--brand-foreground)]">
              英
            </span>
            <span className="text-base">{t("brand.name")}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            <Link to="/course" className="text-sm hover:text-[color:var(--brand)]">
              {t("nav.course")}
            </Link>
            <Link to="/pricing" className="text-sm hover:text-[color:var(--brand)]">
              {t("nav.pricing")}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">{t("nav.register")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70 bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {t("brand.name")}. {t("footer.rights")}
          </p>
          <nav className="flex gap-4" aria-label="Legal">
            <Link to="/terms" className="hover:text-foreground">
              {t("footer.terms")}
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              {t("footer.privacy")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
