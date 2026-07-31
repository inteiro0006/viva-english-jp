import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminPaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Show the control even when there is a single page (keeps the count visible). */
  alwaysVisible?: boolean;
}

export function AdminPagination({
  page,
  total,
  pageSize,
  onPageChange,
  alwaysVisible = false,
}: AdminPaginationProps) {
  const { t, i18n } = useTranslation();
  const size = pageSize > 0 ? pageSize : 25;
  const pageCount = Math.max(1, Math.ceil(total / size));
  if (pageCount <= 1 && !alwaysVisible) return null;

  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  const nf = new Intl.NumberFormat(i18n.language);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label={t("admin.pagination.label")}
    >
      <p className="text-muted-foreground">
        {t("admin.pagination.range", { from: nf.format(from), to: nf.format(to), total: nf.format(total) })}
        {" · "}
        {t("admin.pagination.page", { page: nf.format(page + 1), pages: nf.format(pageCount) })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          aria-label={t("admin.pagination.previous")}
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          {t("admin.pagination.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("admin.pagination.next")}
        >
          {t("admin.pagination.next")}
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
