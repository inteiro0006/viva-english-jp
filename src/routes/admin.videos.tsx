import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, RefreshCw, Upload, Link2, Unlink, Plug, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  createStreamUpload,
  listStreamVideos,
  setLessonVideo,
  refreshStreamVideo,
  listLessonsForVideo,
  testCloudflareConnection,
  deleteStreamVideo,
} from "@/lib/stream/stream.functions";

export const Route = createFileRoute("/admin/videos")({
  head: () => ({
    meta: [
      { title: "Videos — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVideosPage,
});

type StreamVideo = {
  id: string;
  cloudflare_uid: string;
  title: string | null;
  status: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  ready_to_stream: boolean;
  created_at: string;
  lesson: { id: string; title_ja: string; title_en: string } | null;
};

function AdminVideosPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ja") ? "ja" : "en";
  const list = useServerFn(listStreamVideos);
  const lessonsFn = useServerFn(listLessonsForVideo);
  const qc = useQueryClient();

  const videosQ = useQuery({
    queryKey: ["admin-stream-videos"],
    queryFn: () => list() as Promise<StreamVideo[]>,
  });
  const lessonsQ = useQuery({
    queryKey: ["admin-lessons-for-video"],
    queryFn: () => lessonsFn(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-stream-videos"] });
    qc.invalidateQueries({ queryKey: ["admin-lessons-for-video"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("stream.admin.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("stream.admin.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <TestConnectionButton />
          <UploadDialog onUploaded={invalidate} />
        </div>
      </div>

      {videosQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : videosQ.data && videosQ.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("stream.admin.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(videosQ.data ?? []).map((v) => (
            <VideoRow
              key={v.id}
              video={v}
              lessons={lessonsQ.data ?? []}
              lang={lang}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "default";
  if (status === "error") return "destructive";
  return "secondary";
}

function VideoRow({
  video,
  lessons,
  lang,
  onChanged,
}: {
  video: StreamVideo;
  lessons: Array<{ id: string; title_ja: string; title_en: string; cloudflare_video_uid: string | null }>;
  lang: "ja" | "en";
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const refresh = useServerFn(refreshStreamVideo);
  const attach = useServerFn(setLessonVideo);
  const del = useServerFn(deleteStreamVideo);
  const [busy, setBusy] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doRefresh = async () => {
    setBusy(true);
    try {
      const result = await refresh({ data: { cloudflareUid: video.cloudflare_uid } });
      if (!result.ok) {
        toast.error(t("stream.admin.cloudflareAuthError"));
        return;
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const doAttach = async () => {
    if (!selectedLesson) return;
    setBusy(true);
    try {
      await attach({ data: { lessonId: selectedLesson, videoUid: video.cloudflare_uid } });
      toast.success("OK");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const doDetach = async () => {
    if (!video.lesson) return;
    setBusy(true);
    try {
      await attach({ data: { lessonId: video.lesson.id, videoUid: null } });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      const result = await del({ data: { cloudflareUid: video.cloudflare_uid } });
      if (!result.ok) {
        toast.error(t("stream.admin.cloudflareAuthError"));
        return;
      }
      toast.success(t("stream.admin.deleted"));
      setConfirmDelete(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const availableLessons = lessons.filter(
    (l) => !l.cloudflare_video_uid || l.cloudflare_video_uid === video.cloudflare_uid,
  );

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[160px_1fr_auto]">
        <div className="aspect-video overflow-hidden rounded-lg bg-neutral-900">
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{video.title ?? video.cloudflare_uid}</h3>
            <Badge variant={statusVariant(video.status)}>
              {t(`stream.admin.status.${video.status}`, { defaultValue: video.status })}
            </Badge>
            {video.ready_to_stream ? <Badge variant="outline">ready_to_stream</Badge> : null}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {video.cloudflare_uid}
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {t("stream.admin.duration")}:{" "}
              {video.duration_seconds
                ? `${Math.round(video.duration_seconds)}s`
                : "—"}
            </span>
            <span>
              {t("stream.admin.createdAt")}:{" "}
              {new Date(video.created_at).toLocaleString(lang === "ja" ? "ja-JP" : "en-US")}
            </span>
            <span>
              {t("stream.admin.attachedTo")}:{" "}
              {video.lesson ? (lang === "ja" ? video.lesson.title_ja : video.lesson.title_en) : t("stream.admin.notAttached")}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {video.lesson ? (
              <Button size="sm" variant="outline" onClick={doDetach} disabled={busy}>
                <Unlink className="mr-1 h-3.5 w-3.5" />
                {t("stream.admin.unassociate")}
              </Button>
            ) : (
              <>
                <Select value={selectedLesson} onValueChange={setSelectedLesson}>
                  <SelectTrigger className="h-8 w-64">
                    <SelectValue placeholder={t("stream.admin.chooseLesson")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLessons.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {lang === "ja" ? l.title_ja : l.title_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={doAttach} disabled={!selectedLesson || busy}>
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  {t("stream.admin.associate")}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(video.cloudflare_uid);
              toast.success(t("stream.admin.copied"));
            }}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            {t("stream.admin.copyUid")}
          </Button>
          <Button size="sm" variant="outline" onClick={doRefresh} disabled={busy}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {t("stream.admin.refresh")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("stream.admin.delete")}
          </Button>
        </div>
      </CardContent>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("stream.admin.deleteConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("stream.admin.deleteConfirmBody")}</p>
          <p className="mt-2 truncate text-sm font-medium">
            {video.title ?? video.cloudflare_uid}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              {t("stream.admin.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const { t } = useTranslation();
  const create = useServerFn(createStreamUpload);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const start = async () => {
    if (!file) return;
    try {
      const result = await create({ data: { title: title || undefined } });
      if (!result.ok) {
        toast.error(t("stream.admin.cloudflareAuthError"));
        return;
      }
      const { uploadURL } = result;
      setProgress(0);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("POST", uploadURL);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error"));
        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });
      toast.success(t("stream.admin.uploadedToast"));
      setOpen(false);
      setFile(null);
      setTitle("");
      setProgress(null);
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload error");
      setProgress(null);
    }
  };

  useEffect(() => {
    return () => xhrRef.current?.abort();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          {t("stream.admin.newUpload")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("stream.admin.uploadTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("stream.admin.uploadHint")}</p>
        <div className="mt-2 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("stream.admin.titleLabel")}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("stream.admin.fileLabel")}</label>
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {progress !== null ? (
            <div>
              <Progress value={progress} />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("stream.admin.uploading", { pct: progress })}
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button disabled={!file || progress !== null} onClick={start}>
            {t("stream.admin.startUpload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TestResult = Awaited<ReturnType<typeof testCloudflareConnection>>;

function TestConnectionButton() {
  const { t } = useTranslation();
  const test = useServerFn(testCloudflareConnection);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const r = await test();
      setResult(r);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={run} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plug className="mr-2 h-4 w-4" />
        )}
        {t("stream.admin.testConnection", "Test connection")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {result?.ok
                ? t("stream.admin.testOk", "Cloudflare Stream connected")
                : t("stream.admin.testFailed", "Connection failed")}
            </DialogTitle>
          </DialogHeader>
          {result ? (
            <div className="space-y-3 text-sm">
              <p className={result.ok ? "text-muted-foreground" : "text-destructive"}>
                {result.message}
              </p>
              {"totalVideos" in result && result.totalVideos !== null ? (
                <p className="text-muted-foreground">
                  {t("stream.admin.totalVideos", "Videos in account")}: {result.totalVideos}
                </p>
              ) : null}
              <div className="rounded-md border p-3">
                <p className="mb-2 font-medium">
                  {t("stream.admin.envChecks", "Environment checks")}
                </p>
                <ul className="space-y-1">
                  {Object.entries(result.checks).map(([k, v]) => (
                    <li key={k} className="flex items-center gap-2">
                      {v ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <code className="text-xs">{k}</code>
                    </li>
                  ))}
                </ul>
              </div>
              {!result.ok && "code" in result ? (
                <p className="text-xs text-muted-foreground">
                  code: <code>{result.code}</code>
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.close", "Close")}
            </Button>
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("stream.admin.testAgain", "Test again")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
