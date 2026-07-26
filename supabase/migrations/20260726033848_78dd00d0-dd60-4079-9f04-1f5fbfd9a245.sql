
-- Validation + autocomplete trigger for lesson_progress
CREATE OR REPLACE FUNCTION public.lesson_progress_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration integer;
  v_course_id uuid;
  v_is_preview boolean;
  v_status public.content_status;
  v_threshold numeric := 90;
BEGIN
  -- Ownership guard (defense in depth alongside RLS)
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

  -- Only enrolled users or preview lessons may have progress rows.
  -- Admins can still upsert to help students if needed.
  IF NOT v_is_preview
     AND NOT public.has_active_enrollment(NEW.user_id, v_course_id)
     AND NOT public.is_admin(COALESCE(auth.uid(), NEW.user_id)) THEN
    RAISE EXCEPTION 'no_access';
  END IF;

  -- Clamp values
  IF NEW.progress_seconds IS NULL OR NEW.progress_seconds < 0 THEN
    NEW.progress_seconds := 0;
  END IF;
  IF v_duration IS NOT NULL AND v_duration > 0
     AND NEW.progress_seconds > v_duration THEN
    NEW.progress_seconds := v_duration;
  END IF;
  IF NEW.progress_percentage IS NULL OR NEW.progress_percentage < 0 THEN
    NEW.progress_percentage := 0;
  ELSIF NEW.progress_percentage > 100 THEN
    NEW.progress_percentage := 100;
  END IF;

  -- Auto-complete once we cross the threshold
  IF NEW.progress_percentage >= v_threshold AND COALESCE(NEW.completed, false) = false THEN
    NEW.completed := true;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;

  -- Prevent regression of an already-completed lesson
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.completed, false) = true THEN
    NEW.completed := true;
    NEW.completed_at := COALESCE(NEW.completed_at, OLD.completed_at, now());
    IF NEW.progress_percentage < OLD.progress_percentage THEN
      NEW.progress_percentage := OLD.progress_percentage;
    END IF;
    IF NEW.progress_seconds < OLD.progress_seconds THEN
      NEW.progress_seconds := OLD.progress_seconds;
    END IF;
  END IF;

  IF COALESCE(NEW.completed, false) = true AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  NEW.last_watched_at := COALESCE(NEW.last_watched_at, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_progress_validate_trg ON public.lesson_progress;
CREATE TRIGGER lesson_progress_validate_trg
BEFORE INSERT OR UPDATE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.lesson_progress_validate();

-- Course progress: ignore lessons in modules that are not yet released.
CREATE OR REPLACE FUNCTION public.get_course_progress(_uid uuid, _course_id uuid)
RETURNS TABLE(
  total_lessons integer,
  completed_lessons integer,
  percentage numeric,
  last_lesson_id uuid,
  last_watched_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH course_lessons AS (
    SELECT l.id
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id
      AND l.status = 'published'
      AND m.status = 'published'
      AND public.is_module_released(m.id)
  ),
  totals AS (SELECT COUNT(*)::int AS total FROM course_lessons),
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
    CASE WHEN t.total = 0 THEN 0
         ELSE ROUND((d.completed::numeric / t.total) * 100, 2) END,
    lw.lesson_id,
    lw.last_watched_at
  FROM totals t
  CROSS JOIN done d
  LEFT JOIN last_watched lw ON true;
$$;

-- Next lesson: skip locked/future-date modules
CREATE OR REPLACE FUNCTION public.get_next_lesson(_uid uuid, _course_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  LEFT JOIN public.lesson_progress lp
    ON lp.lesson_id = l.id AND lp.user_id = _uid
  WHERE m.course_id = _course_id
    AND l.status = 'published'
    AND m.status = 'published'
    AND public.is_module_released(m.id)
    AND (lp.completed IS DISTINCT FROM true)
  ORDER BY m.position, l.position
  LIMIT 1;
$$;
