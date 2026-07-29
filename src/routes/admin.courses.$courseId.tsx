import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { getAdminCourse, updateCourse, deleteCourse } from "@/lib/admin/courses.admin.functions";
import {
  createModule,
  deleteModule,
  reorderModules,
  updateModule,
} from "@/lib/admin/modules.admin.functions";
import {
  createLesson,
  deleteLesson,
  reorderLessons,
  setLessonPublished,
  updateLesson,
} from "@/lib/admin/lessons.admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/courses/$courseId")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "curriculum" ? ("curriculum" as const) : ("details" as const),
  }),
  component: AdminCourseEditor,
});


type Lesson = {
  id: string;
  module_id: string;
  title_ja: string;
  title_en: string;
  status: string;
  lesson_type: string;
  position: number;
  is_preview: boolean;
};
type Module = {
  id: string;
  course_id: string;
  title_ja: string;
  title_en: string;
  status: string;
  position: number;
  lessons: Lesson[];
};

function AdminCourseEditor() {
  const { courseId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const fetchCourse = useServerFn(getAdminCourse);
  const patchCourse = useServerFn(updateCourse);



  const { data, isLoading } = useQuery({
    queryKey: ["admin", "course", courseId],
    queryFn: () => fetchCourse({ data: { id: courseId } }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "course", courseId] });

  const saveCourse = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      patchCourse({ data: { id: courseId, patch: patch as never } }),
    onSuccess: () => {
      toast.success(t("admin.courses_.saved"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const modules: Module[] = ((data.modules ?? []) as unknown as Module[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      ...m,
      lessons: (m.lessons ?? []).slice().sort((a, b) => a.position - b.position),
    }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {i18n.language === "en" ? data.title_en : data.title_ja}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">{data.slug}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            to: "/admin/courses/$courseId",
            params: { courseId },
            search: { tab: v === "curriculum" ? "curriculum" : "details" },
            replace: true,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="details">{t("admin.courses_.tabs.details")}</TabsTrigger>
          <TabsTrigger value="curriculum">{t("admin.courses_.tabs.curriculum")}</TabsTrigger>
        </TabsList>


        <TabsContent value="details" className="pt-4">
          <CourseDetailsForm
            course={data as never}
            onSave={(patch) => saveCourse.mutate(patch)}
            saving={saveCourse.isPending}
          />
        </TabsContent>

        <TabsContent value="curriculum" className="pt-4">
          <CurriculumTree courseId={courseId} modules={modules} onChange={invalidate} />
        </TabsContent>
      </Tabs>

      <DangerZone courseId={courseId} slug={data.slug} />
    </div>
  );
}

function DangerZone({ courseId, slug }: { courseId: string; slug: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useServerFn(deleteCourse);
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  const remove = useMutation({
    mutationFn: () => del({ data: { id: courseId, confirmSlug } }),
    onSuccess: () => {
      toast.success(t("admin.courses_.danger.deleted"));
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      setOpen(false);
      navigate({ to: "/admin/courses" });
    },
    onError: (e: Error) => {
      const key = `admin.courses_.errors.${e.message}`;
      const translated = t(key);
      toast.error(translated === key ? e.message : translated);
    },
  });

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">{t("admin.courses_.danger.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("admin.courses_.danger.description")}
        </p>
        <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmSlug(""); }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              {t("admin.courses_.danger.delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.courses_.danger.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.courses_.danger.confirmDesc")}{" "}
                <span className="font-mono font-semibold text-foreground">{slug}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={t("admin.courses_.danger.confirmPlaceholder")}
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.courses_.danger.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmSlug !== slug || remove.isPending}
                onClick={(e) => { e.preventDefault(); remove.mutate(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("admin.courses_.danger.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function CourseDetailsForm({
  course,
  onSave,
  saving,
}: {
  course: {
    slug: string;
    title_ja: string;
    title_en: string;
    description_ja: string | null;
    description_en: string | null;
    price_jpy: number;
    status: "draft" | "published" | "archived";
    thumbnail_url: string | null;
    cover_url: string | null;
  };
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(course);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Group label="Slug">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Group>
          <Group label={t("admin.courses_.price")}>
            <Input
              type="number"
              value={form.price_jpy}
              onChange={(e) => setForm({ ...form, price_jpy: Number(e.target.value) || 0 })}
            />
          </Group>
          <Group label={t("admin.courses_.titleJa")}>
            <Input value={form.title_ja} onChange={(e) => setForm({ ...form, title_ja: e.target.value })} />
          </Group>
          <Group label={t("admin.courses_.titleEn")}>
            <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
          </Group>
          <Group label={t("admin.courses_.descJa")}>
            <Textarea rows={4} value={form.description_ja ?? ""} onChange={(e) => setForm({ ...form, description_ja: e.target.value })} />
          </Group>
          <Group label={t("admin.courses_.descEn")}>
            <Textarea rows={4} value={form.description_en ?? ""} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
          </Group>
          <Group label={t("admin.courses_.thumbnail")}>
            <Input value={form.thumbnail_url ?? ""} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://…" />
          </Group>
          <Group label={t("admin.courses_.cover")}>
            <Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://…" />
          </Group>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() =>
              onSave({
                slug: form.slug,
                title_ja: form.title_ja,
                title_en: form.title_en,
                description_ja: form.description_ja,
                description_en: form.description_en,
                price_jpy: form.price_jpy,
                thumbnail_url: form.thumbnail_url,
                cover_url: form.cover_url,
              })
            }
            disabled={saving}
          >
            {t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CurriculumTree({
  courseId,
  modules,
  onChange,
}: {
  courseId: string;
  modules: Module[];
  onChange: () => void;
}) {
  const { t, i18n } = useTranslation();
  const create = useServerFn(createModule);
  const reorder = useServerFn(reorderModules);
  const [order, setOrder] = useState(modules.map((m) => m.id));

  // Sync local order when server state changes count.
  useMemo(() => setOrder(modules.map((m) => m.id)), [modules.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const modulesById = new Map(modules.map((m) => [m.id, m]));

  const doReorder = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { courseId, ids } }),
    onSuccess: () => {
      toast.success(t("admin.courses_.reordered"));
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addModule = useMutation({
    mutationFn: () =>
      create({
        data: {
          course_id: courseId,
          title_ja: "新しいモジュール",
          title_en: "New module",
          release_type: "immediate",
          status: "draft",
        },
      }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    doReorder.mutate(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => addModule.mutate()} disabled={addModule.isPending}>
          <Plus className="mr-2 size-4" /> {t("admin.modules_.new")}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {order.map((id) => {
              const m = modulesById.get(id);
              if (!m) return null;
              return (
                <SortableModule
                  key={m.id}
                  module={m}
                  lang={i18n.language}
                  onChange={onChange}
                />
              );
            })}
            {order.length === 0 && (
              <p className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t("admin.modules_.empty")}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableModule({
  module: m,
  lang,
  onChange,
}: {
  module: Module;
  lang: string;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
  });
  const [expanded, setExpanded] = useState(true);
  const updateM = useServerFn(updateModule);
  const delM = useServerFn(deleteModule);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const upd = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateM({ data: { id: m.id, patch: patch as never } }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => delM({ data: { id: m.id } }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          aria-label="Drag"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="text-muted-foreground"
          aria-label="Toggle"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <CardTitle className="flex-1 text-sm font-medium">
          <Input
            className="h-8"
            defaultValue={lang === "en" ? m.title_en : m.title_ja}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== (lang === "en" ? m.title_en : m.title_ja)) {
                upd.mutate(lang === "en" ? { title_en: v } : { title_ja: v });
              }
            }}
          />
        </CardTitle>
        <Select
          value={m.status}
          onValueChange={(v) => upd.mutate({ status: v })}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t("admin.status.draft")}</SelectItem>
            <SelectItem value="published">{t("admin.status.published")}</SelectItem>
            <SelectItem value="archived">{t("admin.status.archived")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (confirm(t("admin.modules_.confirmDelete"))) del.mutate();
          }}
          aria-label="Delete"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <LessonList module={m} lang={lang} onChange={onChange} />
        </CardContent>
      )}
    </Card>
  );
}

function LessonList({
  module: m,
  lang,
  onChange,
}: {
  module: Module;
  lang: string;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const createL = useServerFn(createLesson);
  const reorderL = useServerFn(reorderLessons);
  const setPub = useServerFn(setLessonPublished);
  const delL = useServerFn(deleteLesson);
  const [order, setOrder] = useState(m.lessons.map((l) => l.id));
  useMemo(() => setOrder(m.lessons.map((l) => l.id)), [m.lessons.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const byId = new Map(m.lessons.map((l) => [l.id, l]));

  const doReorder = useMutation({
    mutationFn: (ids: string[]) => reorderL({ data: { moduleId: m.id, ids } }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });
  const add = useMutation({
    mutationFn: () =>
      createL({
        data: {
          module_id: m.id,
          title_ja: "新しいレッスン",
          title_en: "New lesson",
          lesson_type: "video",
          duration_seconds: 0,
          is_preview: false,
          status: "draft",
        },
      }),
    onSuccess: () => onChange(),
    onError: (e: Error) => toast.error(e.message),
  });

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    doReorder.mutate(next);
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((id) => {
            const l = byId.get(id);
            if (!l) return null;
            return (
              <SortableLesson
                key={l.id}
                lesson={l}
                lang={lang}
                onTogglePublish={() =>
                  setPub({
                    data: { id: l.id, status: l.status === "published" ? "draft" : "published" },
                  }).then(onChange).catch((e: Error) => toast.error(e.message))
                }
                onRename={(title_ja, title_en) =>
                  updL({ data: { id: l.id, patch: { title_ja, title_en } } })
                    .then(() => {
                      toast.success(t("admin.lessons_.updated"));
                      onChange();
                    })
                    .catch((e: Error) => toast.error(e.message))
                }
                onDelete={() => {
                  if (confirm(t("admin.lessons_.confirmDelete"))) {
                    delL({ data: { id: l.id } }).then(onChange).catch((e: Error) => toast.error(e.message));
                  }
                }}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={add.isPending}>
        <Plus className="mr-2 size-4" /> {t("admin.lessons_.new")}
      </Button>
    </div>
  );
}

function SortableLesson({
  lesson: l,
  lang,
  onTogglePublish,
  onDelete,
}: {
  lesson: Lesson;
  lang: string;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: l.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const { t } = useTranslation();
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
    >
      <button className="cursor-grab text-muted-foreground" aria-label="Drag" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 truncate">{lang === "en" ? l.title_en : l.title_ja}</span>
      <Badge variant="outline" className="text-[10px] uppercase">{l.lesson_type}</Badge>
      {l.is_preview && <Badge variant="secondary">Preview</Badge>}
      <Button size="sm" variant="ghost" onClick={onTogglePublish}>
        {l.status === "published" ? t("admin.status.published") : t("admin.status.draft")}
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
