import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/cloudflare-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sigHeader = request.headers.get("webhook-signature") ?? "";

        const { verifyStreamWebhook } = await import("@/lib/stream/stream.server");
        const ok = await verifyStreamWebhook(rawBody, sigHeader);
        if (!ok) return new Response("invalid signature", { status: 401 });

        let payload: {
          uid?: string;
          status?: { state?: string };
          duration?: number;
          thumbnail?: string;
          preview?: string;
          readyToStream?: boolean;
          eventId?: string;
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("bad payload", { status: 400 });
        }

        if (!payload.uid) return new Response("missing uid", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: log event; ignore duplicates.
        const eventId =
          payload.eventId ??
          `${payload.uid}:${payload.status?.state ?? "unknown"}:${payload.readyToStream ? "1" : "0"}`;
        const { error: logErr } = await supabaseAdmin
          .from("stream_webhook_events")
          .insert({
            event_id: eventId,
            cloudflare_uid: payload.uid,
            event_type: payload.status?.state ?? null,
            payload,
          });
        // duplicate key = already processed
        if (logErr && !/duplicate key/i.test(logErr.message)) {
          console.error("webhook log error", logErr);
        }
        if (logErr && /duplicate key/i.test(logErr.message)) {
          return new Response("ok", { status: 200 });
        }

        await supabaseAdmin
          .from("stream_videos")
          .update({
            status: payload.status?.state ?? "unknown",
            duration_seconds: payload.duration ?? null,
            thumbnail_url: payload.thumbnail ?? null,
            preview_url: payload.preview ?? null,
            ready_to_stream: !!payload.readyToStream,
          })
          .eq("cloudflare_uid", payload.uid);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
