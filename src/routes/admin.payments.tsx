import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, Fragment } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCw, UserPlus } from "lucide-react";
import {
  listPaymentEvents,
  getPaymentEvent,
  reprocessPaymentEvent,
  manualEnrollment,
  type PaymentEventRow,
} from "@/lib/admin/payments.admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPaymentsPage,
});

type StatusFilter = "all" | "processed" | "pending" | "failed";

function statusBadge(row: PaymentEventRow) {
  if (row.processed)
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
        processed
      </Badge>
    );
  if (row.processing_error)
    return (
      <Badge variant="outline" className="border-red-200 bg-red-100 text-red-800">
        failed
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800">
      pending
    </Badge>
  );
}

function AdminPaymentsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const list = useServerFn(listPaymentEvents);
  const reprocess = useServerFn(reprocessPaymentEvent);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [eventType, setEventType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [manualFor, setManualFor] = useState<PaymentEventRow | null>(null);
  const [confirmReprocess, setConfirmReprocess] = useState<PaymentEventRow | null>(null);

  const queryKey = ["admin", "payments", { status, eventType, search, page }];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      list({
        data: {
          status,
          eventType: eventType || undefined,
          search: search || undefined,
          page,
        },
      }),
  });

  const rows = data?.rows ?? [];
  const kpis = data?.kpis;
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;

  const reprocessMut = useMutation({
    mutationFn: (id: string) => reprocess({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.payments_.reprocessSuccess"));
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (err: unknown) => {
      toast.error(
        `${t("admin.payments_.reprocessFailed")}: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.payments")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.payments_.subtitle")}</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={t("admin.payments_.kpiTotal")} value={kpis?.total} />
        <KpiCard label={t("admin.payments_.kpiProcessed")} value={kpis?.processed} tone="emerald" />
        <KpiCard label={t("admin.payments_.kpiPending")} value={kpis?.pending} tone="amber" />
        <KpiCard label={t("admin.payments_.kpiFailed")} value={kpis?.failed} tone="red" />
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("admin.payments_.filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.payments_.statusAll")}</SelectItem>
              <SelectItem value="processed">{t("admin.payments_.statusProcessed")}</SelectItem>
              <SelectItem value="pending">{t("admin.payments_.statusPending")}</SelectItem>
              <SelectItem value="failed">{t("admin.payments_.statusFailed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={eventType || "all"}
            onValueChange={(v) => {
              setEventType(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("admin.payments_.filterType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.payments_.statusAll")}</SelectItem>
              {(data?.eventTypes ?? []).map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("admin.payments_.filterSearch")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>{t("admin.payments_.colWhen")}</TableHead>
                <TableHead>{t("admin.payments_.colType")}</TableHead>
                <TableHead>{t("admin.payments_.colEventId")}</TableHead>
                <TableHead>{t("admin.payments_.colStatus")}</TableHead>
                <TableHead>{t("admin.payments_.colOrder")}</TableHead>
                <TableHead className="text-right">{t("admin.payments_.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isOpen = !!expanded[row.id];
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell>
                        <button
                          type="button"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          onClick={() => setExpanded((s) => ({ ...s, [row.id]: !s[row.id] }))}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString(i18n.language)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.event_type}</TableCell>
                      <TableCell
                        className="max-w-[12rem] truncate font-mono text-[10px] text-muted-foreground"
                        title={row.provider_event_id}
                      >
                        {row.provider_event_id}
                      </TableCell>
                      <TableCell>{statusBadge(row)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.order_id ? (
                          <div className="font-mono text-[10px]" title={row.order_id}>
                            order: {row.order_id.slice(0, 8)}…
                          </div>
                        ) : null}
                        {row.user_id ? (
                          <div className="font-mono text-[10px]" title={row.user_id}>
                            user: {row.user_id.slice(0, 8)}…
                          </div>
                        ) : null}
                        {!row.order_id && !row.user_id && "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmReprocess(row)}
                            disabled={reprocessMut.isPending}
                          >
                            <RotateCw className="mr-1 h-3 w-3" />
                            {t("admin.payments_.reprocess")}
                          </Button>
                          {row.user_id && row.course_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setManualFor(row)}
                              title={t("admin.payments_.manualEnroll")}
                            >
                              <UserPlus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={7} className="p-4">
                          <EventDetail row={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
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

      <AdminPagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} />

      <AlertDialog open={!!confirmReprocess} onOpenChange={(o) => !o && setConfirmReprocess(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.payments_.reprocess")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmReprocess?.event_type} · {confirmReprocess?.provider_event_id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.payments_.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReprocess) reprocessMut.mutate(confirmReprocess.id);
                setConfirmReprocess(null);
              }}
            >
              {t("admin.payments_.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {manualFor && (
        <ManualEnrollmentDialog
          row={manualFor}
          onClose={() => setManualFor(null)}
          onDone={() => qc.invalidateQueries({ queryKey: ["admin", "payments"] })}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone?: "emerald" | "amber" | "red";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "red"
          ? "text-red-700"
          : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>
        {value !== undefined ? value.toLocaleString() : "—"}
      </div>
    </Card>
  );
}

function EventDetail({ row }: { row: PaymentEventRow }) {
  const { t } = useTranslation();
  const getEvt = useServerFn(getPaymentEvent);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "detail", row.id],
    queryFn: () => getEvt({ data: { id: row.id } }),
  });

  return (
    <div className="space-y-3">
      {row.processing_error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          <span className="font-semibold">Error: </span>
          {row.processing_error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border bg-background p-2 text-xs">
          <div className="mb-1 font-semibold">{t("admin.payments_.orderState")}</div>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : data?.order ? (
            <pre className="whitespace-pre-wrap font-mono text-[10px]">
              {JSON.stringify(data.order, null, 2)}
            </pre>
          ) : (
            <div className="text-muted-foreground">{t("admin.payments_.noOrder")}</div>
          )}
        </div>
        <div className="rounded border bg-background p-2 text-xs">
          <div className="mb-1 font-semibold">{t("admin.payments_.enrollmentState")}</div>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : data?.enrollment ? (
            <pre className="whitespace-pre-wrap font-mono text-[10px]">
              {JSON.stringify(data.enrollment, null, 2)}
            </pre>
          ) : (
            <div className="text-muted-foreground">{t("admin.payments_.noEnrollment")}</div>
          )}
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          {t("admin.payments_.payload")}
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded border bg-background p-2 font-mono text-[10px]">
          {JSON.stringify(row.payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ManualEnrollmentDialog({
  row,
  onClose,
  onDone,
}: {
  row: PaymentEventRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const manual = useServerFn(manualEnrollment);
  const [markPaid, setMarkPaid] = useState(true);
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      manual({
        data: {
          userId: row.user_id!,
          courseId: row.course_id!,
          orderId: row.order_id ?? undefined,
          markOrderPaid: markPaid,
          note: note || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.alreadyActive
          ? t("admin.payments_.manualAlreadyActive")
          : t("admin.payments_.manualCreated"),
      );
      onDone();
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.payments_.manualEnroll")}</DialogTitle>
          <DialogDescription>{t("admin.payments_.manualEnrollDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded border bg-muted/40 p-2 font-mono text-[11px]">
            <div>user: {row.user_id}</div>
            <div>course: {row.course_id}</div>
            {row.order_id && <div>order: {row.order_id}</div>}
          </div>
          {row.order_id && (
            <label className="flex items-center gap-2">
              <Checkbox checked={markPaid} onCheckedChange={(v) => setMarkPaid(!!v)} />
              <span>{t("admin.payments_.markOrderPaid")}</span>
            </label>
          )}
          <div className="space-y-1">
            <Label>{t("admin.payments_.note")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("admin.payments_.cancel")}
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {t("admin.payments_.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
