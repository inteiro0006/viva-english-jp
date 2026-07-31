import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { listAuditLogs, listAuditAdmins, type AuditLogRow } from "@/lib/admin/audit.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/admin/audit")({
  component: AdminAuditPage,
});

const ENTITY_TYPES = [
  "course",
  "module",
  "lesson",
  "enrollment",
  "order",
  "student",
  "setting",
  "certificate",
] as const;

const ACTION_VERB_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800 border-emerald-200",
  update: "bg-sky-100 text-sky-800 border-sky-200",
  delete: "bg-red-100 text-red-800 border-red-200",
  publish: "bg-emerald-100 text-emerald-800 border-emerald-200",
  archived: "bg-amber-100 text-amber-800 border-amber-200",
  duplicate: "bg-violet-100 text-violet-800 border-violet-200",
  refund: "bg-orange-100 text-orange-800 border-orange-200",
  revoke: "bg-red-100 text-red-800 border-red-200",
};

function actionClass(action: string): string {
  const verb = action.split(".").pop() ?? "";
  return ACTION_VERB_COLORS[verb] ?? "bg-muted text-foreground border-border";
}

function toCsv(rows: AuditLogRow[]): string {
  const header = [
    "created_at",
    "admin_name",
    "admin_id",
    "action",
    "entity_type",
    "entity_id",
    "summary",
    "ip_address",
    "user_agent",
    "changed_fields",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [
      r.created_at,
      r.admin_name ?? "",
      r.admin_id ?? "",
      r.action,
      r.entity_type,
      r.entity_id ?? "",
      r.summary ?? "",
      r.ip_address ?? "",
      r.user_agent ?? "",
      r.changed_fields,
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function AdminAuditPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listAuditLogs);
  const listAdmins = useServerFn(listAuditAdmins);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [adminId, setAdminId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const queryVars = { action, entityType, entityId, adminId, from, to, page };

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", queryVars],
    queryFn: () =>
      list({
        data: {
          action: action || undefined,
          entityType: entityType || undefined,
          entityId: entityId || undefined,
          adminId: adminId || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          page,
        },
      }),
  });

  const { data: admins } = useQuery({
    queryKey: ["admin", "audit", "admins"],
    queryFn: () => listAdmins({}),
  });

  const rows: AuditLogRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const handleExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.audit")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.audit_.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </header>

      <Card className="p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Input
            placeholder={t("admin.audit_.filterAction")}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
          />
          <Select
            value={entityType || "all"}
            onValueChange={(v) => {
              setEntityType(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.status.all")}</SelectItem>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Entity ID"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              setPage(0);
            }}
          />
          <Select
            value={adminId || "all"}
            onValueChange={(v) => {
              setAdminId(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Admin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.status.all")}</SelectItem>
              {(admins ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </Card>

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
                <TableHead>{t("admin.audit_.when")}</TableHead>
                <TableHead>{t("admin.audit_.who")}</TableHead>
                <TableHead>{t("admin.audit_.action")}</TableHead>
                <TableHead>{t("admin.audit_.entity")}</TableHead>
                <TableHead>{t("admin.audit_.id")}</TableHead>
                <TableHead>Changed</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isOpen = !!expanded[row.id];
                const changed =
                  row.changed_fields &&
                  typeof row.changed_fields === "object" &&
                  !Array.isArray(row.changed_fields)
                    ? (row.changed_fields as Record<string, { from: unknown; to: unknown }>)
                    : null;
                const changedKeys = changed ? Object.keys(changed) : [];
                const hasDetail =
                  changedKeys.length > 0 ||
                  row.old_values !== null ||
                  row.new_values !== null ||
                  !!row.summary ||
                  !!row.user_agent;
                return (
                  <Fragment key={row.id}>
                    <TableRow className={hasDetail ? "cursor-pointer" : ""}>
                      <TableCell>
                        {hasDetail && (
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
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString(i18n.language)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm">{row.admin_name ?? "—"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {row.admin_id ? row.admin_id.slice(0, 8) + "…" : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] ${actionClass(row.action)}`}
                        >
                          {row.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.entity_type}</TableCell>
                      <TableCell
                        className="max-w-[8rem] truncate font-mono text-xs text-muted-foreground"
                        title={row.entity_id ?? undefined}
                      >
                        {row.entity_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {changedKeys.length > 0 ? (
                          <span className="text-muted-foreground">
                            {changedKeys.slice(0, 3).join(", ")}
                            {changedKeys.length > 3 && ` +${changedKeys.length - 3}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {row.ip_address ?? "—"}
                      </TableCell>
                    </TableRow>
                    {isOpen && hasDetail && (
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={8} className="p-4">
                          <AuditDetail row={row} changed={changed} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
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

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            {total.toLocaleString()} · {page + 1} / {pageCount}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditDetail({
  row,
  changed,
}: {
  row: AuditLogRow;
  changed: Record<string, { from: unknown; to: unknown }> | null;
}) {
  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  return (
    <div className="space-y-3">
      {row.summary && (
        <div className="text-sm">
          <span className="font-semibold">Summary: </span>
          <span className="text-muted-foreground">{row.summary}</span>
        </div>
      )}
      {row.user_agent && (
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">User agent: </span>
          <span className="font-mono">{row.user_agent}</span>
        </div>
      )}
      {changed && (
        <div>
          <div className="mb-1 text-xs font-semibold">Changed fields</div>
          <div className="overflow-x-auto rounded border bg-background">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-2 text-left">Field</th>
                  <th className="p-2 text-left">Before</th>
                  <th className="p-2 text-left">After</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(changed).map(([field, delta]) => (
                  <tr key={field} className="border-t">
                    <td className="p-2 font-mono">{field}</td>
                    <td className="p-2 font-mono text-red-700 break-all">{fmt(delta.from)}</td>
                    <td className="p-2 font-mono text-emerald-700 break-all">{fmt(delta.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(row.old_values || row.new_values) && !changed && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Raw payload</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2">
            {JSON.stringify({ old: row.old_values, new: row.new_values }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
