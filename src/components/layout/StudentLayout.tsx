import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StudentTabs, useStudentTabs } from "@/components/lms/StudentTabs";
import { signOut } from "@/lib/auth/use-session";

export function StudentLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabs = useStudentTabs();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  // The dashboard renders its own tab strip directly under the welcome banner
  // (as in the reference layout), so the shared strip is hidden there.
  const showTabs = pathname !== "/student/dashboard";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    router.invalidate();
    await navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--lms-surface)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto grid h-16 w-full max-w-[1040px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("nav.openMenu")}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border px-4 py-4">
                <SheetTitle>{t("brand.name")}</SheetTitle>
              </SheetHeader>
              <nav aria-label={t("nav.dashboard")} className="p-2">
                <ul className="flex flex-col">
                  {tabs.map((tab) => (
                    <li key={tab.to}>
                      <Link
                        to={tab.to as never}
                        onClick={() => setMenuOpen(false)}
                        activeProps={{
                          className: "bg-accent text-[color:var(--lms-link)] font-semibold",
                        }}
                        className="block rounded-md px-3 py-3 text-sm hover:bg-accent"
                      >
                        {tab.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>

          <Link
            to="/student/dashboard"
            className="flex min-w-0 items-center justify-start gap-2 font-semibold md:justify-center"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color:var(--brand)] text-[color:var(--brand-foreground)]">
              {t("brand.logoMark")}
            </span>
            <span className="truncate leading-tight">
              <span className="block text-[11px] font-normal text-muted-foreground">
                {t("brand.tagline")}
              </span>
              <span className="block text-base">{t("brand.name")}</span>
            </span>
          </Link>

          <div className="flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="icon" aria-label={t("nav.profile")}>
              <Link to="/student/profile">
                <User className="size-5" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 py-6">
        {showTabs && <StudentTabs className="mb-6" />}
        {children}
      </main>
    </div>
  );
}
