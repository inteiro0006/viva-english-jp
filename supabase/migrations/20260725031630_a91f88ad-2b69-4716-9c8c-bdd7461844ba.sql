
CREATE TABLE public.stream_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cloudflare_uid TEXT NOT NULL UNIQUE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pendingupload',
  duration_seconds NUMERIC,
  thumbnail_url TEXT,
  preview_url TEXT,
  ready_to_stream BOOLEAN NOT NULL DEFAULT false,
  require_signed_urls BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stream_videos TO authenticated;
GRANT ALL ON public.stream_videos TO service_role;

ALTER TABLE public.stream_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stream videos"
  ON public.stream_videos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Students read videos of accessible lessons"
  ON public.stream_videos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.cloudflare_video_uid = stream_videos.cloudflare_uid
        AND l.status = 'published'
        AND (
          l.is_preview
          OR public.has_active_enrollment(auth.uid(), m.course_id)
        )
    )
  );

CREATE TRIGGER stream_videos_updated_at
  BEFORE UPDATE ON public.stream_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX stream_videos_uploaded_by_idx ON public.stream_videos(uploaded_by);

-- Webhook event log (idempotency)
CREATE TABLE public.stream_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT UNIQUE,
  cloudflare_uid TEXT,
  event_type TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stream_webhook_events TO authenticated;
GRANT ALL ON public.stream_webhook_events TO service_role;

ALTER TABLE public.stream_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook events"
  ON public.stream_webhook_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX stream_webhook_events_uid_idx ON public.stream_webhook_events(cloudflare_uid);
