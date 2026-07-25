# Plano: Schema completo do LMS

## Situação atual verificada

Já existem no banco (não recriar, apenas estender se necessário):
- `public.profiles` (id, full_name, avatar_url, preferred_language, marketing_consent, timestamps) — **sem coluna `role`** (correto: role vive em `user_roles`).
- `public.user_roles` com enum `app_role` (student, admin) + política RLS.
- Funções `has_role(_user_id, _role)`, `handle_new_user()`, `set_updated_at()`.
- Enum `preferred_language` (ja, en).

**Decisão:** manter `role` fora de `profiles` (segurança já estabelecida via `user_roles` — não vamos regredir). O item "1. profiles → role" do pedido será atendido lendo o role via `has_role()` / `user_roles`, não como coluna.

## Migração única, idempotente

Uma migration só (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de recriar, `CREATE OR REPLACE FUNCTION`). Ordem: enums → tabelas → índices → GRANTs → RLS/policies → funções → triggers → seed.

### Novos enums
`course_status` (draft, published, archived), `access_type` (lifetime, limited), `stage_status`, `module_status`, `lesson_status` (mesmo conjunto), `lesson_type` (video, text, quiz, file), `release_type` (immediate, date, after_previous), `enrollment_status` (active, expired, revoked, refunded), `order_status` (pending, paid, failed, refunded, partially_refunded), `support_status` (open, in_progress, resolved, closed), `resource_type` (pdf, link, download, other).

### Tabelas (todas em `public`, com `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` onde aplicável)

1. `courses` — campos bilíngues, `slug` UNIQUE, `price_jpy int`, `status`, `access_type`, `access_duration_days int null`.
2. `course_stages` — FK `course_id`, `position int`, UNIQUE(course_id, position) deferrable.
3. `modules` — FK `course_id`, `stage_id`, `release_type`, `release_at timestamptz null`.
4. `lessons` — FK `module_id`, `lesson_type`, `cloudflare_video_uid text null`, `duration_seconds int`, `is_preview bool`.
5. `enrollments` — FK `user_id`→auth.users, `course_id`, `order_id` (nullable, FK adicionado após `orders`), UNIQUE(user_id, course_id).
6. `lesson_progress` — UNIQUE(user_id, lesson_id), `progress_seconds`, `progress_percentage numeric(5,2)`, `completed bool`, `completed_at`, `last_watched_at`.
7. `orders` — `provider text`, `provider_checkout_id`, `provider_payment_id`, `amount int`, `currency text default 'JPY'`, `status`, `customer_email`, `paid_at`.
8. `payment_events` — `provider_event_id UNIQUE NOT NULL` (idempotência), `payload jsonb`, `processed bool`, `processing_error text`.
9. `lesson_resources` — FK `lesson_id`, bilíngue, `resource_type`, `file_url`, `position`.
10. `support_requests` — FK `user_id`, `subject`, `message`, `status`.
11. `testimonials` — bilíngue, `rating smallint check between 1..5`, `published`, `position`.
12. `faq_items` — bilíngue, `category`, `published`, `position`.

`course_progress` → **função SQL** `public.get_course_progress(_user_id uuid, _course_id uuid)` retornando `(total_lessons int, completed_lessons int, percentage numeric, last_lesson_id uuid, last_watched_at timestamptz)`. Sem tabela derivada.

### Índices
`courses(slug)` unique já pela constraint; `courses(status)`; FKs em stages/modules/lessons/enrollments/lesson_progress/orders/lesson_resources; `(course_id, position)`, `(module_id, position)`, `(stage_id, position)`; `enrollments(user_id, status)`, `orders(user_id, status)`, `payment_events(provider_event_id)`, `lesson_progress(user_id, lesson_id)`.

### GRANTs (obrigatório em toda tabela `public`)
- Conteúdo público (courses/stages/modules/lessons/lesson_resources/testimonials/faq_items): `GRANT SELECT TO anon, authenticated`; `GRANT ALL TO service_role`; escritas de admin passam por RLS `authenticated`.
- Dados do usuário (enrollments, lesson_progress, orders, support_requests): `GRANT SELECT, INSERT, UPDATE ON ... TO authenticated`; `GRANT ALL TO service_role`. Sem `anon`.
- `payment_events`: apenas `service_role` (webhooks server-side).

