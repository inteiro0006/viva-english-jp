-- =========================================================
-- Stage 7/8 (part 1): release rules + per-user guards
-- =========================================================

-- 1) Per-user module release helper (handles after_previous properly)
CREATE OR REPLACE FUNCTION public.is_module_released_for(_uid uuid, _module_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.modules%ROWTYPE;
  v_prev_total int;
  v_prev_done int;
BEGIN
  SELECT * INTO m FROM public.modules WHERE id = _module_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _uid IS NOT NULL AND public.is_admin(_uid) THEN
    RETURN true;
  END IF;

  IF m.release_type = 'immediate' THEN
    RETURN true;
  ELSIF m.release_type = 'date' THEN
    RETURN (m.release_at IS NOT NULL AND m.release_at <= now());
  ELSIF m.release_type = 'after_previous' THEN
    IF _uid IS NULL THEN
      RETURN false;
    END IF;

    SELECT COUNT(*)::int INTO v_prev_total
    FROM public.lessons l
    JOIN public.modules pm ON pm.id = l.module_id
    WHERE pm.course_id = m.course_id
      AND pm.status = 'published'
      AND pm.position < m.position
      AND l.status = 'published';

    IF v_prev_total = 0 THEN
      RETURN true;
    END IF;

    SELECT COUNT(*)::int INTO v_prev_done
    FROM public.lessons l
    JOIN public.modules pm ON pm.id = l.module_id
    JOIN public.lesson_progress lp
      ON lp.lesson_id = l.id AND lp.user_id = _uid AND lp.completed = true
    WHERE pm.course_id = m.course_id
      AND pm.status = 'published'
      AND pm.position < m.position
      AND l.status = 'published';

    RETURN v_prev_done >= v_prev_total;
  END IF;

  RETURN false;
END;
$$;

-- 2) Backwards-compatible wrapper used by RLS policies (current session user)
CREATE OR REPLACE FUNCTION public.is_module_released(_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_module_released_for(auth.uid(), _module_id);
$$;

-- 3) can_access_lesson: per-user release + caller guard
CREATE OR REPLACE FUNCTION public.can_access_lesson(_uid uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND _uid IS DISTINCT FROM v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = _lesson_id
      AND l.status = 'published'
      AND m.status = 'published'
      AND c.status = 'published'
      AND (
        l.is_preview = true
        OR (
          public.is_module_released_for(_uid, m.id)
          AND (
            (_uid IS NOT NULL AND public.has_active_enrollment(_uid, c.id))
            OR (_uid IS NOT NULL AND public.is_admin(_uid))
          )
        )
      )
  );
END;
$$;

-- 4) has_role: users may only ask about themselves (admins may ask about anyone)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL
     AND _user_id IS DISTINCT FROM v_caller
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 5) has_active_enrollment: guard third-party lookups
CREATE OR REPLACE FUNCTION public.has_active_enrollment(_uid uuid, _course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND _uid IS DISTINCT FROM v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE user_id = _uid
      AND course_id = _course_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 6) get_course_progress: guard + per-user release
CREATE OR REPLACE FUNCTION public.get_course_progress(_uid uuid, _course_id uuid)
RETURNS TABLE(total_lessons integer, completed_lessons integer, percentage numeric, last_lesson_id uuid, last_watched_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND _uid IS DISTINCT FROM v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  WITH course_lessons AS (
    SELECT l.id
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id
      AND l.status = 'published'
      AND m.status = 'published'
      AND public.is_module_released_for(_uid, m.id)
  ),
  totals AS (SELECT COUNT(*)::int AS total FROM course_lessons),
  done AS (
    SELECT COUNT(*)::int AS completed
    FROM public.lesson_progress lp
    JOIN course_lessons cl ON cl.id = lp.lesson_id
    WHERE lp.user_id = _uid AND lp.completed = true
  ),
  lw AS (
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
  LEFT JOIN lw ON true;
END;
$$;

-- 7) get_next_lesson: guard + per-user release
CREATE OR REPLACE FUNCTION public.get_next_lesson(_uid uuid, _course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_caller IS NOT NULL AND _uid IS DISTINCT FROM v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT l.id INTO v_id
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _uid
  WHERE m.course_id = _course_id
    AND l.status = 'published'
    AND m.status = 'published'
    AND public.is_module_released_for(_uid, m.id)
    AND (lp.completed IS DISTINCT FROM true)
  ORDER BY m.position, l.position
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- 8) is_certificate_eligible: guard; requires every published lesson of the course
CREATE OR REPLACE FUNCTION public.is_certificate_eligible(_uid uuid, _course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_total int;
  v_done int;
BEGIN
  IF v_caller IS NOT NULL AND _uid IS DISTINCT FROM v_caller AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT public.has_active_enrollment(_uid, _course_id) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::int INTO v_total
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = _course_id
    AND m.status = 'published'
    AND l.status = 'published';

  IF v_total = 0 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::int INTO v_done
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _uid AND lp.completed = true
  WHERE m.course_id = _course_id
    AND m.status = 'published'
    AND l.status = 'published';

  RETURN v_done >= v_total;
END;
$$;

-- 9) RLS: lessons and stream_videos must respect module release
DROP POLICY IF EXISTS "lessons_public_read" ON public.lessons;
CREATE POLICY "lessons_public_read" ON public.lessons
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1
        FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
        WHERE m.id = lessons.module_id
          AND m.status = 'published'
          AND c.status = 'published'
          AND (
            lessons.is_preview = true
            OR (
              auth.uid() IS NOT NULL
              AND public.has_active_enrollment(auth.uid(), c.id)
              AND public.is_module_released_for(auth.uid(), m.id)
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "Students read videos of accessible lessons" ON public.stream_videos;
CREATE POLICY "Students read videos of accessible lessons" ON public.stream_videos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.cloudflare_video_uid = stream_videos.cloudflare_uid
        AND l.status = 'published'
        AND (
          l.is_preview
          OR (
            public.has_active_enrollment(auth.uid(), m.course_id)
            AND public.is_module_released_for(auth.uid(), m.id)
          )
        )
    )
  );

-- 10) Least privilege on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.is_module_released_for(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_module_released(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_lesson(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_active_enrollment(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_course_progress(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_next_lesson(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_certificate_eligible(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_module_released_for(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_module_released(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_enrollment(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_course_progress(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_lesson(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_certificate_eligible(uuid, uuid) TO authenticated, service_role;
