## Situação atual

Hoje o painel `/admin/courses` **não tem botão para excluir cursos**. Só existe exclusão de módulos e aulas dentro do curso. Por isso o curso "English" que você criou continua aparecendo na lista sem forma de removê-lo pela UI.

Existem dois caminhos — posso fazer os dois, mas normalmente um resolve:

### Opção A — Exclusão imediata via SQL (rápido, 1 curso)
Rodo uma migração que apaga o curso "English" (id `90b2d71c-...`) e tudo que depende dele (stages, módulos, lições, matrículas, progresso). Como as tabelas foram criadas com `ON DELETE CASCADE`, um `DELETE FROM public.courses WHERE id = ...` já limpa o resto.

Ideal se você só quer se livrar desse curso de teste agora.

### Opção B — Botão "Excluir curso" no admin (permanente)
Implemento no painel para qualquer curso futuro:

1. **Server function** `deleteCourse` em `src/lib/admin/courses.admin.functions.ts`
   - Protegida por `assertAdmin`
   - Regra de segurança: bloqueia exclusão se o curso tiver **matrículas pagas** (`enrollments` com `order` confirmado). Nesse caso sugere arquivar (`status = 'archived'`) em vez de excluir — evita apagar histórico de alunos pagantes.
   - Registra a ação em `admin_audit_logs` (quem excluiu, snapshot do curso).
2. **UI em `/admin/courses/:courseId`** (página de edição)
   - Botão "Excluir curso" em zona de perigo no rodapé
   - `AlertDialog` do shadcn pedindo para digitar o slug do curso para confirmar
   - Toast de sucesso + redirect para `/admin/courses`
3. **i18n** — textos em JA/EN nos arquivos de locale do admin.

### Recomendação
Fazer as **duas**: A resolve o curso "English" agora, B previne o problema para sempre.

Me diga qual seguir (A, B, ou ambas) que eu implemento.
