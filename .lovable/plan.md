## Objetivo

Validar, ponta a ponta, que uma compra concluída no Stripe cria automaticamente a matrícula do aluno e libera o curso — sem alterar regras de negócio.

## Estado atual confirmado

- Backend: Lovable Cloud (sem conta Supabase externa). Projeto ativo, 3 usuários.
- `orders`: 3 registros, todos `pending`; `paid` = 0.
- `payment_events`: 0 registros — nenhum webhook do Stripe chegou ao app até agora.
- `enrollments`: 1 ativa (inteiro0002), concedida manualmente, sem pedido pago associado.

Ou seja: o caminho pagamento → webhook → matrícula nunca foi exercitado com dados reais.

## Passos do teste

1. **Preparar sessão de teste**
   Autenticar como um aluno sem matrícula ativa (kiharagames ou o admin) usando a sessão do preview e abrir `/checkout`.

2. **Executar o checkout embutido**
   Preencher o formulário do Stripe com o cartão de teste `4242 4242 4242 4242` (validade futura, CVC qualquer) e concluir o pagamento. Confirmar o redirecionamento para a página de retorno (`/payment/success`).

3. **Verificar o webhook**
   Consultar `payment_events` para confirmar que o evento `checkout.session.completed` chegou, foi reivindicado (`claim_payment_event`) e finalizou com status `processed` — e não `failed`/`ignored`.

4. **Verificar o pedido**
   Consultar `orders` para o novo pedido: `status = paid`, `total_amount = 49800`, `currency = jpy`, `provider_payment_id` preenchido, `environment = sandbox`.

5. **Verificar a matrícula e o acesso**
   Consultar `enrollments` (esperado `status = active`, `order_id` apontando para o pedido) e confirmar na UI que `/student/dashboard` mostra o curso liberado e os módulos conforme as regras de release.

## Ponto crítico esperado

Pela regra de segurança já implementada, **pagamentos em `sandbox` não liberam acesso** — `fulfill_paid_order` marca o pedido como pago mas não concede matrícula em ambiente sandbox. Portanto o passo 5 provavelmente vai mostrar pedido pago **sem** matrícula. Isso é o comportamento correto, não um bug.

Se for esse o caso, apresento duas opções (sem implementar antes de você escolher):

- **A — Deixar como está**: validação encerra confirmando que o pipeline funciona até o pedido pago; a liberação real só acontece em `live` após o go-live do Stripe.
- **B — Modo de teste controlado**: adicionar uma flag em `platform_settings` (ex.: `payments.sandbox_grants_access`), desligada por padrão, que permite ao admin habilitar temporariamente a liberação em sandbox para validar a experiência completa do aluno. Auditada e sem efeito em produção.

## Detalhes técnicos

- Diagnóstico feito com consultas de leitura (`read_query`) e navegação automatizada no preview (Playwright headless em `localhost:8080`), restaurando a sessão gerenciada do preview.
- Nenhuma migration é necessária para o teste em si; a opção B, se escolhida, exigiria uma migration para a flag e um ajuste em `fulfill_paid_order` / `grant_enrollment`.
- Nenhuma chave ou segredo será exibido, logado ou capturado em tela.

## Entrega

Relatório com: resultado de cada passo, o registro real de `payment_events`/`orders`/`enrollments` criado, evidência visual do checkout e do dashboard, e recomendação sobre a liberação em sandbox.
