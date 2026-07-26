## Escopo

Painel administrativo completo, com autorização servidor-lado (RLS + `has_role` em cada server fn), auditoria de ações críticas e UI responsiva bilíngue.

## 1. Banco de dados — 1 migração

- Nova tabela `public.admin_audit_logs`:
  - `id`, `admin_id (uuid → auth.users)`, `action (text)`, `entity_type (text)`, `entity_id (text)`, `old_values (jsonb)`, `new_values (jsonb)`, `created_at (timestamptz)`.
  - GRANT: `SELECT` para `authenticated` (usado por admins via política); `ALL` para `service_role`.
  - RLS: `SELECT` só para `is_admin(auth.uid())`. Sem `INSERT/UPDATE/DELETE` para roles não-serviço — logs são gravados só via server fns com service role.

- Nova tabela `public.platform_settings` (chave-valor tipado JSON, singleton por `key`):
  - Colunas: `key text primary key`, `value jsonb`, `updated_at`, `updated_by`.
  - GRANT: `SELECT` para `anon, authenticated` em chaves marcadas públicas (via view segura), `ALL` service role.
  - RLS: `SELECT` público em chaves whitelisted; `UPDATE/INSERT` só admin.
  - Seed inicial: `platform_name`, `support_email`, `display_price_jpy`, `institutional_ja/en`, `socials`, `terms_ja/en`, `privacy_ja/en`, `video_completion_threshold`, `access_policy`, `active_languages`.

- Função `public.log_admin_action(action, entity_type, entity_id, old_values, new_values)` — `SECURITY DEFINER`, verifica `is_admin(auth.uid())` e insere na `admin_audit_logs`.

## 2. Server functions com middleware admin

Novo `src/lib/admin/require-admin.ts` — middleware que estende `requireSupabaseAuth` e verifica `has_role(userId, 'admin')` via `context.supabase.rpc('has_role', ...)`. Retorna 403 se não for admin.

Novos server fns em `src/lib/admin/`:

- `dashboard.functions.ts` → `getAdminDashboard()`
  Agrega: contagens (profiles/enrollments ativos/orders pagos), receita (sum(orders.amount) onde status='paid'), taxa média de conclusão (via `lesson_progress`), top 5 lessons por watch count, vídeos com status `pendingupload/inprogress`, count support_requests abertos. Query única em Postgres via RPC agregado quando possível; caso contrário paralelos.

- `courses.admin.functions.ts` → `listAdminCourses`, `getAdminCourse`, `createCourse`, `updateCourse`, `duplicateCourse`, `publishCourse`, `archiveCourse`, `reorderCourses`. Cada mutação: valida com Zod, chama `log_admin_action` com old/new.

- `modules.admin.functions.ts` → CRUD, `reorderModules(courseId, ids[])`, `updateModuleRelease` (immediate/date/after_previous).

- `lessons.admin.functions.ts` → CRUD, `reorderLessons(moduleId, ids[])`, `setLessonVideo` (delega ao stream), publish/unpublish.

- `students.admin.functions.ts` → `listStudents(search, filter, page)`, `getStudentProfile`, `grantEnrollment(userId, courseId, expiresAt?)`, `revokeEnrollment(enrollmentId)`, `setEnrollmentExpiry`. Auditadas. Nunca aceita mudança de e-mail/senha (só via auth flow do próprio usuário).

- `orders.admin.functions.ts` → `listOrders(filter)`, `getOrder` (com eventos de payment_events). Sem função de "marcar pago manual" — todo status vem do webhook Stripe. Reembolso: `initiateRefund(orderId)` fica preparado, logando `refund_initiated` (implementação de chamada Stripe fica em stub controlado; server fn valida admin e loga; execução Stripe real pode ser feita em passo seguinte quando o usuário confirmar).

- `settings.admin.functions.ts` → `getSettings`, `updateSetting(key, value)`. Auditado.

- `audit.admin.functions.ts` → `listAuditLogs(filter, page)`.

## 3. Layout admin

Atualizar `AdminLayout.tsx`:
- Sidebar `shadcn-sidebar` colapsável (icon-only quando collapsed), com item ativo em destaque, incluindo item novo "Auditoria".
- Header: `SidebarTrigger`, breadcrumbs derivados de `useRouterState`, busca global (Ctrl/⌘K abre command palette para navegação rápida a alunos/pedidos), `LanguageSwitcher`, menu de usuário (dropdown com nome, logout).
- Toaster já existe (sonner). Padrão de confirmação: dialog `AlertDialog` com "Digite CONFIRMAR" para ações destrutivas (revogar acesso, arquivar curso).
- Versão mobile: sidebar off-canvas via `SidebarProvider`.

## 4. Páginas

Cada página abaixo usa `useQuery` para leituras e `useMutation` para escritas com `toast.success/error` e `queryClient.invalidateQueries`.

- **/admin** (`admin.index.tsx`) — Dashboard real com cards de KPIs, gráfico simples de matrículas nos últimos 30 dias (barras em SVG puro, sem lib nova), lista "Top lições", "Vídeos processando", "Suporte aberto". Empty states honestos.

