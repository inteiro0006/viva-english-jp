import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listStudents,
  listAllUsers,
  getStudentDetail,
  grantEnrollment,
  revokeEnrollment,
  sendPasswordReset,
} from "@/lib/admin/students.admin.functions";
import { listAdminCourses } from "@/lib/admin/courses.admin.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/admin/students")({
  component: AdminStudentsPage,
});

function AdminStudentsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const list = useServerFn(listStudents);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enrolled" | "not_enrolled">("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", search, filter, page],
    queryFn: () => list({ data: { search: search || undefined, filter, page } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "students"] });
    if (selected) qc.invalidateQueries({ queryKey: ["admin", "student", selected] });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.students")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.students_.subtitle")}</p>
      </header>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">{t("admin.students_.tabs.students")}</TabsTrigger>
          <TabsTrigger value="all">{t("admin.students_.tabs.allUsers")}</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Input
              placeholder={t("admin.students_.search")}
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              className="w-64"
            />
            <Select
              value={filter}
              onValueChange={(v) => {
                setPage(0);
                setFilter(v as never);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.students_.filter.all")}</SelectItem>
                <SelectItem value="enrolled">{t("admin.students_.filter.enrolled")}</SelectItem>
                <SelectItem value="not_enrolled">
                  {t("admin.students_.filter.notEnrolled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            {isLoading ? (
              <div className="p-4">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.students_.name")}</TableHead>
                    <TableHead>{t("admin.students_.allUsers.email")}</TableHead>
                    <TableHead>{t("admin.students_.language")}</TableHead>
                    <TableHead>{t("admin.students_.enrollments")}</TableHead>
                    <TableHead>{t("admin.students_.since")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).map((s) => (
                    <TableRow
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{s.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(s as { email?: string | null }).email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.preferred_language.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        {(s.enrollments ?? []).filter((e) => e.status === "active").length}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(i18n.language)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.rows ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
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
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <AllUsersTab onSelect={setSelected} />
        </TabsContent>
      </Tabs>

      <StudentDrawer userId={selected} onClose={() => setSelected(null)} onChange={invalidate} />
    </div>
  );
}

function AllUsersTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listAllUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "admin" | "student">("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "all-users", search, role, page],
    queryFn: () => list({ data: { search: search || undefined, role, page } }),
  });

  return (
    <>
      <p className="text-sm text-muted-foreground">{t("admin.students_.allUsers.subtitle")}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Input
          placeholder={t("admin.students_.allUsers.search")}
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
          className="w-64"
        />
        <Select
          value={role}
          onValueChange={(v) => {
            setPage(0);
            setRole(v as never);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.students_.allUsers.roleFilter.all")}</SelectItem>
            <SelectItem value="admin">{t("admin.students_.allUsers.roleFilter.admin")}</SelectItem>
            <SelectItem value="student">
              {t("admin.students_.allUsers.roleFilter.student")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.students_.name")}</TableHead>
                <TableHead>{t("admin.students_.allUsers.email")}</TableHead>
                <TableHead>{t("admin.students_.allUsers.role")}</TableHead>
                <TableHead>{t("admin.students_.language")}</TableHead>
                <TableHead>{t("admin.students_.since")}</TableHead>
                <TableHead>{t("admin.students_.allUsers.lastSignIn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((u) => (
                <TableRow
                  key={u.id}
                  onClick={() => onSelect(u.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{(u.preferred_language ?? "ja").toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString(i18n.language)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString(i18n.language)
                      : t("admin.students_.allUsers.never")}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.rows ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
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
    </>
  );
}

function StudentDrawer({
  userId,
  onClose,
  onChange,
}: {
  userId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const { t, i18n } = useTranslation();
  const detail = useServerFn(getStudentDetail);
  const listCourses = useServerFn(listAdminCourses);
  const grant = useServerFn(grantEnrollment);
  const revoke = useServerFn(revokeEnrollment);
  const resetPw = useServerFn(sendPasswordReset);
  const [courseId, setCourseId] = useState("");

  const { data } = useQuery({
    queryKey: ["admin", "student", userId],
    queryFn: () => detail({ data: { userId: userId! } }),
    enabled: !!userId,
  });
  const { data: courses } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: () => listCourses(),
    enabled: !!userId,
  });

  const grantMut = useMutation({
    mutationFn: () => grant({ data: { user_id: userId!, course_id: courseId } }),
    onSuccess: () => {
      toast.success(t("admin.students_.granted"));
      onChange();
      setCourseId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resetMut = useMutation({
    mutationFn: () => resetPw({ data: { userId: userId! } }),
    onSuccess: (r: { email: string }) =>
      toast.success(
        t("admin.students_.resetSent", {
          email: r.email,
          defaultValue: `Password reset link sent to ${r.email}`,
        }),
      ),
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { enrollment_id: id } }),
    onSuccess: () => {
      toast.success(t("admin.students_.revoked"));
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data?.profile?.full_name ?? "—"}</SheetTitle>
          <SheetDescription>{t("admin.students_.detailDesc")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          <section>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending}
            >
              {resetMut.isPending
                ? t("common.loading")
                : t("admin.students_.sendResetLink", { defaultValue: "Send password reset link" })}
            </Button>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">{t("admin.students_.grant")}</h3>
            <div className="flex gap-2">
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("admin.students_.selectCourse")} />
                </SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {i18n.language === "en" ? c.title_en : c.title_ja}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => grantMut.mutate()} disabled={!courseId || grantMut.isPending}>
                {t("admin.students_.grantAction")}
              </Button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t("admin.students_.enrollments")}</h3>
            <ul className="space-y-2">
              {(data?.enrollments ?? []).map((e) => {
                const row = e as unknown as {
                  id: string;
                  status: string;
                  expires_at: string | null;
                  enrolled_at: string;
                  courses: { title_ja: string; title_en: string } | null;
                };
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between rounded border border-border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {row.courses
                          ? i18n.language === "en"
                            ? row.courses.title_en
                            : row.courses.title_ja
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Badge
                          variant={row.status === "active" ? "default" : "outline"}
                          className="mr-2"
                        >
                          {row.status}
                        </Badge>
                        {new Date(row.enrolled_at).toLocaleDateString(i18n.language)}
                      </p>
                    </div>
                    {row.status === "active" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {t("admin.students_.revoke")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("admin.students_.confirmRevoke")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.students_.confirmRevokeDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revokeMut.mutate(row.id)}>
                              {t("admin.students_.revoke")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </li>
                );
              })}
              {(data?.enrollments ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              )}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t("admin.students_.orders")}</h3>
            <ul className="space-y-1.5 text-sm">
              {(data?.orders ?? []).map((o) => (
                <li key={o.id} className="flex items-center justify-between">
                  <span className="font-mono text-xs">{o.id.slice(0, 8)}…</span>
                  <span className="tabular-nums">¥{o.amount.toLocaleString()}</span>
                  <Badge variant={o.status === "paid" ? "default" : "outline"}>{o.status}</Badge>
                </li>
              ))}
              {(data?.orders ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              )}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
