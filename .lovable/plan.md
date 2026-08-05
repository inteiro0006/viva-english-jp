# Usar o produto `prod_UrvECb4YU3LiDg` no checkout do Eigo Academy

## Situação atual (verificada)

- O checkout **não usa IDs de produto do Stripe**. Ele resolve o preço pela *lookup key* `eigo_academy_onetime` (`COURSE_PRICE_LOOKUP_KEY` em `src/lib/payments/payments.config.server.ts`) e valida: preço ativo, tipo `one_time`, moeda `jpy`, valor > 0. O produto vem do preço, não o contrário.
- O ambiente de pagamento é resolvido só por configuração de servidor. Hoje `PAYMENTS_ENVIRONMENT` **não está definido** e `STRIPE_LIVE_API_KEY` **não existe** — foi exatamente isso que causou o erro `not_configured` no checkout.
- O go-live do Stripe está **incompleto**: o passo 1 (vincular a conta) ainda está em andamento, e os passos seguintes (formulário de go-live, instalar o app Lovable na conta LIVE, criação das chaves live) estão bloqueados. Sem isso, não há chaves live e o modo live não pode funcionar.
- O token publicável no build atual é `pk_test_...` (sandbox); há uma checagem que rejeita o checkout se o token do navegador não combinar com o ambiente do servidor.

## Consequência prática

Não é possível "apontar" o checkout para `prod_UrvECb4YU3LiDg` em live agora: o projeto ainda não tem acesso à conta live do Stripe. Primeiro é preciso concluir o go-live; só depois o produto/preço live fica acessível.

## Plano

### Fase 1 — Concluir o go-live (você, na aba Payments)
1. Vincular a conta Stripe (passo 1).
2. Preencher o formulário de go-live no Stripe.
3. Instalar o app Lovable na conta **LIVE**.
4. As chaves live (`STRIPE_LIVE_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET`) e o webhook live são criados automaticamente.

### Fase 2 — Ligar o produto ao checkout
5. Garantir que o produto `prod_UrvECb4YU3LiDg` tenha um **preço ativo, único (one_time), em JPY**, com a *lookup key* `eigo_academy_onetime`. Se ele já tiver um preço com outra lookup key, duas opções:
   - (preferida) usar `eigo_academy_onetime` no preço desse produto; ou
   - alterar `COURSE_PRICE_LOOKUP_KEY` no código para a lookup key existente.
6. Confirmar que o valor do preço é ¥49.800 (bate com `COURSE_PRICE_JPY` usado nas páginas de marketing). Se for diferente, ajustar `src/config/site.ts` para não haver divergência de exibição.

### Fase 3 — Ativar o ambiente live
7. Definir `PAYMENTS_ENVIRONMENT=live`.
8. Garantir `VITE_PAYMENTS_CLIENT_TOKEN` com `pk_live_...` no build publicado (o `pk_test_` continua no ambiente de desenvolvimento).
9. Definir `SITE_URL` (e, se necessário, `CHECKOUT_ALLOWED_ORIGINS`) para que a URL de retorno pós-pagamento aponte para o domínio publicado.

### Fase 4 — Verificação
10. Abrir `/checkout` no site publicado e confirmar: o formulário monta, o preço exibido vem do Stripe (via `getCoursePrice`) e não aparece o banner de modo de teste.
11. Confirmar nos logs do servidor que não há `not_configured` nem `price_unavailable`.
12. Fazer uma compra real de valor mínimo (ou usar a leitura do preço + webhook) para confirmar que o pedido vira `paid` e a matrícula é liberada.

## Notas técnicas

- Arquivos possivelmente tocados: `src/lib/payments/payments.config.server.ts` (lookup key, se necessário), `src/config/site.ts` (preço de exibição). Nenhuma mudança de esquema, RLS ou lógica de cobrança.
- O ID `prod_UrvECb4YU3LiDg` não é gravado no código — o vínculo se dá pela lookup key do preço, o que mantém sandbox e live consistentes.
- Enquanto o go-live não terminar, o preview continua em sandbox (`pk_test_`), que é o comportamento correto.
