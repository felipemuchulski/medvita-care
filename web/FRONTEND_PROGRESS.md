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

## 2026-11-06 — Módulo de agendamentos

### Implementação e arquivos

- Nova feature em `src/features/appointments/`: tipos de Appointment, API, hooks de consulta/mutação, regras de permissão, conversão de datas e testes.
- Componentes `AppointmentForm`, `AppointmentStatusBadge`, `PatientSelector`, `ProfessionalSelector` e `CancelAppointmentDialog`.
- `pages/AppointmentsPage.tsx` reúne listagem, cadastro, detalhes e reagendamento, com rotas registradas em `src/App.tsx`.
- Listagem com paginação real, filtros por paciente, profissional, status e intervalo inclusivo de datas. Busca de pacientes por nome/CPF com submissão explícita e páginas de dez registros; nenhuma busca textual inventada para agendamentos.
- Cards como visualização base, tabela a partir de 1024px, campos em uma coluna e expansão progressiva. Controles com altura mínima de 44px, tabela de colunas fixas, textos longos quebráveis, diálogo nativo com foco, Escape, restauração do foco e rolagem vertical.
- Cadastro com paciente ativo, profissional autorizado, data futura com offset explícito, duração inteira de 5–480 minutos, motivo até 500 e observações até 1000 caracteres.
- Cancelamento exige motivo de 3–500 caracteres, confirmação e proteção contra envio duplicado. Reagendamento só altera data/horário e duração. Ambos bloqueados para status diferentes de SCHEDULED/CONFIRMED e atendimento vinculado.
- Feedback de sucesso, erros de autorização, conflitos HTTP 409, rede, carregamento, listas vazias e repetição de consultas.

### Endpoints integrados

Prefixo `/clinics/:clinicId`:
- `GET /appointments` e `GET /appointments/:id`.
- `POST /appointments`.
- `PATCH /appointments/:id/reschedule` e `PATCH /appointments/:id/cancel`.
- `GET /patients` (busca e paginação) e `GET /professionals` (lista real).

### Permissões, cache e isolamento

- ADMIN e RECEPTIONIST gerenciam; OPHTHALMOLOGIST consulta conforme escopo imposto pelo servidor. isSystemAdmin não concede acesso automático.
- Entrada exige clínica ativa e papel; chaves de consultas contêm clínica; não se reutilizam dados anteriores entre clínicas como placeholder. Tela e formulários remontam na troca de clínica/papel. Respostas de agendamentos são verificadas contra a clínica ativa.
- Reutiliza limpeza do cache existente na troca de clínica e logout. Dados somente em memória, sem persistência ou logs de informações pessoais.
- Alterações invalidam listagem e detalhes. Hooks e API disponíveis para futura integração de calendário; `/calendario` permanece módulo separado provisório.

### Datas e divergências do back-end (somente leitura)

- API usa timestamptz e exige ISO 8601 com offset ou Z; conflitos consideram sobreposição de horários do profissional inclusive entre clínicas, sem revelar dados externos.
- Não foi encontrada configuração de timezone clínico. A interface adota explicitamente UTC−03:00 nas listagens e detalhes, e permite escolher offset no formulário (UTC−05, −04, −03, −02 ou UTC). Não usa timezone implícito do navegador.
- Essa é uma convenção operacional do front-end, não um timezone cadastrado da clínica. Offsets fixos não modelam horário de verão. Confirmar o offset na operação; evolução recomendada: timezone IANA por clínica, retornado pela API.
- Profissionais não possui busca/paginação no contrato; uma consulta cacheada retorna a lista autorizada completa. Não foi inventada paginação no servidor. Para clínicas com muitos profissionais, adicionar contrato paginado no futuro.
- A API é a autoridade final sobre conflitos e transições; disponibilidade não é presumida no cliente. Endpoint de disponibilidade analisado, mas não necessário para salvar.

### Verificação e limitações

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo TypeScript (`tsc -b`).
- `npm test`: 9 arquivos, 28 testes aprovados. Novos testes cobrem contratos de listagem/filtros, criação, reagendamento, cancelamento, chaves isoladas, permissões, transições, mensagens de conflito e conversão de datas com mudança de dia.
- Não existem navegador conectado, Playwright ou Puppeteer disponíveis nesta execução. As regras responsivas foram revisadas em código; NÃO houve validação visual em 320, 375, 390, 768, 1024 ou 1440px, nem zoom 200% ou navegação por teclado em navegador. Essas validações seguem pendentes para homologação.
- Não houve teste ponta a ponta contra API/PostgreSQL reais: faltam sessão/credenciais de homologação. Testes HTTP usam spies, não comprovam persistência real. Carregamento/erros de UI, troca de clínica durante requisições e fluxo de formulários requerem testes de navegador.
- Backend permaneceu sem alterações desta tarefa. Alterações locais prévias em ambos package-lock.json e `RELATORIO_FRONTEND.md` preservadas.

### Próximos passos

Homologar os fluxos com API real e testes de navegador nas seis larguras, zoom e teclado; depois integrar o calendário usando a mesma feature. Evoluir contrato de timezone e paginação de profissionais em tarefa própria de backend.

## 2026-11-06 — Remoção dos arquivos de testes

- A pedido do usuário, removidos os nove arquivos `*.test.ts` do repositório, incluindo os testes de agendamentos.
- Resultados de testes registrados acima são históricos, anteriores à remoção.
- Código da aplicação, dependências e configuração das ferramentas de testes preservados.