- **/admin/courses** — Tabela de cursos (título, slug, status, preço, ordem). Criar (Sheet lateral), editar inline (drag para reordenar via `@dnd-kit/core` já instalado se disponível — senão setas up/down para persistir ordem), duplicar, publicar, arquivar (confirmação).

- **/admin/courses/$courseId** — Editor de curso em abas:
  - Detalhes (título JA/EN, descrição JA/EN, slug, preço, capas, status, thumbnail_url, banner_url).
  - Etapas & módulos: árvore com drag-and-drop; ao selecionar etapa/módulo mostra painel lateral de edição (release_type/release_at, disponibilidade).
  - Lições: sub-lista por módulo com criar/editar/reordenar, tipo, duração, `is_preview`, `status`, vínculo com vídeo (Select buscando `stream_videos.ready`), anexos.
  - Preview: botão que abre `/course/:slug` em nova aba.

- **/admin/modules** — Lista global de módulos com filtro por curso; atalho para o editor do curso.

- **/admin/lessons** — Lista global com filtros (curso, módulo, status), busca por título; ações rápidas: publicar/despublicar, anexar/desanexar vídeo.

- **/admin/videos** — Já existe. Adaptar para: usar server fn admin-scoped, mostrar retry, thumbnail, duração, status, associação a lição (multi via `listLessonsForVideo`).

- **/admin/students** — Busca (nome/e-mail), filtros (com matrícula, sem matrícula, expirado). Drawer com perfil: dados, matrículas, progresso (`get_course_progress`). Ações auditáveis: Conceder acesso (curso + expiração opcional), Revogar (confirmação forte), Definir expiração. Sem alteração de auth data.

- **/admin/orders** — Tabela: ID, aluno (join profiles), curso, valor (formatado JPY), status, data, `provider_checkout_id`, `provider_payment_id`. Drawer com detalhes + histórico de `payment_events`. Botão "Iniciar reembolso" (server fn auditada, marcada `stub_pending_stripe_call` até implementação Stripe explícita) — visível apenas para orders `paid`. Sem "marcar como pago" manual.

- **/admin/settings** — Formulário React Hook Form + Zod, agrupado por seções (Plataforma, Suporte, Preço exibido, Textos JA/EN, Redes, Termos, Privacidade, Vídeo, Acesso, Idiomas). `useBlocker` para prevenir perda de alterações.

- **/admin/audit** (nova rota `admin.audit.tsx`) — Lista logs paginada, filtros por action/entity, expandir para ver diff old_values→new_values.

## 5. Componentes reutilizáveis

- `AdminPageHeader` (título, breadcrumbs, ações à direita).
- `DataTable` fino sobre shadcn Table (sort, paginação simples).
- `ConfirmDialog` com input "type to confirm".
- `LocalizedField` par de inputs JA/EN sincronizado.
- `BilingualTextarea`.
- `SortableList` wrapper sobre @dnd-kit (usar apenas se já presente; caso contrário fallback com setas + persist).

## 6. i18n

Expandir `src/locales/{ja,en}/common.json` com bloco `admin.*` completo (dashboard, courses, modules, lessons, students, orders, settings, audit, confirms, empty states, erros).

## 7. Ações auditadas

Toda mutação em cursos, módulos, lições, matrículas manuais, configurações, e reembolsos passa por `log_admin_action` dentro da própria server fn (após validação, antes/depois do write conforme a semântica). Falhas de auditoria não devem impedir a operação, mas são logadas em `console.error`.

## 8. Segurança

- `require-admin` middleware em TODAS as server fns admin.
- RLS já cobre leituras (policies com `is_admin`). Mutações usam client autenticado da requisição — service role só onde estritamente necessário (ex.: `log_admin_action` via RPC `SECURITY DEFINER`).
- Nunca expor `STRIPE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_*` para o browser.
- CTA de sair usa `signOut` com cache teardown (padrão existente).

## Detalhes técnicos

- **Rotas TanStack**: manter arquivos existentes; adicionar `src/routes/admin.audit.tsx`. Todos aninhados sob `/admin` (que já garante SSR-off + gate).
- **Zod schemas** compartilhados em `src/lib/admin/schemas.ts`.
- **Drag-and-drop**: instalar `@dnd-kit/core` + `@dnd-kit/sortable` se ainda não presentes.
- **Fora de escopo agora**: chamada real ao endpoint Stripe de refund (fica com stub auditado), edição de traduções da UI, upload de novo bucket para thumbnails de curso (usar URLs por enquanto).

## Ordem de implementação

1. Migração `admin_audit_logs`, `platform_settings`, `log_admin_action` RPC.
2. `require-admin` middleware + `admin/*.functions.ts` (com auditoria).
3. `AdminLayout` novo (sidebar shadcn, header, busca, user menu, breadcrumbs).
4. Dashboard `/admin`.
5. Courses (lista + editor detalhado com abas).
6. Modules / Lessons globais.
7. Students.
8. Orders.
9. Settings.
10. Audit.
11. i18n final + revisão responsiva.

## O que fica placeholder

- Execução real da chamada Stripe para reembolso (server fn preparada + auditada, mas o call ao gateway fica marcado como próxima etapa).
- Upload direto de imagens de capa (por ora usa URL). Bucket de storage pode ser criado num prompt seguinte.
