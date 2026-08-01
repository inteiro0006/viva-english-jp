-- =====================================================================
-- Corrective migration: payments hardening (events, orders, refunds)
-- Idempotent; never deletes existing data.
-- =====================================================================

-- 1. payment_events explicit state ------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_event_status') THEN
    CREATE TYPE public.payment_event_status AS ENUM ('pending','processing','processed','failed','ignored');
  END IF;
END $$;

ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS status public.payment_event_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS livemode boolean,
  ADD COLUMN IF NOT EXISTS unhandled boolean NOT NULL DEFAULT false;

UPDATE public.payment_events
   SET status = CASE
                  WHEN processed THEN 'processed'::public.payment_event_status
                  WHEN processing_error IS NOT NULL THEN 'failed'::public.payment_event_status
                  ELSE 'pending'::public.payment_event_status
                END
 WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_env_event_uidx
  ON public.payment_events (provider, environment, provider_event_id);
CREATE INDEX IF NOT EXISTS payment_events_status_idx
  ON public.payment_events (status, created_at DESC);

-- 2. orders financial breakdown ---------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS subtotal_amount bigint,
  ADD COLUMN IF NOT EXISTS tax_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount bigint,
  ADD COLUMN IF NOT EXISTS refunded_amount bigint NOT NULL DEFAULT 0;

