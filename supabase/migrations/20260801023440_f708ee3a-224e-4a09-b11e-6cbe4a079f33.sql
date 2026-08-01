INSERT INTO public.platform_settings (key, value, is_public)
VALUES ('payments.sandbox_grants_access', 'false'::jsonb, false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sandbox_grants_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT value::text = 'true' FROM public.platform_settings
      WHERE key = 'payments.sandbox_grants_access'),
    false);
$$;

REVOKE ALL ON FUNCTION public.sandbox_grants_access() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fulfill_paid_order(_order_id uuid, _environment payment_environment, _provider_checkout_id text, _provider_payment_id text, _amount bigint, _currency text, _customer_email text DEFAULT NULL::text, _subtotal bigint DEFAULT NULL::bigint, _tax bigint DEFAULT 0, _discount bigint DEFAULT 0, _stripe_price_id text DEFAULT NULL::text, _stripe_product_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
  _enrollment_id uuid;
  _expected_subtotal bigint;
  _may_grant boolean;
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

  _expected_subtotal := COALESCE(o.subtotal_amount, o.amount);
  IF COALESCE(_subtotal, _amount - COALESCE(_tax, 0) + COALESCE(_discount, 0))
       <> _expected_subtotal THEN
    RAISE EXCEPTION 'subtotal_mismatch:expected=%,got=%',
      _expected_subtotal, COALESCE(_subtotal, _amount - COALESCE(_tax, 0));
  END IF;

  -- Live always grants. Sandbox only when an admin explicitly enabled the flag.
  _may_grant := (_environment = 'live') OR public.sandbox_grants_access();

  IF o.status = 'paid' THEN
    IF o.provider_payment_id IS NOT NULL AND _provider_payment_id IS NOT NULL
       AND o.provider_payment_id <> _provider_payment_id THEN
      RAISE EXCEPTION 'payment_intent_mismatch';
    END IF;
    IF _may_grant THEN
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

  IF _may_grant THEN
    _enrollment_id := public.grant_enrollment(o.user_id, o.course_id, o.id);
  END IF;

  RETURN jsonb_build_object('order_id', o.id, 'enrollment_id', _enrollment_id, 'already_paid', false);
END;
$function$;