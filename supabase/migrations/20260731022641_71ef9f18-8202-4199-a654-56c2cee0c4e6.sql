-- 1. Environment separation ---------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.payment_environment AS ENUM ('sandbox', 'live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS environment public.payment_environment NOT NULL DEFAULT 'live';

ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS environment public.payment_environment NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- 2. Real idempotency -----------------------------------------------------
ALTER TABLE public.payment_events
  DROP CONSTRAINT IF EXISTS payment_events_provider_event_id_key;
DROP INDEX IF EXISTS public.payment_events_provider_event_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_env_event_uidx
  ON public.payment_events (provider, environment, provider_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_checkout_id_uidx
  ON public.orders (provider, environment, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_provider_payment_id_idx
  ON public.orders (provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_user_course_status_idx
  ON public.orders (user_id, course_id, status);

-- 3. Transactional enrollment grant / reactivation ------------------------
CREATE OR REPLACE FUNCTION public.grant_enrollment(
  _user_id uuid,
  _course_id uuid,
  _order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.enrollments (user_id, course_id, order_id, status, enrolled_at)
  VALUES (_user_id, _course_id, _order_id, 'active', now())
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET status      = 'active',
        order_id    = COALESCE(EXCLUDED.order_id, public.enrollments.order_id),
        expires_at  = NULL,
        enrolled_at = CASE
                        WHEN public.enrollments.status = 'active'
                        THEN public.enrollments.enrolled_at
                        ELSE now()
                      END,
        updated_at  = now()
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_enrollment(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_enrollment(uuid, uuid, uuid) TO service_role;

-- 4. Atomic Stripe fulfilment --------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(
  _order_id uuid,
  _environment public.payment_environment,
  _provider_checkout_id text,
  _provider_payment_id text,
  _amount bigint,
  _currency text,
  _customer_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  _enrollment_id uuid;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found:%', _order_id;
  END IF;

  IF o.environment <> _environment THEN
    RAISE EXCEPTION 'environment_mismatch';
  END IF;

  IF o.provider_checkout_id IS DISTINCT FROM _provider_checkout_id THEN
    RAISE EXCEPTION 'checkout_id_mismatch';
  END IF;

  IF o.amount <> _amount OR lower(o.currency) <> lower(_currency) THEN
    RAISE EXCEPTION 'amount_or_currency_mismatch';
  END IF;

  IF o.status = 'paid' THEN
    SELECT id INTO _enrollment_id FROM public.enrollments
      WHERE user_id = o.user_id AND course_id = o.course_id;
    IF _enrollment_id IS NULL THEN
      _enrollment_id := public.grant_enrollment(o.user_id, o.course_id, o.id);
    END IF;
    RETURN jsonb_build_object('order_id', o.id, 'enrollment_id', _enrollment_id, 'already_paid', true);
  END IF;

  UPDATE public.orders
     SET status = 'paid',
         paid_at = now(),
         provider_payment_id = COALESCE(_provider_payment_id, provider_payment_id),
         customer_email = COALESCE(_customer_email, customer_email),
         updated_at = now()
   WHERE id = o.id;

  -- Sandbox payments never grant real access.
  IF _environment = 'live' THEN
    _enrollment_id := public.grant_enrollment(o.user_id, o.course_id, o.id);
  END IF;

  RETURN jsonb_build_object('order_id', o.id, 'enrollment_id', _enrollment_id, 'already_paid', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_paid_order(uuid, public.payment_environment, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_order(uuid, public.payment_environment, text, text, bigint, text, text) TO service_role;

-- 5. Financial tables stay read-only for end users ------------------------
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.enrollments FROM authenticated, anon;
REVOKE ALL ON public.payment_events FROM authenticated, anon;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.enrollments TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.enrollments TO service_role;
GRANT ALL ON public.payment_events TO service_role;