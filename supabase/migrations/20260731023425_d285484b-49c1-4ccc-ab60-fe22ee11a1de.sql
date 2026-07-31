-- ============ Stage 5: central lesson access check ============
CREATE OR REPLACE FUNCTION public.can_access_lesson(_uid uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = _lesson_id
      AND l.status = 'published'
      AND m.status = 'published'
      AND c.status = 'published'
      AND public.is_module_released(m.id)
      AND (
        l.is_preview = true
        OR (_uid IS NOT NULL AND public.has_active_enrollment(_uid, c.id))
        OR (_uid IS NOT NULL AND public.is_admin(_uid))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_lesson(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) TO authenticated, service_role;

-- ============ Stage 6: server-derived progress ============
-- Percentage is always derived from watched position vs. real lesson duration.
CREATE OR REPLACE FUNCTION public.lesson_progress_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration integer;
  v_is_preview boolean;
  v_status public.content_status;
  v_course_id uuid;
  v_threshold numeric := 90;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.user_id <> auth.uid()
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT l.duration_seconds, l.is_preview, l.status, m.course_id
    INTO v_duration, v_is_preview, v_status, v_course_id
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id;

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'lesson_not_found';
  END IF;
  IF v_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'lesson_not_published';
  END IF;

  IF NOT public.can_access_lesson(NEW.user_id, NEW.lesson_id)
     AND NOT public.is_admin(COALESCE(auth.uid(), NEW.user_id)) THEN
    RAISE EXCEPTION 'no_access';
  END IF;

  -- Clamp watched position to the real duration
  IF NEW.progress_seconds IS NULL OR NEW.progress_seconds < 0 THEN
    NEW.progress_seconds := 0;
  END IF;
  IF v_duration IS NOT NULL AND v_duration > 0 AND NEW.progress_seconds > v_duration THEN
    NEW.progress_seconds := v_duration;
  END IF;

  -- Derive percentage server-side (client value is never trusted)
  IF v_duration IS NOT NULL AND v_duration > 0 THEN
    NEW.progress_percentage := LEAST(100, GREATEST(0, ROUND((NEW.progress_seconds::numeric / v_duration) * 100)));
  ELSE
    IF NEW.progress_percentage IS NULL OR NEW.progress_percentage < 0 THEN
      NEW.progress_percentage := 0;
    ELSIF NEW.progress_percentage > 100 THEN
      NEW.progress_percentage := 100;
    END IF;
  END IF;

  -- Completion is only granted by the threshold, never by the client
  NEW.completed := (NEW.progress_percentage >= v_threshold);

  -- Monotonic: never regress an already completed / further-watched lesson
  IF TG_OP = 'UPDATE' THEN
    IF NEW.progress_seconds < OLD.progress_seconds THEN
      NEW.progress_seconds := OLD.progress_seconds;
    END IF;
    IF NEW.progress_percentage < OLD.progress_percentage THEN
      NEW.progress_percentage := OLD.progress_percentage;
    END IF;
    IF COALESCE(OLD.completed, false) = true THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(OLD.completed_at, now());
    END IF;
  END IF;

  IF NEW.completed = true THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  NEW.last_watched_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_progress_validate_trg ON public.lesson_progress;
CREATE TRIGGER lesson_progress_validate_trg
BEFORE INSERT OR UPDATE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.lesson_progress_validate();

-- Official write path for students
CREATE OR REPLACE FUNCTION public.record_lesson_progress(_lesson_id uuid, _position_seconds integer)
RETURNS TABLE(
  lesson_id uuid,
  progress_seconds integer,
  progress_percentage numeric,
  completed boolean,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.can_access_lesson(v_uid, _lesson_id) THEN
    RAISE EXCEPTION 'no_access';
  END IF;

  INSERT INTO public.lesson_progress AS lp (user_id, lesson_id, progress_seconds, progress_percentage, last_watched_at)
  VALUES (v_uid, _lesson_id, GREATEST(0, COALESCE(_position_seconds, 0)), 0, now())
  ON CONFLICT (user_id, lesson_id) DO UPDATE
    SET progress_seconds = GREATEST(0, COALESCE(EXCLUDED.progress_seconds, 0)),
        last_watched_at = now();

  RETURN QUERY
  SELECT lp2.lesson_id, lp2.progress_seconds, lp2.progress_percentage, lp2.completed, lp2.completed_at
  FROM public.lesson_progress lp2
  WHERE lp2.user_id = v_uid AND lp2.lesson_id = _lesson_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_lesson_progress(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_lesson_progress(uuid, integer) TO authenticated, service_role;

-- Students may only read their progress; writes go through record_lesson_progress
REVOKE INSERT, UPDATE, DELETE ON public.lesson_progress FROM authenticated;
DROP POLICY IF EXISTS "progress_own_insert" ON public.lesson_progress;
DROP POLICY IF EXISTS "progress_own_update" ON public.lesson_progress;
GRANT ALL ON public.lesson_progress TO service_role;