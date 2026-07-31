## Status real das 15 etapas

Observação de numeração: o que entreguei na última mensagem como "Etapas 7/8/9" correspondia, na verdade, às **Etapas 10 (storage), 14 (lint) e 15 (CI)** da sua lista original.

| Etapa | Tema | Status |
| --- | --- | --- |
| 1 | Credencial exposta | Concluída |
| 2 | Checkout Stripe server-side | Concluída |
| 3 | Webhook Stripe confiável | Concluída |
| 4 | Matrículas e reembolsos | **Parcial** — `grant_enrollment` transacional existe; refund real NÃO existe |
| 5 | Liberação de aulas | Concluída (`can_access_lesson`) |
| 6 | Progresso e certificados | **Parcial** — progresso protegido; estados do certificado e fonte JP embutida pendentes |
| 7 | Funções SECURITY DEFINER | **Pendente** |
| 8 | Currículo e migrações de dados | **Pendente** |
| 9 | Cloudflare Stream (webhook/reconciliação) | **Pendente** |
| 10 | Storage e uploads | **Parcial** — buckets privados, políticas por pasta e extensão feitas; limites de tamanho/MIME no bucket, validação de `avatar_url` e rate limit pendentes |
| 11 | Redirects, URLs e preço | **Pendente** (existe `safePath`, mas preço duplicado) |
| 12 | i18n, SEO e páginas legais | **Pendente** |
| 13 | Paginação administrativa | **Pendente** |
| 14 | Dependências, lint e docs | **Parcial** — lint zerado; dois lockfiles, README/ARCHITECTURE desatualizados |
| 15 | Testes e CI | **Parcial** — CI criado; faltam os testes da lista |

### Evidências verificadas agora

- `src/lib/admin/orders.admin.functions.ts` registra apenas "intenção de refund" (comentário explícito: chamada Stripe não implementada).
- `get_course_progress` e `is_certificate_eligible` aceitam `_uid` arbitrário sem checar `auth.uid()`, e são executáveis por `authenticated`.
- `is_module_released` retorna `true` para `after_previous`.
- `getCourseCurriculum` busca `lessons` sem filtrar pelos módulos do curso — retorna aulas de outros cursos.
- `listStudents` pagina antes de aplicar o filtro enrolled/not_enrolled e usa `listUsers({ perPage: 1000 })`; busca só por `full_name`.

## Plano de conclusão (ordem sugerida por risco)

### Bloco A — Segurança de acesso (Etapas 7 e 8)
1. Migration corrigindo `is_module_released` para `after_previous` (exige conclusão do módulo anterior) e separando helper interno de RLS da RPC pública.
2. `get_course_progress`, `get_next_lesson`, `is_certificate_eligible`, `has_active_enrollment`: exigir `_uid = auth.uid()` ou `is_admin(auth.uid())`; revogar EXECUTE de `PUBLIC`/`anon` onde não for necessário; garantir `SET search_path`.
3. Corrigir `getCourseCurriculum` para filtrar aulas pelos módulos do curso; revisar a migration destrutiva `20260729015209_*` tornando-a guardada/idempotente.

### Bloco B — Pagamentos (Etapa 4)
4. Refund real via API Stripe no servidor, com idempotency key, estados `refund_requested/processing/refunded/failed` em `orders`, atualização de pedido e matrícula somente pelo webhook `charge.refunded`, auditoria e UI que não afirma conclusão prematura.

### Bloco C — Cloudflare Stream (Etapa 9)
5. Webhook: assinatura + freshness obrigatórias, idempotência por ID do provedor, 5xx em falha recuperável, erros do Supabase sempre verificados.
6. Rotina administrativa de reconciliação Cloudflare↔banco, limpeza de vídeo órfão, separação de variáveis (upload/webhook/playback) e rate limit em criação de upload/token; cleanup de listeners no player.

### Bloco D — Aplicação (Etapas 10 restantes, 11, 12, 13)
7. Storage: limites de tamanho/MIME no nível do bucket, validação server-side de `avatar_url` e quota de anexos de suporte.
8. Preço em fonte única server-side (lookup key Stripe) consumida por landing, checkout e JSON-LD; `SITE_URL` validado.
9. i18n: remover textos hardcoded, `?lang=` funcional, sincronizar `html lang`/title/canonical/hreflang/sitemap; páginas legais com campos configuráveis e aviso administrativo enquanto incompletas.
10. Paginação administrativa: filtro/busca/contagem antes da paginação, busca por nome e e-mail, via RPC/view eficiente.

### Bloco E — Qualidade e testes (Etapas 14 e 15)
11. Um único gerenciador de pacotes/lockfile; ignorar arquivos gerados no lint; README operacional e `ARCHITECTURE.md` atualizados.
12. Testes unitários/integração (Vitest) e E2E cobrindo a lista da Etapa 15, com mocks de Stripe/Cloudflare; ligar os jobs de teste no workflow de CI já criado.

Posso executar bloco a bloco, começando pelo Bloco A (maior risco de segurança), ou seguir outra ordem que você preferir.