
-- 1. admin_audit_logs
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_admin_audit_logs_entity ON public.admin_audit_logs (entity_type, entity_id);
CREATE INDEX idx_admin_audit_logs_admin ON public.admin_audit_logs (admin_id);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies for authenticated — only service_role or SECURITY DEFINER function writes.

-- 2. platform_settings
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public keys readable by anyone (anon + authenticated).
CREATE POLICY "Public settings visible"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE POLICY "Admins read all settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER platform_settings_touch_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. log_admin_action RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _entity_type text,
  _entity_id text,
  _old_values jsonb DEFAULT NULL,
  _new_values jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (_uid, _action, _entity_type, _entity_id, _old_values, _new_values)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb) TO authenticated;

-- 4. Seed initial settings
INSERT INTO public.platform_settings (key, value, is_public) VALUES
  ('platform_name', '"Eigo Academy"'::jsonb, true),
  ('support_email', '"support@example.com"'::jsonb, true),
  ('display_price_jpy', '49800'::jsonb, true),
  ('institutional_ja', '"日本人学習者のための実践的な英語コース。"'::jsonb, true),
  ('institutional_en', '"Practical English course crafted for Japanese learners."'::jsonb, true),
  ('socials', '{"twitter":"","instagram":"","youtube":""}'::jsonb, true),
  ('terms_ja', '""'::jsonb, true),
  ('terms_en', '""'::jsonb, true),
  ('privacy_ja', '""'::jsonb, true),
  ('privacy_en', '""'::jsonb, true),
  ('video_completion_threshold', '95'::jsonb, false),
  ('access_policy', '{"lifetime": true, "default_expiry_days": null}'::jsonb, false),
  ('active_languages', '["ja","en"]'::jsonb, true)
ON CONFLICT (key) DO NOTHING;
