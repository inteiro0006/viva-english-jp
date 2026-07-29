import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Plus, Copy, ArrowUpRight } from "lucide-react";
import {
  listAdminCourses,
  createCourse,
  duplicateCourse,
  setCourseStatus,
} from "@/lib/admin/courses.admin.functions";
import { slugify } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/courses")({
  component: AdminCoursesPage,
});

function AdminCoursesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const list = useServerFn(listAdminCourses);
  const create = useServerFn(createCourse);
  const duplicate = useServerFn(duplicateCourse);
  const setStatus = useServerFn(setCourseStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: () => list(),
  });

  const dup = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.courses_.duplicated"));
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: (p: { id: string; status: "draft" | "published" | "archived" }) =>
      setStatus({ data: p }),
    onSuccess: () => {
      toast.success(t("admin.courses_.statusUpdated"));
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    title_ja: "",
    title_en: "",
    price_jpy: 49800,
  });
  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          slug: form.slug.trim().toLowerCase(),
          title_ja: form.title_ja,
          title_en: form.title_en,
          price_jpy: form.price_jpy,
          access_type: "lifetime",
          status: "draft",
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.courses_.created"));
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      setOpen(false);
      setForm({ slug: "", title_ja: "", title_en: "", price_jpy: 49800 });
    },
    onError: (e: Error) => {
      let msg = e.message;
      try {
        const parsed = JSON.parse(e.message);
        if (Array.isArray(parsed) && parsed[0]?.path?.[0] === "slug") {
          msg = t("admin.courses_.errors.invalid_slug");
        } else if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed[0].message;
        }
      } catch {
        // not JSON, keep original message
      }
      toast.error(msg);
    },
  });


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.courses")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.courses_.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" /> {t("admin.courses_.new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.courses_.new")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Field id="slug" label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="eigo-mastery" />
              <Field id="title_ja" label={t("admin.courses_.titleJa")} value={form.title_ja} onChange={(v) => setForm({ ...form, title_ja: v })} />
              <Field id="title_en" label={t("admin.courses_.titleEn")} value={form.title_en} onChange={(v) => setForm({ ...form, title_en: v })} />
              <div className="space-y-1.5">
                <Label htmlFor="price">{t("admin.courses_.price")}</Label>
                <Input
                  id="price"
                  type="number"
                  value={form.price_jpy}
                  onChange={(e) => setForm({ ...form, price_jpy: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-64 w-full" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.courses_.title")}</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>{t("admin.courses_.price")}</TableHead>
                <TableHead>{t("admin.courses_.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/admin/courses/$courseId"
                      params={{ courseId: c.id }}
                      className="hover:underline"
                    >
                      {i18n.language === "en" ? c.title_en : c.title_ja}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="tabular-nums">¥{c.price_jpy.toLocaleString()}</TableCell>
                  <TableCell>
                    <Select
                      value={c.status}
                      onValueChange={(v) =>
                        status.mutate({ id: c.id, status: v as "draft" | "published" | "archived" })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">
                          <StatusBadge s="draft" t={t} />
                        </SelectItem>
                        <SelectItem value="published">
                          <StatusBadge s="published" t={t} />
                        </SelectItem>
                        <SelectItem value="archived">
                          <StatusBadge s="archived" t={t} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => dup.mutate(c.id)}
                        aria-label="Duplicate"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" asChild aria-label="Open">
                        <Link to="/admin/courses/$courseId" params={{ courseId: c.id }}>
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
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

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function StatusBadge({
  s,
  t,
}: {
  s: "draft" | "published" | "archived";
  t: (k: string) => string;
}) {
  const map: Record<string, "outline" | "default" | "secondary"> = {
    draft: "outline",
    published: "default",
    archived: "secondary",
  };
  return <Badge variant={map[s]}>{t(`admin.status.${s}`)}</Badge>;
}
