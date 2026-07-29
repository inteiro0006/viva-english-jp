## Diagnóstico

O curso **foi criado com sucesso** no banco (id `1c5df4e4…`, slug `eye-olhos`, status `draft`), mas não aparece por dois motivos independentes:

### 1. Bug na listagem do admin (`/admin/courses`)
`listAdminCourses` em `src/lib/admin/courses.admin.functions.ts` ordena por uma coluna que **não existe** na tabela `public.courses`:

```ts
.order("position", { ascending: true, nullsFirst: false })
.order("created_at", { ascending: true });
```

Colunas reais em `public.courses`: `id, title_ja, title_en, slug, description_ja, description_en, thumbnail_url, cover_url, price_jpy, status, access_type, access_duration_days, created_at, updated_at` — **não há `position`**.

Resultado: o Postgres retorna erro `column "position" does not exist`, o server function lança exceção e a tabela do admin fica vazia/quebrada. O mesmo problema afeta cursos existentes (só o "Eigo Mastery" também sumiria da lista).

### 2. Landing page pública não mostra rascunhos
O novo curso foi salvo com `status = 'draft'`. A landing e o catálogo público filtram por `status = 'published'`, então mesmo com a listagem admin corrigida ele só aparece publicamente depois de publicar.

## Correções

1. **`src/lib/admin/courses.admin.functions.ts`** — em `listAdminCourses`, remover a ordenação por `position` e manter apenas `.order("created_at", { ascending: false })` (mais recentes primeiro, comportamento esperado no admin).
2. Verificar rapidamente que nenhum outro `.from("courses")` no projeto usa `position` (grep). Se houver, remover também.
3. Nenhuma migração é necessária — não vamos adicionar `position` em `courses` porque a ordenação por criação já resolve e não há UI de drag-and-drop na lista de cursos (o DnD existente é para módulos/aulas, que têm `position` próprio).

## Como validar

- Após a correção, `/admin/courses` deve listar **"English" (draft)** e **"Eigo Mastery" (published)**.
- Para exibir o novo curso na landing/catálogo, mudar o status para `published` na tela de edição do curso.

## Detalhes técnicos

- Nada muda no schema Zod nem no formulário — a criação já funciona.
- Sem impacto em RLS, tipos gerados, ou outras rotas.
- Escopo: 1 arquivo alterado, ~2 linhas.