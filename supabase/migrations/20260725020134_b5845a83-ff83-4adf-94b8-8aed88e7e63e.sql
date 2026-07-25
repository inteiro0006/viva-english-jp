-- Fix: policies on anon-readable tables call is_admin(auth.uid()), which requires EXECUTE.
-- Without EXECUTE for anon, PostgREST returns 401 "permission denied for function is_admin"
-- for every unauthenticated request to courses, lessons, modules, course_stages,
-- testimonials, faq_items, lesson_resources. Grant EXECUTE on the helpers used
-- inside those policies to anon so anon requests can be evaluated (the functions
-- correctly return false for anon since auth.uid() is null).
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_active_enrollment(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_module_released(uuid) TO anon;