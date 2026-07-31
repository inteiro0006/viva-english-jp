import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState, type ReactNode } from "react";
import {
  Gauge,
  BookMarked,
  Layers,
  ListChecks,
  Video,
  Users,
  Receipt,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/use-session";

type NavItem = { to: string; label: string; icon: typeof Gauge; exact?: boolean };

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    router.invalidate();
    await navigate({ to: "/", replace: true });
  }

  const nav: NavItem[] = [
    { to: "/admin", label: t("admin.overview"), icon: Gauge, exact: true },
    { to: "/admin/courses", label: t("admin.courses"), icon: BookMarked },
    { to: "/admin/modules", label: t("admin.modules"), icon: Layers },
    { to: "/admin/lessons", label: t("admin.lessons"), icon: ListChecks },
    { to: "/admin/videos", label: t("admin.videos"), icon: Video },
    { to: "/admin/students", label: t("admin.students"), icon: Users },
    { to: "/admin/orders", label: t("admin.orders"), icon: Receipt },
    { to: "/admin/payments", label: t("admin.payments"), icon: CreditCard },
    { to: "/admin/audit", label: t("admin.audit"), icon: Shield },
    { to: "/admin/settings", label: t("admin.settings"), icon: Settings },
  ];

  const crumbs = buildCrumbs(pathname, nav, t);

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Admin">
      {nav.map((item) => (
        <Link
          key={item.to}
          to={item.to as never}
          activeOptions={{ exact: item.exact ?? false }}
          onClick={onNavigate}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/60 hover:text-foreground"
        >
          <item.icon className="size-4" aria-hidden />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--teal)] text-[color:var(--teal-foreground)]">
            A
          </span>
          {t("admin.title")}
        </div>
        <NavList />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="border-b border-border px-4 py-3 text-left">
                  {t("admin.title")}
                </SheetTitle>
                <NavList onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <nav
              aria-label="Breadcrumb"
              className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex"
            >
              {crumbs.map((c, i) => (
                <span key={c.to ?? i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                  {c.to ? (
                    <Link to={c.to as never} className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Account">
                  <span className="grid size-6 place-items-center rounded-full bg-[color:var(--teal)] text-[10px] font-bold text-[color:var(--teal-foreground)]">
                    A
                  </span>
                  <span className="hidden sm:inline">{t("admin.account")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("admin.signedInAsAdmin")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 size-4" aria-hidden />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function buildCrumbs(
  pathname: string,
  nav: NavItem[],
  t: (k: string) => string,
): Array<{ label: string; to?: string }> {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [];
  const crumbs: Array<{ label: string; to?: string }> = [{ label: t("admin.title"), to: "/admin" }];
  if (parts.length > 1) {
    const section = "/" + parts.slice(0, 2).join("/");
    const found = nav.find((n) => n.to === section);
    crumbs.push({ label: found?.label ?? parts[1], to: parts.length > 2 ? section : undefined });
  }
  if (parts.length > 2) {
    crumbs.push({ label: parts[parts.length - 1] });
  }
  return crumbs;
}
