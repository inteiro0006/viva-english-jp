import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listOrders, initiateRefund } from "@/lib/admin/orders.admin.functions";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type StatusFilter = "" | "pending" | "paid" | "failed" | "refunded" | "partially_refunded";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const list = useServerFn(listOrders);
  const refund = useServerFn(initiateRefund);
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", status, page],
    queryFn: () => list({ data: { status: status || undefined, page } }),
  });

  const refundMut = useMutation({
    mutationFn: (id: string) => refund({ data: { id } }),
    onSuccess: (r) => {
      toast.success(r.pending ? t("admin.orders_.refundQueued") : t("admin.orders_.refundDone"));
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.orders")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.orders_.subtitle")}</p>
        </div>
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setPage(0);
            setStatus(v === "all" ? "" : (v as StatusFilter));
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.status.all")}</SelectItem>
            <SelectItem value="paid">{t("admin.orders_.paid")}</SelectItem>
            <SelectItem value="pending">{t("admin.orders_.pending")}</SelectItem>
            <SelectItem value="failed">{t("admin.orders_.failed")}</SelectItem>
            <SelectItem value="refunded">{t("admin.orders_.refunded")}</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <Card>
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.orders_.id")}</TableHead>
                <TableHead>{t("admin.orders_.customer")}</TableHead>
                <TableHead>{t("admin.orders_.course")}</TableHead>
                <TableHead>{t("admin.orders_.amount")}</TableHead>
                <TableHead>{t("admin.orders_.status")}</TableHead>
                <TableHead>{t("admin.orders_.date")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((o) => {
                const row = o as unknown as {
                  id: string;
                  amount: number;
                  currency: string;
                  status: string;
                  created_at: string;
                  profiles: { full_name: string } | null;
                  courses: { title_ja: string; title_en: string } | null;
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.id.slice(0, 8)}…</TableCell>
                    <TableCell>{row.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      {row.courses
                        ? i18n.language === "en"
                          ? row.courses.title_en
                          : row.courses.title_ja
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">¥{row.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "paid" ? "default" : "outline"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString(i18n.language)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.status === "paid" || row.status === "partially_refunded") && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {t("admin.orders_.refund")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("admin.orders_.confirmRefund")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("admin.orders_.confirmRefundDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => refundMut.mutate(row.id)}>
                                {t("admin.orders_.refund")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data?.rows ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {t("common.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <AdminPagination
        page={page}
        total={data?.total ?? 0}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
      />
    </div>
  );
}
