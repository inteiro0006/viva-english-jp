import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export type StudentTabItem = { to: string; label: string };

export function useStudentTabs(): StudentTabItem[] {
  const { t } = useTranslation();
  return [
    { to: "/student/dashboard", label: t("nav.home") },
    { to: "/student/course/eigo-mastery", label: t("nav.course") },
    { to: "/student/profile", label: t("nav.profile") },
    { to: "/student/support", label: t("nav.support") },
  ];
}

/**
 * Horizontal tab bar used across the student area (white card strip with an
 * accent underline on the active item), mirroring the reference dashboard.
 */
export function StudentTabs({ className }: { className?: string }) {
  const { t } = useTranslation();
  const tabs = useStudentTabs();

  return (
    <nav
      aria-label={t("nav.dashboard")}
      className={["rounded-md border border-border bg-card shadow-sm", className ?? ""].join(" ")}
    >
      <ul className="flex gap-1 overflow-x-auto px-2 sm:px-4">
        {tabs.map((tab) => (
          <li key={tab.to} className="shrink-0">
            <Link
              to={tab.to as never}
              activeOptions={{ exact: tab.to === "/student/dashboard" }}
              activeProps={{
                className:
                  "border-[color:var(--lms-accent)] text-[color:var(--lms-link)] font-semibold",
              }}
              inactiveProps={{ className: "border-transparent text-muted-foreground" }}
              className="block border-b-2 px-3 py-3 text-sm hover:text-[color:var(--lms-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lms-accent)] sm:px-4"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
