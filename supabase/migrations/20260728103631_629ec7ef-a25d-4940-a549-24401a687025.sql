
ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS changed_fields jsonb,
  ADD COLUMN IF NOT EXISTS summary text;

CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx
  ON public.admin_audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_idx
  ON public.admin_audit_logs (admin_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _entity_type text,
  _entity_id text,
  _old_values jsonb DEFAULT NULL,
  _new_values jsonb DEFAULT NULL,
  _changed_fields jsonb DEFAULT NULL,
  _summary text DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.admin_audit_logs (
    admin_id, action, entity_type, entity_id,
    old_values, new_values, changed_fields, summary,
    ip_address, user_agent
  )
  VALUES (
    _uid, _action, _entity_type, _entity_id,
    _old_values, _new_values, _changed_fields, _summary,
    _ip_address, _user_agent
  )
  RETURNING id INTO _id;
  RETURN _id;
END $function$;

-- Keep EXECUTE restricted (admins call via server function; anon revoked previously)
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb, jsonb, text, inet, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb, jsonb, text, inet, text) TO authenticated;
