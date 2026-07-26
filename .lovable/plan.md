# Pagamento único via Stripe — Eigo Academy (¥49.800)

## Contexto verificado
- Pagamentos Stripe já habilitados (sandbox: `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `VITE_PAYMENTS_CLIENT_TOKEN`).
- Já existem no banco: `orders`, `enrollments`, `payment_events`, `courses` (com curso "Eigo Mastery" seed).
- Rotas placeholder existem: `/checkout`, `/payment/success`, `/payment/cancel`.
- Conta Stripe será baseada no Japão → **não** usa `managed_payments` (Japão está excluído). Usaremos `automatic_tax: { enabled: true }` (Stripe calcula, vendedor declara).
- Moeda JPY é zero-decimal → `amount = 49800` direto.

## O que será entregue

### 1. Produto no Stripe
- `eigo_academy_course` / preço `eigo_academy_onetime` — ¥49.800, one-time, quantidade 1, tax code `txcd_10103000` (educational services).

### 2. Utilitário Stripe server-only (`src/lib/stripe.server.ts`)
- `createStripeClient(env)` roteando via connector-gateway (nunca instanciar Stripe SDK direto).
- `verifyWebhook(req, env)` com HMAC-SHA256 e janela de 5 min.
- `getStripeErrorMessage()`.

### 3. Cliente Stripe.js (`src/lib/stripe.ts`)
- `getStripe()` + `getStripeEnvironment()` derivando ambiente do prefixo `pk_test_` / `pk_live_` — falha explícita se token ausente.
- Instalar `@stripe/stripe-js@9.2.0` e `@stripe/react-stripe-js@6.2.0`.

### 4. Server function de checkout (`src/lib/payments/checkout.functions.ts`)
- `createCourseCheckoutSession` — protegido com `requireSupabaseAuth`.
- Resolve email a partir de `context.supabase.auth.getUser()` (nunca do cliente).
- Cria/reaproveita `Stripe Customer` com `metadata.userId` (função `resolveOrCreateCustomer` do knowledge).
- Verifica se o usuário **já possui matrícula ativa** no curso → retorna `{ error }` antes de abrir Stripe.
- Cria order local `status='pending'` com `provider_session_id`, `amount_cents=49800`, `currency='jpy'`, `course_id`.
- `checkout.sessions.create` com: `mode: 'payment'`, `ui_mode: 'embedded_page'`, `automatic_tax: { enabled: true }`, `payment_intent_data.description = 'Eigo Academy'`, `metadata: { userId, courseId, orderId }`, `return_url`.
- Retorna `clientSecret` **serializável** (nunca lança para o middleware genérico).

### 5. Página `/checkout`
- Protegida (se não autenticado → `/register?redirect=/checkout`).
- Layout split: à esquerda, resumo do curso (título, benefícios, preço formatado com `Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })`); à direita, `<EmbeddedCheckoutProvider>` + `<EmbeddedCheckout>`.
- Se usuário já matriculado → redireciona para `/student/dashboard`.
- Banner de test mode global (`PaymentTestModeBanner`) no `PublicLayout`.
- Textos em i18n JA/EN.

### 6. Webhook (`src/routes/api/public/payments/webhook.ts`)
- Verifica assinatura via `verifyWebhook`. Extrai `?env=sandbox|live`.
- Idempotência: usa `payment_events` (por `event_id`) — insert-only, ignora duplicados.
- Trata:
  - `checkout.session.completed` (mode=payment, payment_status=paid): atualiza `orders.status='paid'`, cria `enrollments` (`status='active'`, sem expires_at), grava `payment_events`.
  - `charge.refunded` / `payment_intent.refunded`: marca `orders.status='refunded'` e desativa a matrícula correspondente (`status='refunded'`).
  - `checkout.session.expired`: marca order como `expired`.
- Trata duplo pagamento (mesmo user, mesmo curso, matrícula já ativa): não cria segunda; marca a order duplicada com nota; opcional refund automático fica documentado como próximo passo.
- Cliente Supabase construído com `SUPABASE_SERVICE_ROLE_KEY` **dentro** do handler (nunca no escopo do módulo).

### 7. Páginas de resultado
- `/payment/success?session_id=...`: consulta a order pelo `provider_session_id` via server fn autenticada; polling curto (até 5s) enquanto webhook processa; ao confirmar → botão "Ir para o dashboard". Textos claros em JA/EN.
- `/payment/cancel`: mensagem + CTA para tentar novamente.

### 8. CTAs da landing
- Já autenticado sem compra → `/checkout`.
- Não autenticado → `/register?redirect=/checkout`.
- Aluno com matrícula → `/student/dashboard`.
- Admin → `/admin`.
- Lê o preço de um `getCoursePricing` (server fn) que consulta o Stripe (`prices.retrieve` via lookup_key) — nunca hardcoded no cliente.

### 9. Fonte única de preço
- Landing page e checkout consomem o mesmo endpoint. Fallback SSR: valor cacheado no `courses.price_cents` do banco (atualizado por script/admin, mas source of truth = Stripe).

### 10. Segurança e RLS
- Nenhuma chave secreta no bundle client (`stripe.server.ts` é server-only).
- Order/enrollment só criados/atualizados pelo webhook com `service_role`.
- Front nunca envia `amount`; server sempre resolve via `lookup_key`.
- `/api/public/payments/webhook` — sem `requireSupabaseAuth`; segurança = assinatura Stripe.

## O que NÃO será feito nesta etapa
- Cupons/descontos.
- Refund automático via UI admin (só o webhook reage a refund manual no Stripe).
- Faturamento recorrente (é pagamento único, por design).
- Go-live: usuário precisará completar onboarding do Stripe depois pela aba Payments.

## Variáveis usadas
Já configuradas: `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_PAYMENTS_CLIENT_TOKEN`. Nenhum secret novo necessário.

## Critérios de aceitação
- Preço sempre vem do Stripe (via `lookup_key`), nunca do cliente.
- Matrícula só é criada pelo webhook após `checkout.session.completed` com `payment_status='paid'`.
- Eventos duplicados são ignorados via `payment_events.event_id UNIQUE`.
- Compra duplicada bloqueada antes de abrir o Stripe.
- Refund manual no Stripe revoga acesso automaticamente.
- Dashboard só libera com `has_active_enrollment` verdadeiro.
- Nenhuma `STRIPE_SECRET_KEY` no frontend (usa gateway).
- Textos completos JA/EN.
