import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Split screen for auth flows: form on the left, commercial pitch on the right.
 * On mobile the pitch collapses so the form stays priority.
 */
export function AuthShell({ title, subtitle, children }: Props) {
  const { t } = useTranslation();
  const bullets = [
    t("auth.shell.bullets.access"),
    t("auth.shell.bullets.pace"),
    t("auth.shell.bullets.support"),
  ];

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--brand)] text-[color:var(--brand-foreground)]">
              英
            </span>
            <span>{t("brand.name")}</span>
          </Link>
          <LanguageSwitcher />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>
        </main>
      </div>
      <aside className="hidden bg-[color:var(--brand)] p-10 text-[color:var(--brand-foreground)] lg:flex lg:flex-col lg:justify-center">
        <div className="max-w-md">
          <p className="text-sm font-medium uppercase tracking-widest opacity-80">
            {t("brand.tagline")}
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight">
            {t("auth.shell.title")}
          </h2>
          <p className="mt-3 text-base opacity-90">
            {t("auth.shell.subtitle")}
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
