## Objetivo

Hoje `/admin/students` já lista perfis (`public.profiles`) com suas matrículas. O que falta é uma visão focada em **cadastros** — todos os usuários que criaram conta, com **e-mail** (que vive em `auth.users`, não em `profiles`), **role** (student/admin) e **data de cadastro**, independentemente de terem comprado curso.

## Escopo

Adicionar uma segunda aba na tela `/admin/students`:

```text
[ Alunos ]  [ Todos os usuários ]
```

- **Alunos** (aba atual): mantém o comportamento existente (perfis + matrículas + filtro all/enrolled/not_enrolled).
- **Todos os usuários** (nova): tabela plana de cadastros com colunas:
  - Nome (`profiles.full_name`)
  - E-mail (de `auth.users.email`)
  - Role (`admin` / `student`, derivado de `user_roles`)
  - Idioma preferido
  - Cadastrado em (`profiles.created_at`)
  - Última atividade (`auth.users.last_sign_in_at`)
  - Ações: link para o detalhe do aluno já existente
- Busca por nome ou e-mail e filtro por role (todos / admin / student).
- Paginação (25 por página) e contagem total.
- Export CSV opcional fica fora desta iteração.

## Detalhes técnicos

1. **Server function nova** em `src/lib/admin/students.admin.functions.ts`:
   - `listAllUsers({ search, role, page })` protegida por `requireSupabaseAuth` + `assertAdmin`.
   - Como `auth.users` não é acessível via PostgREST, usar `supabaseAdmin` (import dinâmico dentro do handler, padrão já usado no projeto) para chamar `auth.admin.listUsers({ page, perPage: 25 })`.
   - Em paralelo, buscar `profiles` e `user_roles` pelos ids retornados e fazer merge em memória.
   - Filtro por `search` aplicado sobre email/full_name após o merge; filtro `role` via `user_roles`.
   - Retornar `{ rows, total, pageSize }` no mesmo formato de `listStudents`.

2. **UI** em `src/routes/admin.students.tsx`:
   - Envolver o conteúdo atual em `<Tabs>` do shadcn com dois `TabsContent`.
   - Novo componente/seção `AllUsersTab` que consome `listAllUsers` via `useQuery`, com input de busca, `Select` de role, tabela e paginação — reutilizando os mesmos primitivos visuais da aba atual.
   - Badge colorido para role admin.

3. **Auditoria/segurança**:
   - Nenhuma escrita nova; apenas leitura administrativa. `assertAdmin` já registra a barreira.
   - Sem exposição de dados sensíveis além de e-mail (admin-only, atrás de RLS + role check no server).

4. **i18n**: adicionar strings em `src/locales/ja/common.json` e `src/locales/en/common.json` para títulos de aba, colunas e filtro de role.

## Fora do escopo

- Editar role a partir dessa tela (promover/demover admin) — pode ser uma iteração seguinte.
- Export CSV.
- Alterar a aba atual de "Alunos".
