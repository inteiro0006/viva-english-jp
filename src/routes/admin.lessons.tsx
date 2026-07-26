import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAdminLessons } from "@/lib/admin/lessons.admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/lessons")({
  component: AdminLessonsPage,
});

function AdminLessonsPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listAdminLessons);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "published">("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "lessons", search, status],
    queryFn: () => list({ data: { search: search || undefined, status: status || undefined } }),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.lessons")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.lessons_.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t("admin.lessons_.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : (v as "draft" | "published"))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("admin.status.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.status.all")}</SelectItem>
              <SelectItem value="draft">{t("admin.status.draft")}</SelectItem>
              <SelectItem value="published">{t("admin.status.published")}</SelectItem>
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
                <TableHead>{t("admin.lessons_.lesson")}</TableHead>
                <TableHead>{t("admin.lessons_.module")}</TableHead>
                <TableHead>{t("admin.lessons_.type")}</TableHead>
                <TableHead>{t("admin.lessons_.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((l) => {
                const row = l as unknown as {
                  id: string;
                  title_ja: string;
                  title_en: string;
                  lesson_type: string;
                  status: string;
                  modules: { title_ja: string; title_en: string } | null;
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {i18n.language === "en" ? row.title_en : row.title_ja}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.modules
                        ? i18n.language === "en"
                          ? row.modules.title_en
                          : row.modules.title_ja
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {row.lesson_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "published" ? "default" : "outline"}>
                        {t(`admin.status.${row.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
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
