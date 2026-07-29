## Situação atual

Em `/admin/courses/:id?tab=curriculum`, cada lição é criada com título padrão **"新しいレッスン" / "New lesson"** (linha 559-561 de `admin.courses.$courseId.tsx`) e a UI atual (`SortableLesson`, linhas 615-651) só mostra o título como texto — não há como editar. O server function `updateLesson` já existe em `src/lib/admin/lessons.admin.functions.ts` e aceita `patch` parcial com `title_ja` / `title_en`.

Ou seja: só falta a UI de renomear.

## Plano — adicionar edição inline do título da lição

1. **`src/routes/admin.courses.$courseId.tsx`** — `SortableLesson`:
   - Adicionar botão "editar" (ícone `Pencil`) que abre um pequeno diálogo (`Dialog` do shadcn) com dois inputs: **Título (JA)** e **Título (EN)**.
   - Salvar chama `updateLesson({ id, patch: { title_ja, title_en } })` e invalida a query do currículo para refletir o novo nome imediatamente.
   - Validação leve: ambos obrigatórios, ≤ 200 chars (já espelha `lessonInputSchema`).
   - Manter drag handle, badges e delete no lugar; o botão de edição vai entre o título e o badge de tipo.

2. **`src/locales/{ja,en}/common.json`** — adicionar chaves sob `admin.lessons_`:
   - `edit`, `editTitle`, `titleJa`, `titleEn`, `save`, `cancel`, `updated` (toast).

3. **Verificação**: após aplicar, abrir `/admin/courses/:id?tab=curriculum`, clicar no lápis de uma lição, alterar o nome, salvar e confirmar que a lista atualiza sem reload.

Nenhuma mudança de schema ou server function é necessária — apenas UI + i18n.

## Alternativa (se preferir)

Se quiser edição ainda mais rápida, posso fazer o título virar um campo editável in-place (clique no texto → input) em vez de diálogo. Diga qual prefere; caso contrário sigo com o diálogo (mais claro, permite editar JA e EN juntos).