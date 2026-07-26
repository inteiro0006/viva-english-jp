
-- Certificates table
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_path TEXT,
  language TEXT NOT NULL DEFAULT 'ja' CHECK (language IN ('ja','en')),
  student_name_snapshot TEXT NOT NULL,
  course_title_snapshot TEXT NOT NULL,
  hours_snapshot INTEGER,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active (non-revoked) certificate per (user, course)
CREATE UNIQUE INDEX certificates_active_unique
  ON public.certificates (user_id, course_id)
  WHERE revoked_at IS NULL;

CREATE INDEX certificates_verification_idx ON public.certificates (verification_code);
CREATE INDEX certificates_user_idx ON public.certificates (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
-- Public verification is served by a SECURITY DEFINER function, not direct SELECT.

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Students read their own certificates
CREATE POLICY "Students read own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins read all
CREATE POLICY "Admins read all certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins update (revoke)
CREATE POLICY "Admins update certificates"
  ON public.certificates FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- No direct INSERT/DELETE from client; issued via SECURITY DEFINER server logic.

CREATE TRIGGER certificates_set_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Eligibility check: 100% of published lessons in released modules completed + active enrollment
CREATE OR REPLACE FUNCTION public.is_certificate_eligible(_uid UUID, _course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH lessons_needed AS (
    SELECT l.id
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id
      AND l.status = 'published'
      AND public.is_module_released(m.id)
  ),
  completed AS (
    SELECT COUNT(*) AS c
    FROM public.lesson_progress lp
    JOIN lessons_needed ln ON ln.id = lp.lesson_id
    WHERE lp.user_id = _uid AND lp.completed = true
  ),
  total AS (
    SELECT COUNT(*) AS t FROM lessons_needed
  )
  SELECT public.has_active_enrollment(_uid, _course_id)
     AND (SELECT t FROM total) > 0
     AND (SELECT c FROM completed) >= (SELECT t FROM total);
$$;

-- Public verification lookup (no PII beyond partial name)
CREATE OR REPLACE FUNCTION public.verify_certificate(_code TEXT)
RETURNS TABLE(
  valid BOOLEAN,
  status TEXT,
  certificate_number TEXT,
  student_name_masked TEXT,
  course_title_ja TEXT,
  course_title_en TEXT,
  issued_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  masked TEXT;
BEGIN
  SELECT c.*, co.title_ja, co.title_en
    INTO r
    FROM public.certificates c
    JOIN public.courses co ON co.id = c.course_id
    WHERE c.verification_code = _code
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  -- Mask name: keep first char per whitespace-separated token, replace rest with •
  SELECT string_agg(
    CASE WHEN length(tok) <= 1 THEN tok
         ELSE substring(tok, 1, 1) || repeat('•', greatest(length(tok) - 1, 1))
    END, ' '
  ) INTO masked
  FROM regexp_split_to_table(r.student_name_snapshot, '\s+') AS tok
  WHERE tok <> '';

  RETURN QUERY SELECT
    (r.revoked_at IS NULL),
    CASE WHEN r.revoked_at IS NOT NULL THEN 'revoked' ELSE 'valid' END,
    r.certificate_number,
    COALESCE(masked, ''),
    r.title_ja,
    r.title_en,
    r.issued_at,
    r.revoked_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_certificate_eligible(UUID, UUID) TO authenticated;