### Funções auxiliares (SECURITY DEFINER onde necessário, `set search_path=public`)
- `public.is_admin(_uid uuid) returns boolean` — wrapper de `has_role(_uid,'admin')`.
- `public.has_active_enrollment(_uid uuid, _course_id uuid) returns boolean` — checa `enrollments.status='active'` e `expires_at is null or > now()`.
- `public.is_module_released(_module_id uuid) returns boolean` — avalia `release_type`.
- `public.get_next_lesson(_uid uuid, _course_id uuid) returns uuid`.
- `public.get_course_progress(...)` conforme acima.

Todas com `EXECUTE` para `authenticated` apenas onde faz sentido (progresso e next_lesson); `payment_events` writers ficam server-only.

### RLS

- Enable em todas as novas tabelas.
- **courses/course_stages/lessons/modules/lesson_resources**:
  - SELECT (anon+authenticated) quando `status='published'` — para `lessons`, apenas quando `is_preview=true` OU `has_active_enrollment(auth.uid(), course_id_do_module)` (via subquery). Módulos também precisam de `is_module_released`.
  - INSERT/UPDATE/DELETE: `is_admin(auth.uid())`.
- **enrollments**: SELECT próprio (`user_id=auth.uid()`) + admin. INSERT/UPDATE/DELETE: admin ou `service_role` (aluno NÃO cria matrícula).
- **orders**: SELECT próprio + admin. INSERT/UPDATE/DELETE: apenas `service_role` (aluno não altera pedido).
- **lesson_progress**: SELECT/INSERT/UPDATE próprio (`user_id=auth.uid()`). Sem DELETE para aluno.
- **support_requests**: SELECT/INSERT próprio; UPDATE só admin.
- **testimonials/faq_items**: SELECT público quando `published=true`; escrita só admin.
- **payment_events**: nenhuma policy para `authenticated`/`anon` (só `service_role` via GRANT).
- **profiles**: manter policies existentes; adicionar policy `admin SELECT all`.

Nenhuma policy referencia a própria tabela; admin sempre via `has_role`/`is_admin` (evita recursão).

### Triggers
- `set_updated_at` BEFORE UPDATE em todas as tabelas com `updated_at`.
- `handle_new_user` mantido.
- Trigger em `lesson_progress` BEFORE UPDATE: se `progress_percentage >= 95` → `completed=true, completed_at=now()`.
- Nenhum trigger que confie em dados do cliente para marcar pagamento.

### Seed (dentro da mesma migration, idempotente com `ON CONFLICT DO NOTHING` por slug)
- 1 curso (`slug='eigo-mastery'`, published, lifetime, price 49800).
- 6 stages (Foundations → Fluency).
- 3 módulos de exemplo no primeiro stage.
- 6 lições exemplo (2 por módulo, `cloudflare_video_uid=null`, 1 `is_preview=true`).
- Sem usuários fictícios em `auth.users`.
- Não popula testimonials/faq via SQL (já existem em `src/data/`); pode ser feito depois se desejado.

## Após aprovação da migration

1. Tipos TS regenerados automaticamente (`src/integrations/supabase/types.ts`).
2. Criar helpers de dados em `src/lib/lms/`:
   - `courses.functions.ts` (public read via server publishable client).
   - `enrollment.functions.ts` (`requireSupabaseAuth`).
   - `progress.functions.ts` (`requireSupabaseAuth`, chama `get_course_progress`).
3. Não altero UI existente nesta etapa — apenas schema + tipos + funções de acesso.

## Placeholders / etapas futuras

- Webhook Stripe (`/api/public/webhooks/stripe`) que insere em `orders` + `enrollments` — próxima etapa.
- Player Cloudflare Stream (signed URLs via server fn) — próxima etapa.
- CRUD admin UI — próxima etapa.

## Variáveis de ambiente necessárias (ainda não configuradas)

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_JWK`

Supabase URL/keys já injetados pelo Lovable Cloud.

## Critérios de aceitação

Todos os itens da lista do pedido são cobertos: idempotência, RLS estrita, aluno sem acesso a conteúdo sem matrícula (exceto preview), aluno não altera orders/role, idempotência em `payment_events`, conteúdo bilíngue modelado, sem segredos no banco.
