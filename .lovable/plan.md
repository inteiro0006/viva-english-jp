## O que muda

### 1. `/admin/modules` — lista de cursos com atalho para o currículo
Substituir o cartão informativo atual por uma lista de todos os cursos (fetch via `listAdminCourses`, que já existe e é protegido por `assertAdmin`). Cada linha mostra:

- Título (JA/EN conforme idioma atual) + slug em `font-mono`
- Badge de status (`draft` / `published` / `archived`)
- Contagem de módulos (via `courses` join com `modules`)
- Botão **"Editar currículo"** que navega para `/admin/courses/{id}?tab=curriculum`

Estados: skeleton no loading, mensagem vazia quando não há cursos.

### 2. `/admin/courses/$courseId` — aceitar `?tab=curriculum`
Adicionar `validateSearch` (Zod) para `tab: "details" | "curriculum"` (default `details`). Passar `defaultValue` do `<Tabs>` a partir do search param. Trocar tab local passa a atualizar a URL (`navigate` com `search`), preservando o link compartilhável.

### 3. Server function auxiliar
Estender `listAdminCourses` para trazer contagem de módulos com uma única query:
```ts
.select("*, modules(count)")
```
Sem migration necessária.

### 4. i18n
Novas chaves em `admin.modules_`:
- `browseTitle` / `browseSubtitle` — "Reorder or edit modules by opening a course's Curriculum tab."
- `editCurriculum` — "Edit curriculum"
- `moduleCount` — "{{count}} module(s)"
- `empty` já existe para o caso sem cursos

Textos em JA e EN.

## Detalhes técnicos

- `admin.courses.$courseId.tsx`: `validateSearch` no `createFileRoute`, ler `Route.useSearch()`, controlar `<Tabs value=... onValueChange=...>` com `navigate({ search: { tab } })`.
- `admin.modules.tsx`: `useQuery(["admin","courses"], listAdminCourses)`. Renderizar tabela leve (Card com linhas). Link usando `<Link to="/admin/courses/$courseId" params={{courseId: c.id}} search={{tab: "curriculum"}}>`.
- Sem mudanças de schema, sem migration, sem policies.

## Fora de escopo
- Reordenação de cursos (não existe coluna `position` em `courses`).
- Edição inline de módulos fora da página do curso.
