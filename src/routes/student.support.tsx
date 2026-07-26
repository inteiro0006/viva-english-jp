import { createFileRoute } from "@tanstack/react-router";
// SEO: protected route — must not be indexed
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Paperclip, Search, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  createSupportRequest,
  createSupportRequestSchema,
  listFaq,
  listMySupportRequests,
  SUPPORT_CATEGORIES,
} from "@/lib/support/support.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/student/support")({
  head: () => ({
    meta: [
      { title: "サポート — Eigo Michi" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "お問い合わせ、よくある質問、過去の問い合わせ履歴。" },
    ],
  }),
  component: SupportPage,
});

const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
const ATTACH_TYPES = ["image/jpeg", "image/png", "application/pdf"];

type FormValues = z.infer<typeof createSupportRequestSchema>;

function SupportPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ja") ? "ja" : "en";
  const qc = useQueryClient();
  const fetchFaq = useServerFn(listFaq);
  const fetchRequests = useServerFn(listMySupportRequests);
  const submitRequest = useServerFn(createSupportRequest);

  const faqQuery = useQuery({ queryKey: ["support-faq"], queryFn: () => fetchFaq() });
  const requestsQuery = useQuery({
    queryKey: ["support-requests"],
    queryFn: () => fetchRequests(),
  });

  const [search, setSearch] = useState("");
  const filteredFaq = useMemo(() => {
    const items = faqQuery.data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((f) => {
      const hay = [f.question_ja, f.question_en, f.answer_ja, f.answer_en]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [faqQuery.data, search]);

  const form = useForm<FormValues>({
    resolver: zodResolver(createSupportRequestSchema),
    defaultValues: {
      subject: "",
      message: "",
      category: "other",
      attachment_url: null,
    },
  });
  const [uploading, setUploading] = useState(false);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleAttach(file: File) {
    if (!ATTACH_TYPES.includes(file.type)) {
      toast.error(t("student.support.errors.attachType"));
      return;
    }
    if (file.size > ATTACH_MAX_BYTES) {
      toast.error(t("student.support.errors.attachSize"));
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("no user");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      form.setValue("attachment_url", path, { shouldDirty: true });
      setAttachmentName(file.name);
    } catch (err) {
      toast.error(
        (err as Error).message || t("student.support.form.attachmentUploadFailed"),
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAttachment() {
    const p = form.getValues("attachment_url");
    if (p && !p.startsWith("http")) {
      void supabase.storage.from("support-attachments").remove([p]);
    }
    form.setValue("attachment_url", null, { shouldDirty: true });
    setAttachmentName(null);
  }

  const submitMutation = useMutation({
    mutationFn: (values: FormValues) => submitRequest({ data: values }),
    onSuccess: () => {
      toast.success(t("student.support.form.success"));
      form.reset({
        subject: "",
        message: "",
        category: "other",
        attachment_url: null,
      });
      setAttachmentName(null);
      qc.invalidateQueries({ queryKey: ["support-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("student.support.errors.failed"));
    },
  });

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [lang],
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("student.support.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("student.support.subtitle")}
        </p>
      </header>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>{t("student.support.faq.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("student.support.faq.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          {faqQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : filteredFaq.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("student.support.faq.noResults")}
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filteredFaq.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="text-left">
                    {lang === "ja" ? item.question_ja : item.question_en}
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line text-sm text-muted-foreground">
                    {lang === "ja" ? item.answer_ja : item.answer_en}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("student.support.form.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))}
            noValidate
          >
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="category">
                {t("student.support.form.category")}
              </Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) =>
                  form.setValue(
                    "category",
                    v as (typeof SUPPORT_CATEGORIES)[number],
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`student.support.categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subject">
                {t("student.support.form.subject")}
              </Label>
              <Input
                id="subject"
                maxLength={160}
                placeholder={t("student.support.form.subjectPlaceholder")}
                {...form.register("subject")}
                aria-invalid={!!form.formState.errors.subject}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="message">
                {t("student.support.form.message")}
              </Label>
              <Textarea
                id="message"
                rows={6}
                maxLength={4000}
                placeholder={t("student.support.form.messagePlaceholder")}
                {...form.register("message")}
                aria-invalid={!!form.formState.errors.message}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t("student.support.form.attachment")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAttach(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-4" aria-hidden />
                  {t("student.support.form.attachment")}
                </Button>
                {attachmentName ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs">
                    <span className="max-w-[16ch] truncate">{attachmentName}</span>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={t("student.support.form.attachmentRemove")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("student.support.form.attachmentHint")}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={submitMutation.isPending || uploading}
              >
                {submitMutation.isPending
                  ? t("student.support.form.submitting")
                  : t("student.support.form.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("student.support.history.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {requestsQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (requestsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("student.support.history.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(requestsQuery.data ?? []).map((r) => (
                <li key={r.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{r.subject}</span>
                      <Badge variant="outline">
                        {t(`student.support.categories.${r.category}`)}
                      </Badge>
                      <Badge>{t(`student.support.status.${r.status}`)}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(r.created_at))}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {r.message}
                  </p>
                  {r.response ? (
                    <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("student.support.history.response")}
                      </p>
                      <p className="whitespace-pre-line">{r.response}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
