# MedVita Care — Progresso do front-end

Este arquivo registra as etapas cumulativas do desenvolvimento. O histórico não deve ser apagado ao adicionar novas etapas.

## 2026-11-03 — Etapa 1: integração HTTP

### Funcionalidades implementadas

- Cliente HTTP tipado baseado em `fetch`, com operações GET, POST, PATCH e DELETE.
- Serialização JSON, query parameters, `AbortSignal` e respostas sem conteúdo.
- Inclusão opcional de access token por `Authorization: Bearer`.
- Normalização de erros HTTP, falhas de conexão e cancelamentos.
- Proteção contra exibição de mensagens internas em respostas `5xx`.
- Ponte de autenticação preparada para refresh single-flight e uma única repetição após `401`.
- Proxy de desenvolvimento `/api` para a API NestJS.
- TanStack Query configurado com cache apenas em memória e sem refetch automático ao focar a janela.

### Arquivos criados

- `.env.example`
- `src/vite-env.d.ts`
- `src/api/api-error.ts`
- `src/api/http-client.ts`
- `src/api/http-client.test.ts`
- `src/lib/query-client.ts`
- `FRONTEND_PROGRESS.md`

### Arquivos modificados

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `src/main.tsx`

### Endpoints integrados

Nenhum endpoint de negócio foi conectado a uma tela nesta etapa. A infraestrutura está pronta para iniciar por `POST /auth/login` na Etapa 2.

### Decisões arquiteturais

- `VITE_API_URL` usa `/api` por padrão, e o Vite remove esse prefixo ao encaminhar ao NestJS local.
- O cliente não persiste tokens nem dados clínicos.
- A integração de refresh fica atrás de callbacks configuráveis para que a Etapa 2 controle a sessão sem acoplar o cliente HTTP ao React.
- Requisições `5xx` usam mensagens genéricas, evitando exposição acidental de stack traces ou segredos.
- Consultas podem repetir somente uma falha de rede ou servidor; mutations não são repetidas automaticamente.

### Validações e testes

- `npm.cmd test`: 1 arquivo e 5 testes aprovados.
- `npm.cmd run lint`: aprovado sem erros ou avisos.
- `npx.cmd tsc --noEmit -p tsconfig.app.json`: aprovado.
- `npm.cmd run build`: aprovado com 2.064 módulos transformados.
- Os testes unitários cobrem serialização, autenticação, erros `400`, proteção de `5xx`, falha de rede e refresh concorrente.

### Problemas e dependências

- O contrato atual devolve o refresh token no JSON. Uma sessão persistente com cookie `HttpOnly` depende de alteração futura no back-end.
- O proxy resolve o desenvolvimento local. Em produção, deve-se definir `VITE_API_URL` ou publicar web e API atrás do mesmo gateway.
- A instalação de dependências reportou 12 vulnerabilidades moderadas no grafo npm; é necessário revisar com `npm audit` antes do deploy, sem aplicar correções incompatíveis automaticamente.

### Funcionalidades pendentes

- Login, refresh, logout, recuperação e limpeza da sessão.
- Rotas protegidas.
- Clínica ativa e autorização por papel.
- Todos os módulos de negócio.

### Próxima etapa recomendada

Etapa 2: integrar `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` e `PATCH /auth/change-password`, mantendo access token em memória e documentando a limitação do refresh token atual.

## 2026-11-03 — Etapa 2: autenticação

### Funcionalidades implementadas

- Login real utilizando a tela responsiva existente.
- Sessão com access token, refresh token e usuário mantidos exclusivamente em memória.
- Refresh automático single-flight após `401`, com apenas uma repetição da requisição original.
- Logout remoto com limpeza local garantida mesmo se a API estiver indisponível.
- Limpeza do cache do TanStack Query ao encerrar ou invalidar a sessão.
- Rotas públicas e protegidas, incluindo retorno à rota originalmente solicitada após o login.
- Redirecionamento automático para login quando a sessão é inválida ou revogada.
- Troca de senha com confirmação local e encerramento da sessão após sucesso.
- Ações acessíveis de troca de senha e logout no header, adequadas para mobile.

### Arquivos criados

- `src/contexts/auth-context.ts`
- `src/contexts/AuthProvider.tsx`
- `src/hooks/use-auth.ts`
- `src/features/auth/api/auth-api.ts`
- `src/features/auth/api/auth-api.test.ts`
- `src/features/auth/types/auth.ts`
- `src/features/auth/routes/ProtectedRoute.tsx`
- `src/features/auth/routes/PublicOnlyRoute.tsx`
- `src/features/auth/pages/ChangePasswordPage.tsx`

### Arquivos modificados

- `src/main.tsx`
- `src/App.tsx`
- `src/features/auth/pages/LoginPage.tsx`
- `src/components/layout/Header.tsx`

### Endpoints integrados

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `PATCH /auth/change-password`

### Decisões arquiteturais

- Nenhum token é gravado em `localStorage`, `sessionStorage`, IndexedDB ou URL.
- Recarregar a aplicação encerra a sessão local. Persistência segura depende de o back-end migrar o refresh token para cookie `HttpOnly`, `Secure` e `SameSite` adequado.
- Login e refresh são requisições públicas; logout e troca de senha recebem o access token automaticamente.
- O provider de autenticação não conhece rotas nem navegação, mantendo a infraestrutura reutilizável e testável.

### Validações e testes

- `npm.cmd test`: 2 arquivos e 7 testes aprovados.
- `npm.cmd run lint`: aprovado sem erros ou avisos.
- `npx.cmd tsc --noEmit -p tsconfig.app.json`: aprovado.
- `npm.cmd run build`: aprovado com 2.072 módulos transformados.
- Foram validados os contratos públicos de login/refresh e o contrato autenticado de logout.

### Problemas e dependências

- Não foi realizado login end-to-end porque não há, nesta execução, credenciais nem ambiente PostgreSQL homologado fornecidos para o teste.
- O contrato JSON do refresh token impede recuperação persistente segura após recarregar a página.
- A API continua dependendo do proxy em desenvolvimento ou de configuração CORS/gateway em produção.

### Funcionalidades pendentes

- Clínica ativa e consulta dos vínculos do usuário.
- Regras reutilizáveis de autorização e menu por papel.
- Testes de componentes no DOM e fluxo E2E com API real.
- Módulos de negócio.

### Próxima etapa recomendada

Etapa 3: carregar `GET /users/:userId/clinics`, selecionar somente vínculos ativos autorizados, apresentar a clínica no layout e limpar o cache ao trocar de contexto.
