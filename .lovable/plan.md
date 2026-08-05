# O erro no checkout: "not_configured"

## O que aconteceu

Na sua última tentativa em `/checkout`, a chamada ao servidor que cria a sessão de pagamento respondeu:

```text
{"error":"not_configured"}
```

Ou seja: o formulário de pagamento não conseguiu carregar porque o servidor considera o Stripe **não configurado** neste ambiente (preview publicado).

## Causa

A resolução do ambiente de pagamento (`resolvePaymentEnvironment`) segue estas regras:

1. Se `PAYMENTS_ENVIRONMENT` estiver definido (`sandbox` ou `live`), usa esse valor.
2. Em produção (que é como o build de preview/publicado roda), **sem** `PAYMENTS_ENVIRONMENT` ela lança erro de propósito — nunca infere `live`.
3. Só em desenvolvimento ela cai para `sandbox` quando existe `STRIPE_SANDBOX_API_KEY`.

No projeto hoje: `STRIPE_SANDBOX_API_KEY` está definido, mas `PAYMENTS_ENVIRONMENT` **não está**. Por isso funciona no sandbox local e falha no ambiente publicado, com o erro genérico `not_configured` (o motivo real fica só no log do servidor).

Um segundo ponto relacionado: a chave publicável do navegador (`VITE_PAYMENTS_CLIENT_TOKEN`) existe apenas em `.env.development`; ela precisa estar presente no build publicado, senão a página mostra a mensagem de "pagamentos não configurados".

## Correção proposta

1. Definir o secret `PAYMENTS_ENVIRONMENT=sandbox` (para continuar validando compras de teste) ou `live` quando você quiser cobrar de verdade.
2. Garantir `VITE_PAYMENTS_CLIENT_TOKEN` no ambiente publicado, com a chave `pk_test_...` para sandbox ou `pk_live_...` para live (elas precisam combinar com o ambiente do item 1 — há uma checagem que rejeita mistura).
3. Para `live`, adicionar também `STRIPE_LIVE_API_KEY` e `PAYMENTS_LIVE_WEBHOOK_SECRET`.
4. Melhorar o diagnóstico: quando o motivo for configuração ausente, exibir na página uma mensagem específica ("pagamentos indisponíveis neste ambiente") em vez do erro genérico, e registrar no log qual variável faltou.
5. Verificar depois: abrir `/checkout` no preview e confirmar que o formulário do Stripe monta e que o log não traz mais `not_configured`.

## Notas técnicas

- Arquivos envolvidos: `src/lib/payments/payments.config.server.ts` (regras de ambiente), `src/lib/payments/checkout.server.ts` (retorno `not_configured`), `src/routes/checkout.tsx` (mensagem ao usuário).
- Nada de mudança em banco, RLS ou lógica de cobrança — apenas configuração de ambiente e mensagem de erro.
- Aviso do console sobre `hreflang` já foi corrigido no código; ele aparece porque o build do preview aberto ainda é o antigo.

## Pergunta

Qual ambiente você quer ativar no preview: **sandbox** (teste) ou **live** (cobrança real)?
