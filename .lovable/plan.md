## Diagnóstico

Verifiquei a conta `andre.montrezollo@gmail.com` no backend:

- Usuário existe (`id: bf7f06a3-…`)
- E-mail já confirmado em 24/07
- Conta **não** está banida/bloqueada
- Tem senha cadastrada (`encrypted_password` presente)
- **Último login bem-sucedido: 29/07 01:19 UTC** — cerca de 10 minutos antes da tentativa que falhou (01:30 UTC)

A resposta do backend na tentativa que falhou foi `400 invalid_credentials`. Como a conta está ativa, confirmada e teve login recente com sucesso, o único motivo para esse erro específico é **senha digitada não confere com o hash salvo**. Possíveis causas:

1. A senha foi digitada com um caractere diferente (a que você compartilhou começa e termina com `*` — se esses `*` fizerem parte da senha real, ok; se foram só marcadores de "senha secreta" na sua mensagem, a senha real é diferente).
2. Layout de teclado / Caps Lock / auto-preenchimento do navegador colocou um valor antigo.
3. A senha foi trocada em outra sessão/dispositivo depois desse último login de 01:19.

Não é problema de código da plataforma — o fluxo de login está funcionando (você mesmo entrou com sucesso 10 min antes) e nenhuma outra conta está reclamando.

## O que fazer agora

Duas opções, você escolhe:

### Opção A — Reset de senha pelo fluxo público (recomendado)
1. Abrir `/forgot-password`
2. Informar `andre.montrezollo@gmail.com`
3. Clicar no link recebido por e-mail → cai em `/reset-password` → definir nova senha
4. Voltar em `/login`

Esse fluxo já está implementado e testado na plataforma.

### Opção B — Definir uma senha nova direto pelo admin (sem e-mail)
Se preferir não depender do e-mail, eu posso, após você aprovar este plano:

- Usar o cliente admin do backend (`supabaseAdmin.auth.admin.updateUserById`) para setar uma nova senha que você me indicar (ex.: `TempSenha!2026`), apenas para essa conta.
- Você faz login com ela e troca em `/student/profile` (ou eu adiciono uma tela de troca de senha se ainda não houver).
- Registrar a ação em `admin_audit_logs` para rastreabilidade.

Nenhuma alteração de código de produto é necessária — é uma ação pontual de operação.

## Detalhes técnicos

- Endpoint que falhou: `POST /auth/v1/token?grant_type=password` → `{"code":"invalid_credentials"}`.
- `auth.users` para esse e-mail: `email_confirmed_at` preenchido, `banned_until` nulo, `last_sign_in_at = 2026-07-29 01:19:16Z`.
- Nenhuma mudança em RLS, políticas ou schema é necessária.

Qual opção prefere: **A (reset por e-mail)** ou **B (eu redefino a senha via admin agora)**? Se for B, me diga qual senha temporária usar.
