import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin: creates a Cloudflare Stream Direct Creator Upload URL,
 * inserts a placeholder row in stream_videos, and returns the tempo URL + uid.
 */
export const createStreamUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        title: z.string().min(1).max(300).optional(),
        maxDurationSeconds: z.number().int().min(30).max(60 * 60 * 6).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    // Enforce admin via caller's RLS-scoped role check.
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");

    const { createDirectUpload } = await import("@/lib/stream/stream.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const upload = await createDirectUpload({
      maxDurationSeconds: data.maxDurationSeconds,
      requireSignedURLs: true,
      meta: { uploaded_by: context.userId, title: data.title ?? "" },
    });

    await supabaseAdmin.from("stream_videos").insert({
      cloudflare_uid: upload.uid,
      title: data.title ?? null,
      status: "pendingupload",
      ready_to_stream: false,
      require_signed_urls: true,
      uploaded_by: context.userId,
    });

    return { uid: upload.uid, uploadURL: upload.uploadURL };
  });

/**
 * Authenticated: returns a short-lived playback token for a lesson's video
 * ONLY when the caller has access (preview lesson OR active enrollment).
 * Never returns the token to a user without access.
 */
export const getStreamPlaybackToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ lessonId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    // Access is enforced by RLS on `lessons` (published + preview OR enrolled).
    // If the caller can't SELECT the row, they can't get a token.
    const { data: lesson, error } = await context.supabase
      .from("lessons")
      .select("id, cloudflare_video_uid, module_id, status, is_preview")
      .eq("id", data.lessonId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!lesson || !lesson.cloudflare_video_uid) {
      throw new Error("Video unavailable");
    }
    if (lesson.status !== "published") {
      throw new Error("Video unavailable");
    }

    const { signPlaybackToken } = await import("@/lib/stream/stream.server");
    const token = await signPlaybackToken({
      videoUid: lesson.cloudflare_video_uid,
      expiresInSeconds: 60 * 60,
    });
    return { token, expiresIn: 60 * 60 };
  });

/**
 * Admin: list uploaded stream videos + which lesson (if any) they are associated with.
 */
export const listStreamVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("stream_videos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const uids = (data ?? []).map((v) => v.cloudflare_uid);
    let lessonMap: Record<string, { id: string; title_ja: string; title_en: string }> = {};
    if (uids.length > 0) {
      const { data: lessons } = await context.supabase
        .from("lessons")
        .select("id, title_ja, title_en, cloudflare_video_uid")
        .in("cloudflare_video_uid", uids);
      lessonMap = Object.fromEntries(
        (lessons ?? []).map((l) => [
          l.cloudflare_video_uid as string,
          { id: l.id, title_ja: l.title_ja, title_en: l.title_en },
        ]),
      );
    }

    return (data ?? []).map((v) => ({
      ...v,
      lesson: lessonMap[v.cloudflare_uid] ?? null,
    }));
  });

/**
 * Admin: attach or detach a Cloudflare video UID from a lesson.
 * Passing videoUid = null clears the association without deleting the video.
 */
export const setLessonVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lessonId: z.string().uuid(),
        videoUid: z.string().min(1).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");

    const { error } = await context.supabase
      .from("lessons")
      .update({ cloudflare_video_uid: data.videoUid })
      .eq("id", data.lessonId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admin: refresh the local status of a video by polling Cloudflare Stream.
 * Used for the "processing" state before webhook arrives.
 */
export const refreshStreamVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cloudflareUid: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");

    const { getVideoInfo } = await import("@/lib/stream/stream.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const info = await getVideoInfo(data.cloudflareUid);
    await supabaseAdmin
      .from("stream_videos")
      .update({
        status: info.status?.state ?? "unknown",
        duration_seconds: info.duration ?? null,
        thumbnail_url: info.thumbnail ?? null,
        preview_url: info.preview ?? null,
        ready_to_stream: !!info.readyToStream,
        require_signed_urls: !!info.requireSignedURLs,
      })
      .eq("cloudflare_uid", data.cloudflareUid);
    return { ok: true, status: info.status?.state, readyToStream: info.readyToStream };
  });

/**
 * Admin: list lessons available to associate a video to.
 */
export const listLessonsForVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("lessons")
      .select("id, title_ja, title_en, cloudflare_video_uid, module_id")
      .order("position");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
