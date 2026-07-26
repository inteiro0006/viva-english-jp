
-- Trigger-only functions: nobody should call these directly via PostgREST.
REVOKE ALL ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lesson_progress_autocomplete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lesson_progress_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at()           FROM PUBLIC, anon, authenticated;

-- Student/admin helpers: not intended for anonymous callers.
REVOKE EXECUTE ON FUNCTION public.get_next_lesson(uuid, uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_course_progress(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb) FROM anon;

-- Defense in depth on writable payment/webhook tables: block anon writes entirely at the grant level.
REVOKE INSERT, UPDATE, DELETE ON public.orders             FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.enrollments        FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payment_events     FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stream_webhook_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_logs   FROM anon, authenticated;
