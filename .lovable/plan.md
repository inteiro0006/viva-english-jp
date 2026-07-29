## Objetivo

Adicionar uma nova área no painel admin — **/admin/payments** — para auditar eventos do Stripe (tabela `payment_events`), inspecionar payloads, e reprocessar manualmente a criação de `orders`/`enrollments` quando um webhook falhou ou ficou preso em `processing_error`.

## Escopo

1. **Nova rota**: `src/routes/admin.payments.tsx` (listada no `AdminLayout` nav como "Payments" / 決済).
2. **Server functions** (novo arquivo `src/lib/admin/payments.admin.functions.ts`, todas protegidas por `requireSupabaseAuth` + `assertAdmin`, com `logAdminAction`):
   - `listPaymentEvents({ status?, eventType?, providerEventId?, from?, to?, page? })` — lista paginada de `payment_events` com filtros (processados, falhados, não processados; tipo de evento; busca por `provider_event_id` ou metadata userId/orderId; intervalo de datas).
   - `getPaymentEvent({ id })` — retorna o evento completo com payload JSON, e resolve o `order` + `enrollment` correspondentes (via metadata) para mostrar estado atual.
   - `reprocessPaymentEvent({ id })` — reexecuta o handler adequado (`checkout.session.completed`, `charge.refunded`, `checkout.session.expired`, `payment_intent.payment_failed`) usando o payload já salvo, de forma idempotente. Atualiza `processed` / `processing_error`. Auditado.
   - `manualEnrollment({ userId, courseId, orderId? })` — cria uma `enrollment` ativa manualmente para casos onde o webhook nunca chegou (ex.: pagamento fora do Stripe ou cortesia). Auditado com `entity_type: "enrollment"`, action `enrollment.manual_create`.
3. **Refatoração leve do webhook** (`src/routes/api/public/payments/webhook.ts`):
   - Extrair os handlers (`handleCheckoutCompleted`, `handleRefund`, `handleSessionExpired`, `handlePaymentFailed`) e a função `dispatchStripeEvent(eventType, payload)` para um módulo `src/lib/payments/stripe-handlers.server.ts`, para que tanto o webhook quanto `reprocessPaymentEvent` compartilhem exatamente a mesma lógica. O comportamento do webhook público não muda.
4. **UI** (`admin.payments.tsx`):
   - Header com KPIs: total, processados, falhas, não processados (últimas 24h/7d).
   - Filtros: status (all / processed / failed / pending), event_type (select dos tipos vistos), busca por `provider_event_id` ou userId/orderId, data range.
   - Tabela com colunas: quando, tipo, provider_event_id (truncado), status (badge verde/vermelho/cinza), erro resumido, order/user resolvido (link para `/admin/orders` e `/admin/students`).
   - Linha expansível mostrando: payload JSON formatado, estado atual do `order` e `enrollment` associados, botão **Reprocess** (confirmação), e (quando aplicável) botão **Create enrollment manually** que abre diálogo com `userId` + `courseId` pré-preenchidos a partir da metadata.
   - Export CSV do resultado filtrado (mesmo padrão de `/admin/audit`).
5. **i18n**: chaves em `src/locales/{en,ja}/common.json` sob `admin.payments.*`.
6. **Nav**: adicionar item "Payments" em `AdminLayout` (entre Orders e Audit) com ícone `CreditCard`.

## Notas técnicas

- Sem alterações de schema — `payment_events` já tem tudo o que precisamos (`payload`, `processed`, `processing_error`, `provider_event_id`).
- `reprocessPaymentEvent` chama `dispatchStripeEvent` com o `payload` salvo, então é idempotente por design (o handler de checkout já checa enrollment existente antes de inserir).
- `manualEnrollment` respeita a mesma checagem "already active" para evitar duplicatas; opcionalmente também marca o `order` como `paid` se um `orderId` for informado.
- Todas as ações escrevem em `admin_audit_logs` via `logAdminAction`, aparecendo em `/admin/audit`.
- Nenhuma alteração no fluxo público de checkout, no webhook handler HTTP, ou em RLS. `payment_events` continua acessível apenas via service role.

## Fora de escopo

- Reenviar eventos direto do Stripe (isso continua via dashboard do Stripe → o handler existente vai receber e gravar normalmente).
- Reembolsos iniciados pelo admin (só reprocessamento de eventos já recebidos).
