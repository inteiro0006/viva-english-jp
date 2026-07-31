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

    let upload: Awaited<ReturnType<typeof createDirectUpload>>;
    try {
      upload = await createDirectUpload({
        maxDurationSeconds: data.maxDurationSeconds,
        requireSignedURLs: true,
        meta: { uploaded_by: context.userId, title: data.title ?? "" },
      });
    } catch (error) {
      const isCloudflareAuthError =
        error instanceof Error &&
        (error.message.includes('"code":10000') || error.message.includes("Authentication error"));
      if (isCloudflareAuthError) {
        return {
          ok: false as const,
          code: "cloudflare_auth" as const,
          message:
            "Cloudflare authentication failed. Update CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN with a token that has Stream Edit access for the selected account.",
        };
      }
      if (error instanceof Error && error.message.includes("Cloudflare Stream env vars missing")) {
        return {
          ok: false as const,
          code: "cloudflare_config" as const,
          message: "Cloudflare Stream is not fully configured.",
        };
      }
      throw error;
    }

    await supabaseAdmin.from("stream_videos").insert({
      cloudflare_uid: upload.uid,
      title: data.title ?? null,
      status: "pendingupload",
      ready_to_stream: false,
      require_signed_urls: true,
      uploaded_by: context.userId,
    });

    return { ok: true as const, uid: upload.uid, uploadURL: upload.uploadURL };
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
    // Authoritative access gate: published course/module/lesson, module released,
    // and preview OR active enrollment OR admin. Evaluated in the database.
    const { data: allowed, error: accessError } = await context.supabase.rpc("can_access_lesson", {
      _uid: context.userId,
      _lesson_id: data.lessonId,
    });
    if (accessError) throw new Error(accessError.message);
    if (allowed !== true) throw new Error("Forbidden");

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
    let info: Awaited<ReturnType<typeof getVideoInfo>>;
    try {
      info = await getVideoInfo(data.cloudflareUid);
    } catch (error) {
      const isCloudflareAuthError =
        error instanceof Error &&
        (error.message.includes('"code":10000') || error.message.includes("Authentication error"));
      if (isCloudflareAuthError) {
        return {
          ok: false as const,
          code: "cloudflare_auth" as const,
          message:
            "Cloudflare authentication failed. Update CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.",
        };
      }
      throw error;
    }
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
    return { ok: true as const, status: info.status?.state, readyToStream: info.readyToStream };
  });

/**
 * Admin: permanently delete a video from Cloudflare Stream and detach it
 * from any lesson that references it. Removes the local stream_videos row.
 */
export const deleteStreamVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cloudflareUid: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");

    const { deleteStreamVideo: cfDelete } = await import("@/lib/stream/stream.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      await cfDelete(data.cloudflareUid);
    } catch (error) {
      const isCloudflareAuthError =
        error instanceof Error &&
        (error.message.includes('"code":10000') || error.message.includes("Authentication error"));
      if (isCloudflareAuthError) {
        return {
          ok: false as const,
          code: "cloudflare_auth" as const,
          message:
            "Cloudflare authentication failed. Update CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.",
        };
      }
      throw error;
    }

    // Detach from any lessons referencing this uid.
    await supabaseAdmin
      .from("lessons")
      .update({ cloudflare_video_uid: null })
      .eq("cloudflare_video_uid", data.cloudflareUid);

    const { error } = await supabaseAdmin
      .from("stream_videos")
      .delete()
      .eq("cloudflare_uid", data.cloudflareUid);
    if (error) throw new Error(error.message);

    return { ok: true as const };
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

/**
 * Admin: tests Cloudflare Stream credentials by calling a lightweight endpoint.
 * Returns structured status so the UI can show configuration health.
 */
export const testCloudflareConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!role) throw new Error("Forbidden");

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
    const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    const signingKeyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
    const signingKeyPem = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;

    const missing: string[] = [];
    if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");
    if (!apiToken) missing.push("CLOUDFLARE_STREAM_API_TOKEN");
    if (!webhookSecret) missing.push("CLOUDFLARE_STREAM_WEBHOOK_SECRET");
    if (missing.length > 0) {
      return {
        ok: false as const,
        code: "missing_config" as const,
        message: `Missing environment variables: ${missing.join(", ")}`,
        checks: {
          accountId: !!accountId,
          apiToken: !!apiToken,
          webhookSecret: !!webhookSecret,
          signingKey: !!(signingKeyId && signingKeyPem),
        },
      };
    }

    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?per_page=1`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );
      const json = (await res.json()) as {
        success: boolean;
        errors?: Array<{ code: number; message: string }>;
        result?: unknown[];
        result_info?: { total_count?: number };
      };
      if (!res.ok || !json.success) {
        const first = json.errors?.[0];
        const isAuth = first?.code === 10000 || first?.message?.toLowerCase().includes("auth");
        return {
          ok: false as const,
          code: (isAuth ? "cloudflare_auth" : "cloudflare_error") as
            | "cloudflare_auth"
            | "cloudflare_error",
          status: res.status,
          message: first?.message ?? `HTTP ${res.status}`,
          errors: json.errors ?? [],
          checks: {
            accountId: true,
            apiToken: true,
            webhookSecret: true,
            signingKey: !!(signingKeyId && signingKeyPem),
          },
        };
      }
      return {
        ok: true as const,
        message: "Cloudflare Stream credentials are valid.",
        totalVideos: json.result_info?.total_count ?? null,
        checks: {
          accountId: true,
          apiToken: true,
          webhookSecret: true,
          signingKey: !!(signingKeyId && signingKeyPem),
        },
      };
    } catch (error) {
      return {
        ok: false as const,
        code: "network_error" as const,
        message: error instanceof Error ? error.message : "Network error",
        checks: {
          accountId: true,
          apiToken: true,
          webhookSecret: true,
          signingKey: !!(signingKeyId && signingKeyPem),
        },
      };
    }
  });
