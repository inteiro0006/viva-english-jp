## Objetivo

Descobrir por que as alterações feitas no Lovable não estão aparecendo no repositório do GitHub e restabelecer a sincronização automática.

## Verificações (na ordem)

1. **Branch correta**: o Lovable envia os commits para a branch padrão do repositório (normalmente `main`). Se você está olhando outra branch no GitHub, os commits existem mas não aparecem. Conferir a branch selecionada na página do repositório e o histórico de commits recentes.
2. **Repositório certo**: no menu **+** → **GitHub**, confirmar qual conta/organização e qual repositório estão vinculados a este projeto. Uma conta GitHub por conta Lovable — se você trocou de conta, o vínculo pode ter quebrado.
3. **Autorização do app**: em GitHub → Settings → Applications → Installed GitHub Apps → **Lovable**, verificar se o app ainda tem acesso ao repositório (acessos por repositório específico costumam perder o repo novo).
4. **Reconectar**: se algum dos itens acima estiver errado, desconectar e reconectar o projeto pelo menu **+** → **GitHub**, o que dispara um novo push completo do código atual.
5. **Confirmar conteúdo**: depois de sincronizar, checar no GitHub arquivos alterados recentemente por mim, por exemplo `src/lib/admin/students.admin.functions.ts` e `src/routes/admin.students.tsx` (correção da exclusão de conta), e comparar com o que está no editor de código do Lovable.

## Alternativa imediata

Se você precisa do código agora, sem esperar a sincronização: abrir o **Code Editor** no Lovable e usar **Download codebase** no rodapé da árvore de arquivos.

## Observações técnicas

Não há ação de código a executar do meu lado: a sincronização é feita pela plataforma, não por comandos git dentro do projeto (operações git são gerenciadas internamente e eu não posso rodar `push`/`commit`). Este plano é uma sequência de checagens na interface. Se após o passo 4 o repositório continuar desatualizado, o caso é de suporte da plataforma — nesse ponto eu ajudo a reunir as evidências (nome do repo, branch, último commit visível, data da última alteração no Lovable).