-- `amount` keeps its historical meaning: the expected subtotal (excl. tax).
UPDATE public.orders SET subtotal_amount = amount WHERE subtotal_amount IS NULL;
UPDATE public.orders SET total_amount = amount WHERE total_amount IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_env_checkout_uidx
  ON public.orders (provider, environment, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_env_payment_uidx
  ON public.orders (provider, environment, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_pending_reconcile_idx
  ON public.orders (status, environment, created_at DESC);
-- NOTE: intentionally NOT unique — pre-existing test data already contains
-- duplicate pending orders and this migration never deletes rows. The
-- get_or_create_pending_order() function below serializes on the newest
-- pending row (FOR UPDATE), which prevents new duplicates.
CREATE INDEX IF NOT EXISTS orders_pending_per_user_course_env_idx
  ON public.orders (user_id, course_id, environment)
  WHERE status = 'pending';

-- 3. payment_customers -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  environment public.payment_environment NOT NULL,
  provider_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_customers_user_uidx
  ON public.payment_customers (user_id, provider, environment);
CREATE UNIQUE INDEX IF NOT EXISTS payment_customers_provider_uidx
  ON public.payment_customers (provider, environment, provider_customer_id);

GRANT SELECT ON public.payment_customers TO authenticated;
GRANT ALL ON public.payment_customers TO service_role;
ALTER TABLE public.payment_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_customers_select_own" ON public.payment_customers;
CREATE POLICY "payment_customers_select_own" ON public.payment_customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. refund_requests ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_request_status') THEN
    CREATE TYPE public.refund_request_status AS ENUM
      ('requested','processing','pending','succeeded','failed','canceled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  environment public.payment_environment NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_amount bigint NOT NULL CHECK (requested_amount > 0),
  currency text NOT NULL DEFAULT 'jpy',
  reason text,
  status public.refund_request_status NOT NULL DEFAULT 'requested',
  provider_refund_id text,
  idempotency_key text NOT NULL,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_idem_uidx
  ON public.refund_requests (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_provider_refund_uidx
  ON public.refund_requests (environment, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS refund_requests_order_idx
  ON public.refund_requests (order_id, created_at DESC);

GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refund_requests_admin_select" ON public.refund_requests;
CREATE POLICY "refund_requests_admin_select" ON public.refund_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payment_customers_updated_at ON public.payment_customers;
CREATE TRIGGER payment_customers_updated_at
  BEFORE UPDATE ON public.payment_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Event claim / complete -------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_payment_event(
  _provider text,
  _environment public.payment_environment,
  _provider_event_id text,
  _event_type text,
  _payload jsonb,
  _livemode boolean DEFAULT NULL,
  _lock_seconds integer DEFAULT 300
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  e public.payment_events%ROWTYPE;
BEGIN
  INSERT INTO public.payment_events
    (provider, environment, provider_event_id, event_type, payload, livemode,
     processed, status, attempts, processing_started_at, last_attempt_at)
  VALUES
    (_provider, _environment, _provider_event_id, _event_type, _payload, _livemode,
     false, 'processing', 1, now(), now())
  ON CONFLICT (provider, environment, provider_event_id) DO NOTHING
  RETURNING * INTO e;

  IF FOUND THEN
    RETURN jsonb_build_object('action','claimed','event_id', e.id, 'attempts', e.attempts);
  END IF;

  SELECT * INTO e FROM public.payment_events
   WHERE provider = _provider
     AND environment = _environment
     AND provider_event_id = _provider_event_id
     FOR UPDATE;

  IF e.status IN ('processed','ignored') THEN
    RETURN jsonb_build_object('action','already_processed','event_id', e.id);
  END IF;

  IF e.status = 'processing'
     AND e.processing_started_at IS NOT NULL
     AND e.processing_started_at > now() - make_interval(secs => _lock_seconds) THEN
    RETURN jsonb_build_object('action','locked','event_id', e.id);
  END IF;

  UPDATE public.payment_events
     SET status = 'processing',
         processed = false,
         processing_started_at = now(),
         last_attempt_at = now(),
         attempts = e.attempts + 1
   WHERE id = e.id;

  RETURN jsonb_build_object('action','claimed','event_id', e.id, 'attempts', e.attempts + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_payment_event(
  _event_id uuid,
  _status public.payment_event_status,
  _error text DEFAULT NULL,
  _unhandled boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.payment_events
     SET status = _status,
         processed = (_status IN ('processed','ignored')),
         processed_at = CASE WHEN _status IN ('processed','ignored') THEN now() ELSE NULL END,
         processing_error = _error,
         unhandled = _unhandled,
         last_attempt_at = now()
   WHERE id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_event_not_found:%', _event_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_event(text, public.payment_environment, text, text, jsonb, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_payment_event(uuid, public.payment_event_status, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_event(text, public.payment_environment, text, text, jsonb, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_event(uuid, public.payment_event_status, text, boolean) TO service_role;

-- 6. Atomic pending-order acquisition ---------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_pending_order(
  _user_id uuid,
  _course_id uuid,
  _environment public.payment_environment,
  _subtotal bigint,
  _currency text,
  _stripe_price_id text,
  _stripe_product_id text,
  _customer_email text DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders
   WHERE user_id = _user_id
     AND course_id = _course_id
     AND environment = _environment
     AND status = 'pending'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    -- Price changed since the order was opened: refresh the expectations and
    -- drop the stale checkout session so a new one is created.
    IF o.amount <> _subtotal
       OR lower(o.currency) <> lower(_currency)
       OR o.stripe_price_id IS DISTINCT FROM _stripe_price_id THEN
      UPDATE public.orders
         SET amount = _subtotal,
             subtotal_amount = _subtotal,
             total_amount = _subtotal,
             currency = lower(_currency),
             stripe_price_id = _stripe_price_id,
             stripe_product_id = _stripe_product_id,
             provider_checkout_id = NULL,
             customer_email = COALESCE(_customer_email, customer_email),
             updated_at = now()
       WHERE id = o.id
       RETURNING * INTO o;
    END IF;
    RETURN o;
  END IF;

  INSERT INTO public.orders
    (user_id, course_id, provider, environment, status, amount, subtotal_amount,
     total_amount, currency, stripe_price_id, stripe_product_id, customer_email)
  VALUES
    (_user_id, _course_id, 'stripe', _environment, 'pending', _subtotal, _subtotal,
     _subtotal, lower(_currency), _stripe_price_id, _stripe_product_id, _customer_email)
  RETURNING * INTO o;

  RETURN o;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_pending_order(uuid, uuid, public.payment_environment, bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_pending_order(uuid, uuid, public.payment_environment, bigint, text, text, text, text) TO service_role;

-- 7. Enrollment upsert that never downgrades a newer purchase ---------
CREATE OR REPLACE FUNCTION public.grant_enrollment(
  _user_id uuid,
  _course_id uuid,
  _order_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 8. fulfill_paid_order v2: state machine + tax-aware validation ------
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(
  _order_id uuid,
  _environment public.payment_environment,
  _provider_checkout_id text,
  _provider_payment_id text,
  _amount bigint,
  _currency text,
  _customer_email text DEFAULT NULL,
  _subtotal bigint DEFAULT NULL,
  _tax bigint DEFAULT 0,
  _discount bigint DEFAULT 0,
  _stripe_price_id text DEFAULT NULL,
  _stripe_product_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders%ROWTYPE;
  _enrollment_id uuid;
  _expected_subtotal bigint;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found:%', _order_id;
  END IF;

  IF o.environment <> _environment THEN
    RAISE EXCEPTION 'environment_mismatch';
  END IF;

  -- Refunded orders are terminal: a replayed old event can never re-open them.
  IF o.status IN ('refunded','partially_refunded') THEN
    RETURN jsonb_build_object('order_id', o.id, 'skipped', 'order_refunded');
  END IF;

  -- Checkout session may be attached exactly once, after validation.
  IF o.provider_checkout_id IS NULL THEN
    UPDATE public.orders SET provider_checkout_id = _provider_checkout_id, updated_at = now()
     WHERE id = o.id RETURNING * INTO o;
  ELSIF o.provider_checkout_id <> _provider_checkout_id THEN
    RAISE EXCEPTION 'checkout_id_mismatch';
  END IF;

  IF _stripe_price_id IS NOT NULL AND o.stripe_price_id IS NOT NULL
     AND o.stripe_price_id <> _stripe_price_id THEN
    RAISE EXCEPTION 'price_mismatch';
  END IF;
  IF _stripe_product_id IS NOT NULL AND o.stripe_product_id IS NOT NULL
     AND o.stripe_product_id <> _stripe_product_id THEN
    RAISE EXCEPTION 'product_mismatch';
  END IF;

  IF lower(o.currency) <> lower(_currency) THEN
    RAISE EXCEPTION 'currency_mismatch';
  END IF;

  -- Compare the SUBTOTAL against the expected price. Exclusive tax makes the
  -- total larger than the subtotal and must not reject a valid payment.
  _expected_subtotal := COALESCE(o.subtotal_amount, o.amount);
  IF COALESCE(_subtotal, _amount - COALESCE(_tax, 0) + COALESCE(_discount, 0))
       <> _expected_subtotal THEN
    RAISE EXCEPTION 'subtotal_mismatch:expected=%,got=%',
      _expected_subtotal, COALESCE(_subtotal, _amount - COALESCE(_tax, 0));
  END IF;

  IF o.status = 'paid' THEN
    IF o.provider_payment_id IS NOT NULL AND _provider_payment_id IS NOT NULL
       AND o.provider_payment_id <> _provider_payment_id THEN
      RAISE EXCEPTION 'payment_intent_mismatch';
    END IF;
    IF _environment = 'live' THEN
      SELECT id INTO _enrollment_id FROM public.enrollments
        WHERE user_id = o.user_id AND course_id = o.course_id AND status = 'active';
      IF _enrollment_id IS NULL THEN
        _enrollment_id := public.grant_enrollment(o.user_id, o.course_id, o.id);
      END IF;
    END IF;
    RETURN jsonb_build_object('order_id', o.id, 'enrollment_id', _enrollment_id, 'already_paid', true);
  END IF;

  IF o.status NOT IN ('pending','failed') THEN
    RAISE EXCEPTION 'invalid_transition_from:%', o.status;
  END IF;

  UPDATE public.orders
     SET status = 'paid',
         paid_at = now(),
         provider_payment_id = COALESCE(_provider_payment_id, provider_payment_id),
         customer_email = COALESCE(_customer_email, customer_email),
         subtotal_amount = COALESCE(_subtotal, subtotal_amount),
         tax_amount = COALESCE(_tax, 0),
         discount_amount = COALESCE(_discount, 0),
         total_amount = _amount,
         stripe_price_id = COALESCE(_stripe_price_id, stripe_price_id),
         stripe_product_id = COALESCE(_stripe_product_id, stripe_product_id),
         updated_at = now()
   WHERE id = o.id;

  -- Sandbox payments never grant real access.
  IF _environment = 'live' THEN
    _enrollment_id := public.grant_enrollment(o.user_id, o.course_id, o.id);
  END IF;

  RETURN jsonb_build_object('order_id', o.id, 'enrollment_id', _enrollment_id, 'already_paid', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_paid_order(uuid, public.payment_environment, text, text, bigint, text, text, bigint, bigint, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_order(uuid, public.payment_environment, text, text, bigint, text, text, bigint, bigint, bigint, text, text) TO service_role;

-- 9. Atomic refund outcome --------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_refund_outcome(
  _order_id uuid,
  _environment public.payment_environment,
  _refunded_total bigint,
  _provider_refund_id text DEFAULT NULL,
  _refund_status text DEFAULT 'succeeded'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders%ROWTYPE;
  _charged bigint;
  _fully boolean;
  _next public.order_status;
  _newer_active_order uuid;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found:%', _order_id;
  END IF;
  IF o.environment <> _environment THEN
    RAISE EXCEPTION 'environment_mismatch';
  END IF;

  _charged := COALESCE(NULLIF(o.total_amount, 0), o.amount);
  IF _refunded_total > _charged THEN
    RAISE EXCEPTION 'refund_exceeds_charge:charged=%,refunded=%', _charged, _refunded_total;
  END IF;

  _fully := _charged > 0 AND _refunded_total >= _charged;
  _next := CASE
             WHEN _fully THEN 'refunded'::public.order_status
             WHEN _refunded_total > 0 THEN 'partially_refunded'::public.order_status
             ELSE o.status
           END;

  UPDATE public.orders
     SET refunded_amount = GREATEST(COALESCE(refunded_amount, 0), _refunded_total),
         status = _next,
         updated_at = now()
   WHERE id = o.id;

  IF _fully AND _refund_status = 'succeeded' THEN
    -- A newer paid order for the same course keeps access alive.
    SELECT id INTO _newer_active_order FROM public.orders
     WHERE user_id = o.user_id
       AND course_id = o.course_id
       AND id <> o.id
       AND status = 'paid'
       AND created_at > o.created_at
     LIMIT 1;

    IF _newer_active_order IS NULL THEN
      UPDATE public.enrollments
         SET status = 'refunded', updated_at = now()
       WHERE user_id = o.user_id
         AND course_id = o.course_id
         AND (order_id = o.id OR order_id IS NULL);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'order_id', o.id,
    'status', _next,
    'fully_refunded', _fully,
    'refunded_amount', _refunded_total,
    'access_preserved_by_order', _newer_active_order,
    'provider_refund_id', _provider_refund_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_refund_outcome(uuid, public.payment_environment, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_refund_outcome(uuid, public.payment_environment, bigint, text, text) TO service_role;

-- 10. Diagnostic helper for duplicates (read-only, admin) -------------
CREATE OR REPLACE FUNCTION public.payments_duplicate_diagnostics()
RETURNS TABLE(scope text, duplicate_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'orders.provider_checkout_id', count(*) FROM (
    SELECT 1 FROM public.orders WHERE provider_checkout_id IS NOT NULL
     GROUP BY provider, environment, provider_checkout_id HAVING count(*) > 1) a
  UNION ALL
  SELECT 'orders.provider_payment_id', count(*) FROM (
    SELECT 1 FROM public.orders WHERE provider_payment_id IS NOT NULL
     GROUP BY provider, environment, provider_payment_id HAVING count(*) > 1) b
  UNION ALL
  SELECT 'payment_events.provider_event_id', count(*) FROM (
    SELECT 1 FROM public.payment_events
     GROUP BY provider, environment, provider_event_id HAVING count(*) > 1) c;
$$;

REVOKE ALL ON FUNCTION public.payments_duplicate_diagnostics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payments_duplicate_diagnostics() TO authenticated, service_role;