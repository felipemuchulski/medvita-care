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

## 2026-11-03 — Clínica ativa mínima e módulo de pacientes

### Funcionalidades implementadas

- Carregamento dos vínculos do usuário autenticado e interseção com os papéis ativos devolvidos no login.
- Seleção automática quando existe uma única clínica e seletor acessível quando existem várias.
- Bloqueio de acesso clínico para administrador global sem vínculo ativo.
- Limpeza de caches clínicos ao trocar de clínica, sem persistência no navegador.
- Listagem de pacientes com busca por nome/CPF, filtro de status e paginação.
- Visualizações responsivas em cartões no mobile e tabela no desktop.
- Cadastro e edição com validação por campo, CPF, nascimento, e-mail, CEP e UF.
- Normalização de CPF, CEP, e-mail, campos opcionais e UF antes do envio.
- Detalhes cadastrais com ações condicionadas ao papel.
- Ativação e desativação com confirmação, exclusiva para `ADMIN`.
- Estados de carregamento, erro, lista vazia e feedback de sucesso.
- Área reservada para histórico clínico sem dados simulados.

### Arquivos criados

- `src/contexts/clinic-context.ts`
- `src/contexts/ClinicProvider.tsx`
- `src/hooks/use-clinic.ts`
- `src/features/clinics/api/clinics-api.ts`
- `src/features/clinics/lib/allowed-memberships.ts`
- `src/features/clinics/lib/allowed-memberships.test.ts`
- `src/features/clinics/types/clinic.ts`
- `src/features/patients/api/patients-api.ts`
- `src/features/patients/api/patients-api.test.ts`
- `src/features/patients/components/PatientForm.tsx`
- `src/features/patients/components/PatientStatusBadge.tsx`
- `src/features/patients/components/PatientsUnavailable.tsx`
- `src/features/patients/hooks/use-patients.ts`
- `src/features/patients/lib/patient-format.ts`
- `src/features/patients/lib/patient-permissions.ts`
- `src/features/patients/lib/patient-permissions.test.ts`
- `src/features/patients/lib/patient-schema.ts`
- `src/features/patients/lib/patient-schema.test.ts`
- `src/features/patients/pages/PatientsPage.tsx`
- `src/features/patients/pages/CreatePatientPage.tsx`
- `src/features/patients/pages/EditPatientPage.tsx`
- `src/features/patients/pages/PatientDetailsPage.tsx`
- Dependências adicionadas: React Hook Form, Zod e `@hookform/resolvers`.

### Arquivos modificados

- `package.json`
- `package-lock.json`
- `src/main.tsx`
- `src/App.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`

### Endpoints integrados

- `GET /users/:userId/clinics`
- `GET /clinics/:clinicId/patients`
- `POST /clinics/:clinicId/patients`
- `GET /clinics/:clinicId/patients/:id`
- `PATCH /clinics/:clinicId/patients/:id`
- `PATCH /clinics/:clinicId/patients/:id/active`

### Permissões aplicadas

- `ADMIN`: consulta, cadastro, edição e alteração de status.
- `RECEPTIONIST`: consulta, cadastro e edição; sem alteração de status.
- `OPHTHALMOLOGIST`: somente consulta.
- `isSystemAdmin`: não recebe acesso a pacientes sem vínculo clínico ativo.

### Decisões arquiteturais

- Todas as query keys de pacientes incluem `clinicId`.
- A clínica escolhida permanece apenas em memória e é validada contra vínculo, clínica e papel ativos.
- CPF e demais dados pessoais não são persistidos fora do cache em memória.
- O formulário de cadastro e edição é compartilhado, mas as mutations e rotas permanecem explícitas.
- Erros de CPF retornados pelo servidor são associados ao campo de CPF; demais erros usam feedback geral seguro.

### Validações e testes

- `npm.cmd test`: 6 arquivos e 16 testes aprovados.
- `npm.cmd run lint`: aprovado sem erros ou avisos.
- `npx.cmd tsc --noEmit -p tsconfig.app.json`: aprovado.
- `npm.cmd run build`: aprovado com 2.187 módulos transformados.
- Testes cobrem permissões, validação/normalização, isolamento de vínculos e contratos HTTP de pacientes.

### Problemas e limitações

- A fundação de clínica ativa mencionada no pedido ainda não existia na branch e precisou ser implementada no escopo mínimo necessário.
- Não houve teste E2E com API/PostgreSQL por ausência de credenciais e ambiente homologado nesta execução.
- O histórico clínico depende da futura integração do EncountersModule e permanece apenas como organização visual informativa.
- A instalação continua reportando 12 vulnerabilidades moderadas no grafo npm, sem correção automática potencialmente incompatível.

### Próxima etapa recomendada

Homologar o fluxo de pacientes contra a API e PostgreSQL reais. Depois disso, avançar para profissionais ou agenda sem alterar o módulo de pacientes já validado estaticamente.
