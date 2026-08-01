-- 1. Encerra duplicados pendentes antigos (nunca apaga linhas).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, course_id, environment
           ORDER BY created_at DESC, id DESC
         ) AS rn
    FROM public.orders
   WHERE status = 'pending'
)
UPDATE public.orders o
   SET status = 'canceled', updated_at = now()
  FROM ranked r
 WHERE o.id = r.id AND r.rn > 1;

-- 2. Regra definitiva contra novos duplicados.
DROP INDEX IF EXISTS public.orders_pending_per_user_course_env_idx;
CREATE UNIQUE INDEX IF NOT EXISTS orders_pending_per_user_course_env_uidx
  ON public.orders (user_id, course_id, environment)
  WHERE status = 'pending';

-- 3. Abertura de pedido pendente realmente atômica.
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
  IF _subtotal IS NULL OR _subtotal <= 0 THEN
    RAISE EXCEPTION 'invalid_subtotal';
  END IF;
  IF _currency IS NULL OR length(_currency) <> 3 THEN
    RAISE EXCEPTION 'invalid_currency';
  END IF;

  INSERT INTO public.orders
    (user_id, course_id, provider, environment, status, amount, subtotal_amount,
     total_amount, currency, stripe_price_id, stripe_product_id, customer_email)
  VALUES
    (_user_id, _course_id, 'stripe', _environment, 'pending', _subtotal, _subtotal,
     _subtotal, lower(_currency), _stripe_price_id, _stripe_product_id, _customer_email)
  ON CONFLICT (user_id, course_id, environment) WHERE status = 'pending'
  DO UPDATE SET
    -- Só reescreve as expectativas quando o preço/moeda/price_id mudou.
    amount = EXCLUDED.amount,
    subtotal_amount = EXCLUDED.subtotal_amount,
    total_amount = EXCLUDED.total_amount,
    currency = EXCLUDED.currency,
    stripe_price_id = EXCLUDED.stripe_price_id,
    stripe_product_id = EXCLUDED.stripe_product_id,
    customer_email = COALESCE(EXCLUDED.customer_email, public.orders.customer_email),
    provider_checkout_id = CASE
      WHEN public.orders.amount <> EXCLUDED.amount
        OR lower(public.orders.currency) <> EXCLUDED.currency
        OR public.orders.stripe_price_id IS DISTINCT FROM EXCLUDED.stripe_price_id
      THEN NULL
      ELSE public.orders.provider_checkout_id
    END,
    updated_at = now()
  RETURNING * INTO o;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'pending_order_unavailable';
  END IF;
  RETURN o;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_pending_order(uuid, uuid, public.payment_environment, bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_pending_order(uuid, uuid, public.payment_environment, bigint, text, text, text, text) TO service_role;