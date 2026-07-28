REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_enrollment(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_certificate_eligible(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_module_released(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_course_progress(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_lesson(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb) FROM anon, PUBLIC;
-- verify_certificate is intentionally callable by anon for the public certificate verification page.
