import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAuditLogs } from "@/lib/admin/audit.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function AdminAuditPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listAuditLogs);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", action, entityType],
    queryFn: () =>
      list({
        data: {
          action: action || undefined,
          entityType: entityType || undefined,
          page: 0,
        },
      }),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.audit")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.audit_.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t("admin.audit_.filterAction")}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-56"
          />
          <Select value={entityType || "all"} onValueChange={(v) => setEntityType(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.status.all")}</SelectItem>
              <SelectItem value="course">course</SelectItem>
              <SelectItem value="module">module</SelectItem>
              <SelectItem value="lesson">lesson</SelectItem>
              <SelectItem value="enrollment">enrollment</SelectItem>
              <SelectItem value="order">order</SelectItem>
              <SelectItem value="setting">setting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <Card>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-64 w-full" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.audit_.when")}</TableHead>
                <TableHead>{t("admin.audit_.who")}</TableHead>
                <TableHead>{t("admin.audit_.action")}</TableHead>
                <TableHead>{t("admin.audit_.entity")}</TableHead>
                <TableHead>{t("admin.audit_.id")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((r) => {
                const row = r as unknown as {
                  id: string;
                  created_at: string;
                  action: string;
                  entity_type: string;
                  entity_id: string | null;
                  profiles: { full_name: string } | null;
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString(i18n.language)}
                    </TableCell>
                    <TableCell>{row.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.entity_id ? row.entity_id.slice(0, 8) + "…" : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data?.rows ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    {t("common.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
