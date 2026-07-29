## Objetivo
Adicionar um botão "Attach video" em cada aula da aba Currículo (`/admin/courses/:id?tab=curriculum`), permitindo escolher um vídeo já enviado ao Cloudflare Stream (via `/admin/videos`) e associá-lo à aula sem sair da tela.

## Comportamento
- Cada linha de aula ganha um botão de vídeo entre o badge de tipo e o botão publish:
  - **Sem vídeo associado**: ícone `Video` outline + tooltip "Attach video".
  - **Com vídeo associado**: ícone `Video` preenchido/primário + título do vídeo em tooltip. Clicar reabre o diálogo para trocar ou remover.
- O diálogo mostra:
  - Lista dos `stream_videos` prontos (`ready_to_stream = true`), com thumbnail, título, duração e status.
  - Campo de busca por título.
  - Aviso "Nenhum vídeo pronto? Envie em /admin/videos" com link.
  - Ações: **Attach**, **Detach** (se já houver um), **Cancel**.
- Salvar chama a server function existente `setLessonVideo({ lessonId, videoUid })` (null para desassociar) — nenhuma nova server function necessária.
- Após sucesso: toast + `invalidateQueries` do currículo do curso para refletir o novo estado.

## Arquivos alterados
- `src/routes/admin.courses.$courseId.tsx`
  - Estender o tipo local de lesson para incluir `cloudflare_video_uid` (já retornado por `listAdminLessons`).
  - Novo componente `AttachVideoDialog` (mesmo arquivo) que consome `listStreamVideos` e chama `setLessonVideo`.
  - Adicionar o botão dentro de `SortableLesson`, passando `lessonId` e `currentVideoUid`.
- `src/locales/ja/common.json` e `src/locales/en/common.json`
  - Chaves novas em `admin.lessons_`: `attachVideo`, `changeVideo`, `detach`, `noVideosReady`, `goToVideos`, `searchVideos`, `attached`, `attachedTo`.

## Fora de escopo
- Upload de vídeo direto dentro do Currículo (permanece em `/admin/videos`).
- Alterações em server functions ou schema — `setLessonVideo` e `listStreamVideos` já cobrem o caso.
