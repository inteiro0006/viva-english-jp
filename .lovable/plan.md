## O que a mensagem significa

O campo **Slug** do formulário "New course" só aceita letras minúsculas (a–z), números (0–9) e hífens (`-`) — nada de espaços, acentos, maiúsculas ou caracteres especiais. Essa regra está no schema Zod (`src/lib/admin/schemas.ts`):

```
/^[a-z0-9-]+$/  → "slug must be lowercase-with-dashes"
```

Exemplos válidos: `eigo-mastery`, `business-english-2026`
Exemplos inválidos: `Eigo Mastery`, `英語マスター`, `curso_ingles`, `EIGO`

O slug é usado na URL pública do curso (`/course/<slug>`), por isso precisa ser "URL-safe".

## Como resolver

Duas melhorias na UI de `/admin/courses`, sem mexer na regra de validação (que continua correta no backend):

1. **Auto-slugify na digitação**
   Ao digitar no campo Slug, transformar em tempo real:
   - passar para minúsculas
   - remover acentos (normalize NFD + strip diacríticos)
   - trocar espaços/underscores por `-`
   - remover qualquer caractere fora de `[a-z0-9-]`
   - colapsar hífens repetidos

2. **Sugestão automática a partir do título EN**
   Se o campo Slug estiver vazio, preencher automaticamente com o slug derivado do `title_en` quando o usuário sair do campo (onBlur). O usuário ainda pode editar manualmente.

3. **Ajuda visual no campo**
   - `placeholder` mais explícito: `eigo-mastery` (já existe).
   - Texto de ajuda pequeno abaixo do input: "Somente minúsculas, números e hífens. Ex.: `eigo-mastery`."
   - Mensagem de erro amigável exibida inline no dialog (em vez do JSON cru do Zod que aparece hoje via `toast.error(e.message)`).

4. **Erro amigável no toast**
   No `onError` do `createMut`, detectar quando `e.message` é um JSON do Zod e mostrar apenas a mensagem legível (ex.: "Slug deve conter apenas letras minúsculas, números e hífens.") com i18n em JA/EN.

## Fora do escopo

- Alterar a regex do schema (a regra atual está correta para URLs).
- Refatorar outros formulários admin (módulos/lições) — pode ser feito depois com o mesmo helper `slugify`.

## Detalhes técnicos

- Novo helper `slugify()` em `src/lib/utils.ts` (puro, sem dependências).
- Alterar `src/routes/admin.courses.tsx`:
  - `onChange` do campo slug passa por `slugify`.
  - `onBlur` do `title_en`: se `form.slug` vazio, `setForm({ ...form, slug: slugify(form.title_en) })`.
  - Adicionar `<p className="text-xs text-muted-foreground">` como hint.
  - `onError` do `createMut`: tentar `JSON.parse(e.message)`; se for array Zod, mapear para `t("admin.courses_.errors.<code>")`.
- Adicionar strings em `src/locales/ja/common.json` e `src/locales/en/common.json` (`admin.courses_.slugHint`, `admin.courses_.errors.invalid_slug`).
