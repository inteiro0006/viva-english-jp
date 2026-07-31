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

  IF NEW.progress_seconds IS NULL OR NEW.progress_seconds < 0 THEN
    NEW.progress_seconds := 0;
  END IF;
  IF v_duration IS NOT NULL AND v_duration > 0 AND NEW.progress_seconds > v_duration THEN
    NEW.progress_seconds := v_duration;
  END IF;

  IF v_duration IS NOT NULL AND v_duration > 0 THEN
    NEW.progress_percentage := LEAST(100, GREATEST(0, ROUND((NEW.progress_seconds::numeric / v_duration) * 100)));
  ELSE
    -- No measurable duration (text/quiz/file lessons): any recorded interaction completes it.
    NEW.progress_percentage := CASE WHEN NEW.progress_seconds > 0 THEN 100 ELSE 0 END;
  END IF;

  NEW.completed := (NEW.progress_percentage >= v_threshold);

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