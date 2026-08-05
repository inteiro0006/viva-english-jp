# Sincronizar o projeto com o GitHub

## Situação atual (verificada)

- O único remote configurado neste projeto aponta para o armazenamento interno da Lovable. Não existe remote do GitHub.
- Portanto, **as alterações feitas aqui não estão sendo enviadas para o GitHub hoje** (nem para `inteiro0006/viva-english-jp`). Elas ficam apenas no histórico de versões da Lovable.
- A página Admin → Sistema mostra branch e último commit apenas quando as variáveis `GITHUB_REPOSITORY` (e opcionalmente `GITHUB_TOKEN`) estiverem definidas. Ela lê a API pública do GitHub e não implica que exista sincronização.

## O que fazer para ter tudo no GitHub

1. Você conecta na interface: menu "+" no chat → **GitHub** → **Connect project** → autorizar o Lovable GitHub App → escolher a conta/organização → **Create Repository**.
   - Essa etapa é obrigatoriamente feita por você na UI; não pode ser feita por código.
2. Depois de conectado, a sincronização é bidirecional e automática: cada alteração feita aqui gera commit/push no repositório, e pushes feitos no GitHub voltam para o projeto.
3. Observação: hoje a Lovable não importa um repositório GitHub já existente. Se quiser manter o `viva-english-jp` atual, o caminho é criar o repositório novo pela conexão e depois espelhar/mover o conteúdo manualmente no GitHub.

## Verificação depois da conexão

- Confirmo que o remote do GitHub passou a existir e que o último commit local aparece no repositório.
- Se quiser, defino `GITHUB_REPOSITORY` (e `GITHUB_TOKEN` se o repo for privado) como secrets do projeto para que Admin → Sistema exiba branch, último commit e último push do repositório real.

## Detalhes técnicos

- Nenhuma alteração de código é necessária para a sincronização em si.
- O único trabalho de código possível é opcional: configurar os secrets `GITHUB_REPOSITORY` / `GITHUB_TOKEN` usados por `src/lib/admin/system.functions.ts` para popular o painel Admin → Sistema.
