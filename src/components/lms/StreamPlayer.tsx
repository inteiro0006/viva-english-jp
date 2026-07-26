import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, PlayCircle } from "lucide-react";
import { getStreamPlaybackToken } from "@/lib/stream/stream.functions";

type Props = {
  lessonId: string;
  initialSeconds?: number;
  durationSeconds?: number;
  onProgress?: (seconds: number, percentage: number) => void;
  onComplete?: () => void;
  autoCompleteThreshold?: number; // 0..1
};

// Cloudflare Stream Player SDK (loaded on demand)
type StreamHandle = {
  addEventListener: (ev: string, cb: (e?: unknown) => void) => void;
  removeEventListener: (ev: string, cb: (e?: unknown) => void) => void;
  play: () => Promise<void>;
  pause: () => void;
  currentTime: number;
  duration: number;
};

declare global {
  interface Window {
    Stream?: (el: HTMLIFrameElement) => StreamHandle;
  }
}

async function ensureStreamSdk(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.Stream) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-cf-stream-sdk="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("sdk load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    s.async = true;
    s.dataset.cfStreamSdk = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk load failed"));
    document.head.appendChild(s);
  });
}

export function StreamPlayer({
  lessonId,
  initialSeconds = 0,
  durationSeconds = 0,
  onProgress,
  onComplete,
  autoCompleteThreshold = 0.9,
}: Props) {
  const { t } = useTranslation();
  const getToken = useServerFn(getStreamPlaybackToken);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "processing">("loading");
  const [message, setMessage] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSavedRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    : false;

  // Fetch signed token
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage("");
    getToken({ data: { lessonId } })
      .then((res) => {
        if (cancelled) return;
        setToken(res.token);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/unavailable/i.test(msg)) setStatus("processing");
        else setStatus("error");
        setMessage(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, getToken]);

  // Wire up Stream SDK once iframe is loaded
  useEffect(() => {
    if (status !== "ready" || !token) return;
    let handle: StreamHandle | null = null;
    let disposed = false;

    // Read latest state without needing to re-run the effect on every tick
    const snapshot = () => {
      if (!handle) return null;
      const dur = handle.duration || durationSeconds || 0;
      const sec = Math.min(Math.max(handle.currentTime || 0, 0), dur || Infinity);
      const pct = dur > 0 ? Math.min(100, Math.max(0, (sec / dur) * 100)) : 0;
      return { sec, pct };
    };

    const flush = () => {
      const s = snapshot();
      if (!s) return;
      lastSavedRef.current = Date.now();
      onProgress?.(Math.floor(s.sec), Math.round(s.pct));
      if (!completedRef.current && s.pct / 100 >= autoCompleteThreshold) {
        completedRef.current = true;
        onComplete?.();
      }
    };

    const persist = (force = false) => {
      const now = Date.now();
      // Throttle to ~1 save every 10s during playback
      if (!force && now - lastSavedRef.current < 10_000) return;
      flush();
    };

    const attach = async () => {
      try {
        await ensureStreamSdk();
        if (disposed || !iframeRef.current || !window.Stream) return;
        handle = window.Stream(iframeRef.current);

        const seekInitial = () => {
          if (handle && initialSeconds > 0 && Number.isFinite(handle.duration)) {
            const target = Math.min(initialSeconds, Math.max(0, handle.duration - 2));
            handle.currentTime = target;
          }
        };

        handle.addEventListener("loadedmetadata", seekInitial);
        handle.addEventListener("play", () => persist());
        handle.addEventListener("pause", () => persist(true));
        handle.addEventListener("seeked", () => persist());
        handle.addEventListener("timeupdate", () => persist());
        handle.addEventListener("ended", () => {
          persist(true);
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
        });
      } catch (e) {
        console.error(e);
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "SDK error");
      }
    };
    void attach();

    // Flush on tab hide / navigation
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      disposed = true;
      // Persist the latest known position when the lesson unmounts
      // (navigating between lessons, leaving the page, etc.)
      flush();
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [status, token, initialSeconds, durationSeconds, onProgress, onComplete, autoCompleteThreshold]);

  if (status === "loading") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900 text-white">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 className={`h-10 w-10 opacity-80 ${reducedMotion ? "" : "animate-spin"}`} />
          <p className="text-sm opacity-80">{t("stream.player.loading")}</p>
        </div>
      </div>
    );
  }
  if (status === "processing") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900 text-white">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <PlayCircle className="h-10 w-10 opacity-80" />
          <p className="text-sm">{t("stream.player.processing")}</p>
          <p className="text-xs opacity-70">{t("stream.player.processingNote")}</p>
        </div>
      </div>
    );
  }
  if (status === "error" || !token) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900 text-white">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm">{t("stream.player.error")}</p>
          {message ? <p className="text-xs opacity-60">{message}</p> : null}
        </div>
      </div>
    );
  }

  const src = `https://iframe.videodelivery.net/${token}?preload=metadata`;
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <iframe
        ref={iframeRef}
        src={src}
        title="Lesson video"
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
