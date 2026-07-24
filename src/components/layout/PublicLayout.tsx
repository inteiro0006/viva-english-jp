import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";

type NavItem = { key: string; hash: string };

const SECTION_NAV: NavItem[] = [
  { key: "features", hash: "features" },
  { key: "method", hash: "method" },
  { key: "content", hash: "curriculum" },
  { key: "pricing", hash: "offer" },
  { key: "faq", hash: "faq" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-semibold"
            aria-label={t("brand.name")}
          >
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-[color:var(--brand)] font-display text-[color:var(--brand-foreground)]"
            >
              {t("brand.logoMark")}
            </span>
            <span className="text-base tracking-tight">{t("brand.name")}</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-5 lg:flex" aria-label="Primary">
            {SECTION_NAV.map((item) => (
              <Link
                key={item.key}
                to="/"
                hash={item.hash}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/checkout">{t("nav.buy")}</Link>
            </Button>
          </div>

          <button
            type="button"
            className="ml-auto inline-flex size-10 items-center justify-center rounded-md border border-border md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>

        {menuOpen && (
          <div
            id="mobile-menu"
            className="border-t border-border bg-background md:hidden"
          >
            <nav
              className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4"
              aria-label="Mobile"
            >
              {SECTION_NAV.map((item) => (
                <Link
                  key={item.key}
                  to="/"
                  hash={item.hash}
                  className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setMenuOpen(false)}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("language.label")}
                  </span>
                  <LanguageSwitcher />
                </div>
                <Button asChild variant="outline" onClick={() => setMenuOpen(false)}>
                  <Link to="/login">{t("nav.login")}</Link>
                </Button>
                <Button asChild onClick={() => setMenuOpen(false)}>
                  <Link to="/checkout">{t("nav.buy")}</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-semibold">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-lg bg-[color:var(--brand)] font-display text-[color:var(--brand-foreground)]"
              >
                {t("brand.logoMark")}
              </span>
              {t("brand.name")}
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
            <div className="mt-4">
              <LanguageSwitcher />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("footer.navTitle")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/course" className="text-muted-foreground hover:text-foreground">
                  {t("nav.course")}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-foreground">
                  {t("nav.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/" hash="faq" className="text-muted-foreground hover:text-foreground">
                  {t("nav.faq")}
                </Link>
              </li>
              <li>
                <Link to="/student/support" className="text-muted-foreground hover:text-foreground">
                  {t("footer.support")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("footer.legalTitle")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/commercial" className="text-muted-foreground hover:text-foreground">
                  {t("footer.commercial")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/70">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} {t("brand.name")}. {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
