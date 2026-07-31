# Ascent English

Atue como uma equipe sênior composta por arquiteto de software, especialista em React, TypeScript, Supabase, UI/UX, CRO, segurança, acessibilidade e desenvolvimento de plataformas LMS.

Vamos construir uma plataforma comercial de venda de curso de inglês online para o público japonês.

IMPORTANTE:

1. Analise as duas imagens anexadas:

   - Print01 Landpage: referência estrutural da página de vendas.

   - Print02 Dashboard: referência estrutural da área do aluno.

2. Não copie nomes, marcas, logotipos, textos, imagens, fotografias ou elementos proprietários das referências.

3. Use as imagens somente como referência de:

   - hierarquia;

   - organização;

   - distribuição das seções;

   - fluxo do usuário;

   - cards de módulos;

   - navegação;

   - destaque do curso;

   - apresentação do progresso.

4. Crie uma identidade visual original, premium, moderna e adequada ao mercado japonês.

OBJETIVO PRINCIPAL

Criar um site completo que:

- venda um curso de inglês online por pagamento único;

- tenha landing page de alta conversão;

- permita cadastro e login;

- utilize Supabase;

- libere o curso somente para alunos autorizados;

- tenha dashboard do aluno;

- organize aulas em cursos, etapas, módulos e lições;

- utilize vídeos do Cloudflare Stream;

- salve o progresso do aluno;

- possua painel administrativo;

- funcione em japonês e inglês;

- seja totalmente responsivo.

TECNOLOGIAS

Utilize:

- React;

- TypeScript;

- Vite;

- Tailwind CSS;

- shadcn/ui;

- Lucide Icons;

- TanStack Query;

- React Hook Form;

- Zod;

- Supabase Auth;

- Supabase PostgreSQL;

- Supabase Edge Functions;

- Supabase Row Level Security;

- i18next ou solução equivalente;

- Cloudflare Stream;

- Stripe Checkout para pagamento único.

IDIOMAS

- Idioma padrão: japonês.

- Idioma secundário: inglês.

- Adicione um seletor visível “日本語 / English”.

- Todo texto da interface deve utilizar arquivos de tradução.

- Não deixe textos escritos diretamente dentro dos componentes.

- Salve a preferência de idioma do usuário.

- O atributo lang do HTML deve mudar automaticamente.

- O conteúdo não pode misturar japonês e inglês na mesma tela.

ROTAS PÚBLICAS

- /

- /course

- /pricing

- /login

- /register

- /forgot-password

- /reset-password

- /checkout

- /payment/success

- /payment/cancel

- /terms

- /privacy

ROTAS PROTEGIDAS DO ALUNO

- /student/dashboard

- /student/course/:courseSlug

- /student/lesson/:lessonId

- /student/profile

- /student/support

ROTAS PROTEGIDAS DO ADMINISTRADOR

- /admin

- /admin/courses

- /admin/courses/:courseId

- /admin/modules

- /admin/lessons

- /admin/videos

- /admin/students

- /admin/orders

- /admin/settings

PERFIS DE USUÁRIO

Implemente os seguintes papéis:

- student;

- admin.

Não confie somente no frontend para validar permissões. As permissões devem ser aplicadas no Supabase e nas políticas RLS.

DESIGN SYSTEM

Crie um design system original com:

- aparência premium;

- alto contraste;

- bastante espaço em branco;

- tipografia legível em japonês;

- grid consistente;

- bordas suaves;

- sombras discretas;

- animações curtas;

- microinterações;

- feedback visual;

- skeleton loaders;

- empty states;

- estados de erro;

- estados de sucesso;

- botões com áreas de toque adequadas.

Use uma paleta inspirada nestas cores institucionais:

- verde principal: #008061;

- laranja de destaque: #F5821F;

- vermelho de urgência: #ED1B2D;

- azul-petróleo complementar;

- fundos claros e neutros.

O vermelho deve ser usado com moderação para urgência, erro ou destaque comercial.

REQUISITOS DE QUALIDADE

- Não crie telas apenas decorativas.

- Não utilize dados importantes fixos no código.

- Não simule integrações como se estivessem funcionando.

- Não exponha chaves secretas.

- Não coloque tokens do Cloudflare ou Stripe no frontend.

- Não quebre funcionalidades existentes durante as próximas etapas.

- Crie componentes reutilizáveis.

- Separe interface, regras de negócio, serviços e acesso a dados.

- Implemente tratamento consistente de loading, erro e sucesso.

- Garanta responsividade desde o início.

- Utilize HTML semântico.

- Considere WCAG 2.1 AA.

- Não utilize Lorem Ipsum.

- Escreva conteúdo provisório realista em japonês e inglês.

Nesta etapa, crie:

1. estrutura de pastas;

2. configuração de rotas;

3. providers globais;

4. sistema de idiomas;

5. tema visual;

6. layout público;

7. layout do aluno;

8. layout administrativo;

9. componentes base;

10. páginas placeholder funcionais para todas as rotas;

11. documentação interna resumida da arquitetura.

Não implemente ainda pagamento, Cloudflare Stream ou banco completo. Apenas prepare a arquitetura corretamente para as próximas etapas.

Ao finalizar:

- apresente os arquivos criados;

- informe as decisões técnicas;

- informe o que ainda é placeholder;

- liste as variáveis de ambiente que serão necessárias;

- não avance para outra etapa sem concluir esta.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://viva-english-jp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f586199b-0de2-4cf4-9589-61f2d888703f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
