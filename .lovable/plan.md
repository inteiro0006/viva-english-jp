## Objetivo
Conceder a role `admin` ao usuário `andre.montrezollo@gmail.com` para liberar acesso a `/admin`.

## Pré-requisito
O e-mail já precisa estar cadastrado em `/register` (o trigger `handle_new_user` cria a linha em `auth.users` e a role `student` por padrão). Se ainda não estiver, cadastre antes de aprovar o plano.

## Ação
Executar um único INSERT idempotente em `public.user_roles`, resolvendo o `user_id` a partir de `auth.users.email`:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'andre.montrezollo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

- Mantém a role `student` existente (roles são aditivas).
- `ON CONFLICT` torna a operação segura para re-execução.
- Se o e-mail não existir em `auth.users`, o INSERT afeta 0 linhas — nesse caso, cadastre-se primeiro e reaplique.

## Como acessar depois
1. Faça logout se estiver em sessão antiga.
2. Entre em `/login` com esse e-mail.
3. O `LoginPage` detecta a role `admin` e redireciona para `/admin`. O `beforeLoad` de `/admin` revalida via `has_role()` no servidor.

## Verificação
Após aplicar, um SELECT confirma a role:

```sql
SELECT u.email, r.role
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
WHERE u.email = 'andre.montrezollo@gmail.com';
```

Nenhum código de aplicação será alterado — apenas dados em `public.user_roles`.