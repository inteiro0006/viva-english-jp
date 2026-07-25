
-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.course_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.access_type AS ENUM ('lifetime','limited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lesson_type AS ENUM ('video','text','quiz','file');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.release_type AS ENUM ('immediate','date','after_previous');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('active','expired','revoked','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending','paid','failed','refunded','partially_refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_status AS ENUM ('open','in_progress','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_type AS ENUM ('pdf','link','download','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- HELPER: is_admin (wrapper around has_role)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- =========================================================
-- TABLES
-- =========================================================

-- courses
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ja text NOT NULL,
  title_en text NOT NULL,
  slug text NOT NULL UNIQUE,
  description_ja text,
  description_en text,
  thumbnail_url text,
  cover_url text,
  price_jpy integer NOT NULL DEFAULT 0 CHECK (price_jpy >= 0),
  status public.course_status NOT NULL DEFAULT 'draft',
  access_type public.access_type NOT NULL DEFAULT 'lifetime',
  access_duration_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- course_stages
CREATE TABLE IF NOT EXISTS public.course_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title_ja text NOT NULL,
  title_en text NOT NULL,
  description_ja text,
  description_en text,
  position integer NOT NULL DEFAULT 0,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- modules
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.course_stages(id) ON DELETE SET NULL,
  title_ja text NOT NULL,
  title_en text NOT NULL,
  description_ja text,
  description_en text,
  thumbnail_url text,
  position integer NOT NULL DEFAULT 0,
  release_type public.release_type NOT NULL DEFAULT 'immediate',
  release_at timestamptz,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title_ja text NOT NULL,
  title_en text NOT NULL,
  description_ja text,
  description_en text,
  lesson_type public.lesson_type NOT NULL DEFAULT 'video',
  cloudflare_video_uid text,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  position integer NOT NULL DEFAULT 0,
  is_preview boolean NOT NULL DEFAULT false,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- orders (created before enrollments so FK can be set)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'stripe',
  provider_checkout_id text,
  provider_payment_id text,
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'JPY',
  status public.order_status NOT NULL DEFAULT 'pending',
  customer_email text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

-- lesson_progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  progress_seconds integer NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

-- payment_events
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- lesson_resources
CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title_ja text NOT NULL,
  title_en text NOT NULL,
  resource_type public.resource_type NOT NULL DEFAULT 'link',
  file_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- support_requests
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status public.support_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  occupation_ja text,
  occupation_en text,
  content_ja text NOT NULL,
  content_en text NOT NULL,
  avatar_url text,
  video_url text,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- faq_items
CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_ja text NOT NULL,
  question_en text NOT NULL,
  answer_ja text NOT NULL,
  answer_en text NOT NULL,
  category text,
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_course_stages_course ON public.course_stages(course_id, position);
CREATE INDEX IF NOT EXISTS idx_modules_course ON public.modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_modules_stage ON public.modules(stage_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON public.lessons(module_id, position);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_course ON public.orders(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_evtid ON public.payment_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_lesson_resources_lesson ON public.lesson_resources(lesson_id, position);
CREATE INDEX IF NOT EXISTS idx_support_requests_user ON public.support_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_testimonials_pub ON public.testimonials(published, position);
CREATE INDEX IF NOT EXISTS idx_faq_pub ON public.faq_items(published, position);

-- =========================================================
-- GRANTS
-- =========================================================
-- Public content: anon + authenticated can read; admin writes via RLS
GRANT SELECT ON public.courses, public.course_stages, public.modules, public.lessons,
              public.lesson_resources, public.testimonials, public.faq_items
  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses, public.course_stages, public.modules,
              public.lessons, public.lesson_resources, public.testimonials, public.faq_items
  TO authenticated;
GRANT ALL ON public.courses, public.course_stages, public.modules, public.lessons,
              public.lesson_resources, public.testimonials, public.faq_items
  TO service_role;

-- User-owned data
GRANT SELECT, INSERT, UPDATE ON public.enrollments TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lesson_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_requests TO authenticated;
GRANT ALL ON public.enrollments, public.orders, public.lesson_progress, public.support_requests TO service_role;

-- Payment events: server-only
GRANT ALL ON public.payment_events TO service_role;

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER FUNCTIONS (used by policies)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_active_enrollment(_uid uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.enrollments
    WHERE user_id = _uid
      AND course_id = _course_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;
REVOKE ALL ON FUNCTION public.has_active_enrollment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_enrollment(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_module_released(_module_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE m.release_type
    WHEN 'immediate' THEN true
    WHEN 'date' THEN (m.release_at IS NOT NULL AND m.release_at <= now())
    WHEN 'after_previous' THEN true
  END
  FROM public.modules m WHERE m.id = _module_id
$$;
REVOKE ALL ON FUNCTION public.is_module_released(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_module_released(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_course_progress(_uid uuid, _course_id uuid)
RETURNS TABLE(total_lessons integer, completed_lessons integer, percentage numeric, last_lesson_id uuid, last_watched_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH course_lessons AS (
    SELECT l.id FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id AND l.status = 'published'
  ),
  totals AS (
    SELECT COUNT(*)::int AS total FROM course_lessons
  ),
  done AS (
    SELECT COUNT(*)::int AS completed
    FROM public.lesson_progress lp
    JOIN course_lessons cl ON cl.id = lp.lesson_id
    WHERE lp.user_id = _uid AND lp.completed = true
  ),
  last_watched AS (
    SELECT lp.lesson_id, lp.last_watched_at
    FROM public.lesson_progress lp
    JOIN course_lessons cl ON cl.id = lp.lesson_id
    WHERE lp.user_id = _uid
    ORDER BY lp.last_watched_at DESC
    LIMIT 1
  )
  SELECT
    t.total,
    d.completed,
    CASE WHEN t.total = 0 THEN 0 ELSE ROUND((d.completed::numeric / t.total) * 100, 2) END,
    lw.lesson_id,
    lw.last_watched_at
  FROM totals t
  CROSS JOIN done d
  LEFT JOIN last_watched lw ON true
$$;
REVOKE ALL ON FUNCTION public.get_course_progress(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_course_progress(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_next_lesson(_uid uuid, _course_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _uid
  WHERE m.course_id = _course_id
    AND l.status = 'published'
    AND (lp.completed IS DISTINCT FROM true)
  ORDER BY m.position, l.position
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_next_lesson(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_lesson(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- POLICIES
-- =========================================================

-- courses: public read published; admin all
DROP POLICY IF EXISTS "courses_public_read" ON public.courses;
CREATE POLICY "courses_public_read" ON public.courses FOR SELECT
  TO anon, authenticated USING (status = 'published' OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "courses_admin_write" ON public.courses;
CREATE POLICY "courses_admin_write" ON public.courses FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- course_stages
DROP POLICY IF EXISTS "stages_public_read" ON public.course_stages;
CREATE POLICY "stages_public_read" ON public.course_stages FOR SELECT
  TO anon, authenticated USING (
    status = 'published' AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published')
    OR public.is_admin(auth.uid())
  );
DROP POLICY IF EXISTS "stages_admin_write" ON public.course_stages;
CREATE POLICY "stages_admin_write" ON public.course_stages FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- modules
DROP POLICY IF EXISTS "modules_public_read" ON public.modules;
CREATE POLICY "modules_public_read" ON public.modules FOR SELECT
  TO anon, authenticated USING (
    (status = 'published'
      AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'))
    OR public.is_admin(auth.uid())
  );
DROP POLICY IF EXISTS "modules_admin_write" ON public.modules;
CREATE POLICY "modules_admin_write" ON public.modules FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- lessons: preview to everyone; full content only enrolled
DROP POLICY IF EXISTS "lessons_public_read" ON public.lessons;
CREATE POLICY "lessons_public_read" ON public.lessons FOR SELECT
  TO anon, authenticated USING (
    public.is_admin(auth.uid())
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
        WHERE m.id = module_id
          AND m.status = 'published'
          AND c.status = 'published'
          AND (
            is_preview = true
            OR (auth.uid() IS NOT NULL AND public.has_active_enrollment(auth.uid(), c.id))
          )
      )
    )
  );
DROP POLICY IF EXISTS "lessons_admin_write" ON public.lessons;
CREATE POLICY "lessons_admin_write" ON public.lessons FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- lesson_resources: same visibility as parent lesson (via join)
DROP POLICY IF EXISTS "resources_read" ON public.lesson_resources;
CREATE POLICY "resources_read" ON public.lesson_resources FOR SELECT
  TO anon, authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
      WHERE l.id = lesson_id
        AND l.status = 'published' AND m.status = 'published' AND c.status = 'published'
        AND (l.is_preview = true OR (auth.uid() IS NOT NULL AND public.has_active_enrollment(auth.uid(), c.id)))
    )
  );
DROP POLICY IF EXISTS "resources_admin_write" ON public.lesson_resources;
CREATE POLICY "resources_admin_write" ON public.lesson_resources FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- enrollments: student can view own; only admin/service create/update
DROP POLICY IF EXISTS "enrollments_own_read" ON public.enrollments;
CREATE POLICY "enrollments_own_read" ON public.enrollments FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "enrollments_admin_write" ON public.enrollments;
CREATE POLICY "enrollments_admin_write" ON public.enrollments FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- orders: student can view own; NO write from authenticated (service_role bypasses RLS)
DROP POLICY IF EXISTS "orders_own_read" ON public.orders;
CREATE POLICY "orders_own_read" ON public.orders FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- lesson_progress: own row full manage
DROP POLICY IF EXISTS "progress_own_select" ON public.lesson_progress;
CREATE POLICY "progress_own_select" ON public.lesson_progress FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "progress_own_insert" ON public.lesson_progress;
CREATE POLICY "progress_own_insert" ON public.lesson_progress FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "progress_own_update" ON public.lesson_progress;
CREATE POLICY "progress_own_update" ON public.lesson_progress FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- support_requests
DROP POLICY IF EXISTS "support_own_select" ON public.support_requests;
CREATE POLICY "support_own_select" ON public.support_requests FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "support_own_insert" ON public.support_requests;
CREATE POLICY "support_own_insert" ON public.support_requests FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "support_admin_update" ON public.support_requests;
CREATE POLICY "support_admin_update" ON public.support_requests FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- testimonials
DROP POLICY IF EXISTS "testimonials_public_read" ON public.testimonials;
CREATE POLICY "testimonials_public_read" ON public.testimonials FOR SELECT
  TO anon, authenticated USING (published = true OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "testimonials_admin_write" ON public.testimonials;
CREATE POLICY "testimonials_admin_write" ON public.testimonials FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- faq_items
DROP POLICY IF EXISTS "faq_public_read" ON public.faq_items;
CREATE POLICY "faq_public_read" ON public.faq_items FOR SELECT
  TO anon, authenticated USING (published = true OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "faq_admin_write" ON public.faq_items;
CREATE POLICY "faq_admin_write" ON public.faq_items FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- profiles: add admin read-all (existing user-owned policies stay)
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read" ON public.profiles FOR SELECT
  TO authenticated USING (public.is_admin(auth.uid()));

-- payment_events: no policies for anon/authenticated (service_role only via GRANT)

-- =========================================================
-- TRIGGERS: updated_at + progress auto-complete
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'courses','course_stages','modules','lessons','enrollments','orders',
    'lesson_progress','support_requests','testimonials','faq_items'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.lesson_progress_autocomplete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.progress_percentage >= 95 AND NEW.completed = false THEN
    NEW.completed := true;
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_progress_autocomplete ON public.lesson_progress;
CREATE TRIGGER trg_progress_autocomplete BEFORE INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.lesson_progress_autocomplete();

-- =========================================================
-- SEED (idempotent)
-- =========================================================
INSERT INTO public.courses (slug, title_ja, title_en, description_ja, description_en, price_jpy, status, access_type)
VALUES (
  'eigo-mastery',
  '英語マスタリー・コンプリートコース',
  'Eigo Mastery Complete Course',
  '初級から流暢さまで導く実践的なオンライン英語学習プログラム。',
  'A practical online English program that guides you from beginner to fluency.',
  49800, 'published', 'lifetime'
) ON CONFLICT (slug) DO NOTHING;

WITH c AS (SELECT id FROM public.courses WHERE slug = 'eigo-mastery')
INSERT INTO public.course_stages (course_id, title_ja, title_en, position, status)
SELECT c.id, s.ja, s.en, s.pos, 'published'::public.content_status
FROM c, (VALUES
  ('基礎',        'Foundations',    1),
  ('日常会話',    'Everyday Talk',  2),
  ('文法強化',    'Grammar Boost',  3),
  ('リスニング',  'Listening',      4),
  ('スピーキング','Speaking',       5),
  ('流暢さ',      'Fluency',        6)
) AS s(ja, en, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.course_stages cs WHERE cs.course_id = c.id AND cs.position = s.pos
);

-- 3 sample modules in stage 1
WITH c AS (SELECT id FROM public.courses WHERE slug = 'eigo-mastery'),
     s AS (SELECT cs.id, cs.course_id FROM public.course_stages cs JOIN c ON c.id = cs.course_id WHERE cs.position = 1)
INSERT INTO public.modules (course_id, stage_id, title_ja, title_en, position, release_type, status)
SELECT s.course_id, s.id, m.ja, m.en, m.pos, 'immediate'::public.release_type, 'published'::public.content_status
FROM s, (VALUES
  ('モジュール1: アルファベットと発音', 'Module 1: Alphabet & Pronunciation', 1),
  ('モジュール2: 基本文型',              'Module 2: Basic Sentence Patterns',   2),
  ('モジュール3: 自己紹介',              'Module 3: Introducing Yourself',      3)
) AS m(ja, en, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules mm WHERE mm.stage_id = s.id AND mm.position = m.pos
);

-- 2 lessons per module (6 total), first module first lesson = preview
WITH mods AS (
  SELECT m.id, m.position AS mpos
  FROM public.modules m
  JOIN public.course_stages cs ON cs.id = m.stage_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE c.slug = 'eigo-mastery' AND cs.position = 1
)
INSERT INTO public.lessons (module_id, title_ja, title_en, lesson_type, duration_seconds, position, is_preview, status)
SELECT mods.id,
       'レッスン ' || l.pos || ': サンプル',
       'Lesson '  || l.pos || ': Sample',
       'video'::public.lesson_type,
       300, l.pos,
       (mods.mpos = 1 AND l.pos = 1),
       'published'::public.content_status
FROM mods, (VALUES (1),(2)) AS l(pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lessons ll WHERE ll.module_id = mods.id AND ll.position = l.pos
);
