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

## 2026-11-06 — Calendário integrado aos agendamentos

### Funcionalidades e arquitetura

- `/calendario` substitui a tela provisória, com carregamento sob demanda (React lazy/Suspense), sem dependências novas.
- Agenda diária padrão, navegação por dias/semanas, Hoje, data selecionável e filtros expansíveis por profissional/status. Data, modo e filtros ficam na URL, sem nomes ou dados pessoais; voltar pelo navegador restaura o período.
- Semana em lista diária para smartphones/tablets e grade de horários a partir de 1280px. Em 1024px a lista evita comprimir sete colunas. Botões novos com área mínima de 44×44px e foco visível.
- Grade expande sua faixa conforme os horários e términos retornados: sem corte de expediente. Cartões aparecem na célula da hora de início com início, término e duração explícitos. Eventos simultâneos são empilhados; não há sobreposição absoluta. A altura dos cartões não representa proporcionalmente a duração; não há drag-and-drop.
- Cartões reutilizam status e abrem detalhes existentes, onde são executados reagendamento/cancelamento com autorização. Novo agendamento reutiliza formulário e recebe a data escolhida via estado de navegação, validada e vinculada à clínica.
- Modo mensal não implementado, por ser secundário; seletor nativo de datas permite navegar para outros meses.

### Arquivos criados

- `src/features/calendar/utils/calendar.ts`: datas, semana, agrupamento por dia, horários da grade e consultas atravessando meia-noite.
- `src/features/calendar/hooks/use-calendar-appointments.ts`: consulta do período completo.
- `src/features/calendar/components/CalendarAppointmentCard.tsx` e `CalendarWeekView.tsx`.
- `src/features/calendar/pages/CalendarPage.tsx`: navegação, filtros, visualização diária e estados da interface.
- Testes `utils/calendar.test.ts` e `hooks/use-calendar-appointments.test.ts`, conforme exigência deste novo pedido.

### Arquivos modificados

- `src/App.tsx`: rota e importação lazy do calendário.
- `src/features/appointments/components/AppointmentForm.tsx`: propriedade opcional initialDate.
- `src/features/appointments/pages/AppointmentsPage.tsx`: recebe data do calendário somente para a clínica correspondente.
- `src/features/appointments/lib/appointment.ts`: validação compartilhada de data.
- Este documento. Nenhum arquivo do backend alterado nesta etapa; alterações preexistentes nos lockfiles e relatório foram preservadas.

### API, cache e permissões

- Reutiliza `appointmentsApi.list`: `GET /clinics/:clinicId/appointments`, com from, to, professionalId, status, page e limit=100; `ProfessionalSelector` usa a API de profissionais existente.
- Hook do calendário usa o mesmo prefixo `appointmentKeys.all(clinic)` das mutations: criar/reagendar/cancelar invalida também o calendário. Chave inclui intervalo/filtros; sem placeholder da clínica anterior, cache apenas em memória e limpeza pelos providers existentes.
- Paginação sequencial completa, cancelável por AbortSignal, sem exibir resultados parciais durante carregamento ou falha. Limite de 100 páginas por consulta; exceder o limite gera mensagem pedindo período/filtros mais específicos. Divergência entre total e registros únicos também rejeita o resultado, para evitar apresentar paginação inconsistente como completa.
- Clínica e papel ativos obrigatórios. ADMIN/RECEPTIONIST podem iniciar cadastro; OPHTHALMOLOGIST consulta conforme o escopo imposto pelo servidor. Administrador global não recebe acesso sem vínculo. Respostas com registros de outra clínica são rejeitadas.

### Datas e limitações do contrato

- UTC−03:00 explícito, reutilizando defaultOffset/localInOffset/toIso; não depende do fuso do navegador. Clínica ainda não fornece timezone IANA; permanece a limitação de offset fixo já adotada no sistema.
- Busca inclui o dia anterior ao período para incluir consultas iniciadas antes da meia-noite e ainda em andamento (duração máxima contratual de 480 minutos). Agrupamento usa sobreposição real com cada dia, sem duplicação no mesmo dia.
- Não existe snapshot de paginação no backend; alterações concorrentes podem invalidar o carregamento e exigir nova consulta. Comparação de total evita alguns casos, mas não garante snapshot transacional.
- Endpoint de profissionais retorna lista completa, sem paginação; mesma limitação existente, sem contrato inventado.

### Validação

- `npm test`: 2 arquivos, 13 testes aprovados (datas inválidas/ano bissexto, navegação de dias/semanas/ano, UTC perto da meia-noite, simultaneidade, duração, transbordamento entre dias, permissões, filtros e AbortSignal, múltiplas páginas, falha intermediária, vazio, limite de carregamento, isolamento e invalidação de cache).
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `tsc -b`; calendário separado em chunk próprio para evitar aumentar o pacote inicial acima do aviso de 500kB.
- Não há Playwright, Puppeteer ou navegador conectado disponível nesta sessão. Revisão responsiva feita em código; validação visual em 320, 375, 390, 768, 1024 e 1440px, zoom 200%, teclado, retrato/paisagem e toque permanece PENDENTE.
- Sem credenciais/ambiente homologado fornecidos para executar fluxo completo com API/PostgreSQL. Testes de componentes no navegador, estados de carregamento/erro renderizados e criação/reagendamento/cancelamento ponta a ponta continuam pendentes. Testes automatizados não equivalem à homologação visual ou persistência real.

### Próximo passo

Homologar os fluxos reais e as seis larguras; depois avaliar timezone por clínica e paginação/snapshot da API em tarefa específica do backend.

## 2026-11-06 — Refatoração do Calendário com FullCalendar 7

### Versão, dependências e integração

- Instalados `@fullcalendar/react` **7.1.4** e `temporal-polyfill` **1.0.8**, conforme a documentação oficial https://fullcalendar.io/docs/react e https://fullcalendar.io/docs/timeZone.
- Plugins gratuitos por subcaminhos da versão 7: daygrid, timegrid, list, interaction e tema Monarch. Imports obrigatórios skeleton.css, theme.css e paleta azul; nenhuma mistura com pacotes v6 ou plugins Premium.
- Cores de eventos usam as opções v7 `color` e `contrastColor`. Os estilos adicionais são limitados à classe `.medvita-calendar`.
- O calendário continua em chunk lazy: aproximadamente 357 kB (101 kB gzip) de JS próprio do módulo e 21 kB de CSS; o pacote inicial permanece abaixo de 500 kB. A biblioteca aumentou o tamanho do módulo, sem carregamento antecipado na rota principal.

### Funcionalidades

- Modos nativos `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `listDay` e `listWeek`.
- Smartphone abre em lista diária; desktop (a partir de 1024px) abre em semana. Na mudança de breakpoint, semana vira lista semanal em telas menores; listas viram semana em telas grandes, preservando a data. Calendário não é desmontado na mudança de resolução.
- Toolbar própria com anterior, próximo, Hoje, data e seletor de visualizações; filtros expansíveis por profissional/status.
- Mês no celular apresenta indicadores compactos; clicar em dia/mais eventos leva à lista diária. Em desktop, eventos adicionais usam popover nativo. Listas/dia/semana exibem horário, paciente, profissional e status por texto.
- Grade nativa posiciona eventos por início/término reais e duração; faixa completa de 00:00–24:00, sem esconder consultas fora do expediente. Consultas simultâneas não são sobrepostas (`slotEventOverlap=false`).
- Eventos abrem os detalhes existentes, onde continuam os fluxos de reagendamento/cancelamento. Drag-and-drop e redimensionamento desabilitados.
- Novo agendamento reaproveita o formulário existente. Clique em horário livre preenche data e hora; clique mensal primeiro abre o dia. Dados iniciais passam por estado de navegação vinculado à clínica e validação no módulo de Agendamentos.

### Arquivos criados nesta refatoração

- `src/features/calendar/components/FullCalendarView.tsx`, `CalendarToolbar.tsx`, `CalendarEventContent.tsx`.
- `src/features/calendar/hooks/use-responsive-calendar.ts`.
- `src/features/calendar/types/calendar.ts`.
- `src/features/calendar/utils/appointmentToEvent.ts`, `calendarDates.ts`, `fullcalendar.test.ts`.
- `src/features/calendar/styles/calendar.css`.

### Arquivos modificados ou substituídos

- `package.json` e `package-lock.json` para dependências.
- `src/features/calendar/pages/CalendarPage.tsx` e `hooks/use-calendar-appointments.ts`.
- Formatação dos utilitários/testes de calendário existentes; preservadas regras de consulta e testes de isolamento/paginação.
- `src/features/appointments/components/AppointmentForm.tsx`: initialTime opcional, além de initialDate.
- `src/features/appointments/pages/AppointmentsPage.tsx`: validação do horário inicial vindo do calendário.
- Removidos os componentes manuais `CalendarWeekView.tsx` e `CalendarAppointmentCard.tsx`, substituídos pelas visualizações/eventos nativos do FullCalendar. Não permanece um segundo calendário visual independente.
- Este documento. Alterações anteriores em `App.tsx`, utilitário de datas de Agendamentos e lockfiles foram preservadas; `/api` não foi modificado nesta tarefa.

### API, consulta e cache

- Reutiliza `appointmentsApi.list` (`GET /clinics/:clinicId/appointments`) e o seletor existente de profissionais (`GET /clinics/:clinicId/professionals`).
- `datesSet` determina o intervalo visível. O final exclusivo do FullCalendar é convertido para o último dia inclusivo e enviado até 23:59:59.999, conforme o filtro `<= to` do backend.
- Mantida a busca de um dia anterior para consultas que atravessam meia-noite; apenas o período visível é renderizado.
- TanStack Query é o único responsável por requests. Eventos são derivados do resultado; não existe fonte assíncrona paralela do FullCalendar.
- Chaves incluem clínica, intervalo e filtros, sob `appointmentKeys.all(clinic)`, compartilhado com a invalidação de criar/reagendar/cancelar. Providers existentes limpam dados ao sair/trocar de clínica. Não há persistência clínica em storage.
- Mantidos carregamento integral de todas as páginas (100 registros por página, máximo 100 páginas), rejeição de resposta de outra clínica e erro explícito para falha intermediária/total inconsistente. Resultados parciais ou antigos não são exibidos como agenda completa em falhas.

### Timezone e permissões

- API ainda não fornece timezone por clínica. Foi mantida a convenção operacional existente de Agendamentos: UTC−03:00 fixo, representado no FullCalendar pelo nome IANA `Etc/GMT+3`. O sinal invertido segue a convenção Etc/GMT; não se trata de America/Sao_Paulo nem de uma regra universal para clínicas.
- Timezone do calendário centralizado em `calendarDates.ts`; conversões por Temporal. Instantes ISO da API são preservados no adapter, sem simular horário clínico por deslocamento artificial em UTC/local.
- A futura adoção de fuso por clínica precisa ser coordenada com o formulário/detalhes de Agendamentos, que ainda usam defaultOffset. Não trocar apenas o timezone do calendário.
- Clínica/papel ativos obrigatórios. ADMIN e RECEPTIONIST podem iniciar cadastro; OPHTHALMOLOGIST consulta escopo autorizado pelo servidor. Administrador global não ganha acesso sem vínculo. Detalhes e mutations continuam com suas autorizações originais. Tratados 401/403 e erros de carregamento.
- extendedProps contém somente nome do profissional e status/rótulo; CPF, prontuário e cadastro completo do paciente não são copiados para eventos.

### Testes e validação efetivamente executados

- `npm run lint`, `npm run build` (inclui TypeScript) e `npm test`: aprovados; **3 arquivos e 17 testes**.
- Suite repetida com `TZ=America/Los_Angeles` e `TZ=Asia/Tokyo`, ambos com 17 testes aprovados.
- Novos testes verificam adapter, preservação de instantes/status, dados mínimos, offsets diferentes, mudança de dia, datas selecionadas para criação e final exclusivo nos períodos diário/semanal/mensal.
- Chromium headless instalado com Playwright temporariamente em `/tmp/medvita-browser`, sem dependência adicional no projeto. Foi montado um harness temporário com os contextos da aplicação e respostas de API simuladas, removido ao final.
- Nas larguras **320, 375, 390, 768, 1024 e 1440px**, foram executadas trocas entre lista diária, mês, dia e lista semanal/semana; largura do documento medida e screenshots capturados: sem overflow horizontal nos cenários testados. Revisadas visualmente capturas do mês de 320px, lista de 390px e semana desktop.
- Confirmados: inicialização móvel em listDay; adaptação após resize; navegação para `/agendamentos/:id`; exibição de erro 500 distinta de agenda vazia; foco ao navegar com Tab; paisagem em 844×390; ampliação **via CSS zoom 200%** em viewport de 768px sem overflow. CSS zoom não equivale a uma homologação completa do zoom nativo do navegador.
- Screenshots e script de execução temporários ficam em `/tmp/medvita-browser`; não são dados clínicos reais. Os erros 500 emitidos no console durante o teste foram respostas intencionalmente simuladas. O listener de pageerror do Playwright não registrou exceções; contudo, o log do Vite registrou avisos `ResizeObserver loop completed with undelivered notifications` durante as trocas rápidas de tamanho/visualização. Não houve falha dos fluxos verificados, mas esse aviso deve ser investigado em homologação de resize/HMR e em build de produção.

### Pendências e limites de homologação

- Não houve autenticação/persistência contra API/PostgreSQL reais nesta tarefa; confirmar integração ponta a ponta com dados e credenciais de homologação, inclusive criação/reagendamento/cancelamento e alterações concorrentes.
- Testes de browser isolaram o módulo com contextos, sem homologar todo o layout com sidebar/header ou leitores de tela. Foco por Tab, resize, screenshots e ausência de overflow não certificam acessibilidade completa.
- Validar com toque real, outros navegadores e zoom nativo de 200%. No mês de smartphones, sete colunas são inerentemente estreitas: navegação por lista e seletor de datas oferecem os controles amplos; os alvos do próprio grid mensal ainda merecem avaliação em aparelho físico.
- Limitações preexistentes mantidas: ausência de timezone clínico, profissionais sem paginação e listagem de agendamentos sem snapshot transacional. Nenhuma correção de backend foi incluída.

## 2026-11-06 — Remoção dos testes de Calendário

- A pedido do usuário, removidos os três arquivos de testes do calendário: `hooks/use-calendar-appointments.test.ts`, `utils/calendar.test.ts` e `utils/fullcalendar.test.ts`.
- Os resultados registrados acima são históricos, anteriores à remoção. Código da aplicação, dependências e configuração das ferramentas preservados.

## 2026-11-08 — Prontuários oftalmológicos / Encounters

### Funcionalidades implementadas

- `/prontuarios`: listagem paginada dos próprios atendimentos, busca de pacientes por nome/CPF usando o seletor/API existentes, filtro por paciente, status e período de início do atendimento. Histórico não é uma nova entidade: usa os registros de Encounter.
- `/prontuarios/pacientes/:patientId`: identificação mínima do paciente e histórico autorizado da clínica, em ordem fornecida pelo servidor (mais recentes primeiro), com paginação.
- `/prontuarios/atendimentos/:encounterId`: detalhe do próprio atendimento; edição apenas quando IN_PROGRESS e profissional corresponde ao usuário autenticado.
- Histórico de outros profissionais é consultado em modo somente leitura a partir dos dados já retornados pelo endpoint de histórico. Não usa GET de detalhe de terceiros, pois esse endpoint exige autoria.
- Início pelo detalhe do agendamento, apenas para oftalmologista designado, estados SCHEDULED/CONFIRMED e sem atendimento já associado. Quando existe atendimento, a ação abre o registro existente.
- Salvamento manual de rascunho, preservação de formulário em falhas, conclusão com confirmação e cancelamento com justificativa de 3–500 caracteres. A API de cancelamento de Encounter também cancela o agendamento vinculado; isso é informado no modal.
- Após concluir/cancelar, registro somente leitura, com status e feedback explícitos. Não há reabertura, auto-save, prescrição, impressão ou exportação simulados.

### Campos e validações conforme contrato

- `chiefComplaint`: queixa principal, até 4.000 caracteres.
- `anamnesis`: até 12.000 caracteres.
- `visualAcuityRight` / `visualAcuityLeft`: acuidade OD/OS, textos até 50 caracteres.
- `intraocularPressureRight` / `intraocularPressureLeft`: PIO OD/OS, número entre 0 e 100 com no máximo duas casas decimais (limites técnicos do DTO, sem interpretação clínica). Aceita vírgula na entrada e envia número JSON; trata o numeric do PostgreSQL recebido como string.
- `clinicalAssessment`, `plan`, `clinicalNotes`: até 12.000 caracteres cada.
- Rascunho permite campos vazios. Conclusão exige queixa principal, avaliação clínica e plano, como no service. Valores vazios são enviados como null; normalização de espaços acompanha o trim realizado pelo backend.
- Campos sem contrato, como refração/receita/laudos específicos, não foram inventados.

### Arquivos criados

- `src/features/medical-records/types/encounter.ts`.
- `src/features/medical-records/lib/encounter.ts` e `lib/encounter.test.ts`.
- `src/features/medical-records/api/encounters-api.ts` e `api/encounters-api.test.ts`.
- `src/features/medical-records/hooks/use-encounters.ts` e `use-unsaved-clinical-changes.ts`.
- Componentes `ClinicalDialog.tsx`, `ClinicalReadOnly.tsx`, `EncounterAppointmentAction.tsx`, `EncounterForm.tsx`, `EncounterList.tsx`, `EncounterStatusBadge.tsx` e `OcularMeasurements.tsx`.
- Páginas `MedicalRecordsPage.tsx` e `EncounterPage.tsx`.

### Arquivos modificados e infraestrutura reaproveitada

- `src/App.tsx`: três rotas de prontuários com lazy/Suspense.
- `src/main.tsx`: BrowserRouter substituído por createBrowserRouter/RouterProvider, preservando App/Routes e providers. Necessário para o useBlocker oficial do React Router; não usa bloqueio manual por manipulação de history.
- `src/contexts/ClinicProvider.tsx` e `AuthProvider.tsx`: eventos canceláveis antes de troca manual de clínica e logout solicitado pelo usuário. Quando há alterações clínicas, o hook pede confirmação; expiração forçada da sessão continua limpando os dados sem depender de confirmação.
- `src/components/layout/Header.tsx`: restaura estado do botão de sair caso o usuário desista do logout.
- `src/components/layout/Sidebar.tsx`: item Prontuários somente para papel clínico autorizado.
- `src/features/appointments/pages/AppointmentsPage.tsx`: ação de iniciar/abrir atendimento. FullCalendar continua abrindo esse detalhe, sem refatoração de suas visualizações.
- `src/features/patients/pages/PatientDetailsPage.tsx`: substitui área provisória por link de histórico somente para oftalmologistas.
- Reutilizados HTTP client, autenticação/clínica, TanStack Query, PatientSelector, usePatient, form-field (4 px), classes de botões/campos, formatação de datas UTC−03:00, React Hook Form, Zod, tipografia e paleta existentes. Nenhuma dependência nova adicionada nesta etapa.

### Endpoints integrados

Prefixo `/clinics/:clinicId`:
- `GET /encounters`, com page, limit=20, patientId, status, from e to.
- `GET /patients/:patientId/encounters`, com paginação e filtros.
- `GET /encounters/:id`.
- `POST /encounters`, corpo exclusivamente `{ appointmentId }`.
- `PATCH /encounters/:id`, dados clínicos.
- `PATCH /encounters/:id/complete`, dados clínicos e conclusão atômica no servidor.
- `PATCH /encounters/:id/cancel`, `{ reason }`.
- Busca/identidade reutilizam `/patients` e `/patients/:id`; agendamentos permanecem com seus serviços existentes. Sem requisições N+1 por paciente.

### Permissões e proteção de dados

- Role OPHTHALMOLOGIST obrigatório, conferido com clínica ativa. ADMIN, RECEPTIONIST e isSystemAdmin sem papel clínico não ganham acesso automático; rotas diretas mostram falta de permissão sem chamar a API clínica.
- GET da lista geral/detalhe e mutações são de autoria própria; histórico permite leitura de colegas na mesma clínica conforme endpoint. Guards de resposta verificam clinicId, paciente e autoria quando aplicável.
- Query keys incluem clínica, usuário, paciente/registro, filtros e paginação. Sem placeholder de outra clínica/usuário; queries clínicas têm gcTime=0 e staleTime=0 para não reter registros após perderem observadores.
- Mutations invalidam registros/histórico do contexto e `['appointments', clinicId]`, atualizando também o calendário. Dados de mutations são resetados e têm gcTime=0.
- Nenhuma persistência de rascunhos ou prontuários em localStorage/sessionStorage; nenhum conteúdo clínico em URL, console ou telemetria. Cache permanece em memória e usa limpeza já existente de clínica/logout. IDs de paciente/atendimento são os únicos identificadores clínicos nas rotas.
- Aviso de alterações não salvas nas rotas, back/forward via useBlocker, recarregamento/fechamento via beforeunload e confirmação nativa em troca manual de clínica/logout. Modais de conclusão/cancelamento usam dialog nativo, IDs acessíveis únicos, foco inicial e restauração de foco.
- Essas medidas de interface não substituem autorização definitiva, auditoria do servidor ou avaliação de conformidade legal.

### Mobile First e verificações executadas

- Layout base em uma coluna, cards e campos OD/OS verticais; olhos lado a lado a partir de md. Controles novos com mínimo 44×44 px. Ações de salvamento no fluxo da página, sem rodapé fixo que cubra campos/teclado.
- Chromium/Playwright temporários: formulário e listagem verificados em **320, 375, 390, 768, 1024 e 1440px**, usando App/rotas reais, header/sidebar e contextos de teste. Sem overflow horizontal nas medições. Repetida verificação do formulário com fontes reais Roboto/Montserrat carregadas.
- Inspecionadas capturas do formulário completo em 320px e modal de descarte em 390px. Capturas e script temporários em `/tmp/medvita-browser`; somente dados fictícios.
- Verificados no browser: início pelo agendamento; salvamento OD/OS (incluindo PIO zero e vírgula decimal); retenção de rascunho após erro 500; conclusão e bloqueio de edição; cancelamento; leitura de histórico de outro profissional; bloqueio de ADMIN/RECEPTIONIST; erro de lista distinto de vazio; proteção de navegação e evento de troca de clínica; aviso beforeunload ao recarregar.
- Formulário e histórico verificados com **CSS zoom 200%** sem overflow. Isso não equivale a homologação completa do zoom nativo, teclado virtual ou dispositivos físicos. Modais têm foco nativo; acessibilidade completa com leitores de tela segue pendente.
- Harness temporário removido e servidor de teste encerrado; fluxo final usa API real, sem fixtures de produção.

### Qualidade e testes automatizados

- Prettier / `npm run format:check`, ESLint / `npm run lint`, TypeScript integrado em `npm run build` e build aprovados.
- `npm test`: **2 arquivos, 13 testes aprovados**. Cobrem permissões, autoria/status, elegibilidade para iniciar, rascunho/conclusão, limites de campos e PIO, transformação numeric/null, mensagens seguras, contratos HTTP, filtros/paginação/AbortSignal, isolamento de clínica/paciente/usuário e invalidação/limpeza de cache.
- Existe aviso de bundle principal >500 kB (data router acrescenta código ao pacote inicial; páginas clínicas carregam por lazy). Não foi alterada a divisão dos demais módulos para evitar refatoração alheia ao escopo.

### Bloqueios e pendências de integração real

- **Possível bloqueio de listagem e histórico no backend:** `api/src/encounters/encounters.service.ts`, linhas 129 e 183, usa `.orderBy("encounter.started_at", "DESC")` com joins + skip/take. É o mesmo padrão que causou `Cannot read properties of undefined (reading 'databaseName')` em Agendamentos. A propriedade da entidade é `startedAt`; é necessário revisar/corrigir essa ordenação em tarefa de backend autorizada. Nenhum arquivo da API foi alterado aqui.
- Testes de browser interceptaram respostas HTTP com dados fictícios. Não foram usados credenciais ou PostgreSQL reais; persistência, auditoria, bloqueios concorrentes e a ordenação acima ainda precisam de homologação. **Listagem e histórico não devem ser considerados homologados com API real enquanto esse ponto não for resolvido.**
- O endpoint de histórico permite registros de colegas, mas o GET de detalhe só permite autoria. A consulta inline somente leitura foi adotada para respeitar essa diferença.
- Sem controle de versão de rascunho no contrato: edição concorrente do mesmo atendimento em outras abas/dispositivos exige avaliação posterior no servidor. Não foi criado autosave nem garantia artificial contra concorrência.
- Timezone clínico não é modelado na API; permanece a convenção UTC−03:00 do sistema, sem presumir que sirva para todas as clínicas.
- Recomendação: corrigir a ordenação do backend em tarefa própria, homologar o fluxo ponta a ponta e testar aparelhos físicos/teclado virtual, zoom nativo e leitores de tela. Preservadas as mudanças locais anteriores nos lockfiles e relatório.

## 2026-11-08 — Remoção dos testes unitários de Prontuários

- A pedido do usuário, removidos `api/encounters-api.test.ts` e `lib/encounter.test.ts` da feature medical-records.
- Os 13 testes registrados acima foram executados antes desta remoção e constituem histórico de validação.
- Código funcional, configuração e dependências de testes preservados. Nenhuma alteração no back-end nesta etapa.

## 2026-11-08 — Prévia administrativa de Prontuários para design

- Em `import.meta.env.DEV`, ADMIN e administrador global podem acessar uma prévia visual pelo menu Prontuários, mesmo sem clínica selecionada no caso global. Oftalmologistas continuam no fluxo clínico autorizado.
- A prévia oferece filtros de demonstração sem resultados e reutiliza o formulário clínico para testar campos. Não busca pacientes/prontuários nem permite salvar, concluir ou cancelar; conteúdo somente em memória e descartado ao sair.
- Em build de produção, menu e rotas mantêm a regra clínica original. O módulo de prévia é importado condicionalmente por DEV e não aparece no bundle de produção. Nenhuma alteração no backend.
- Chromium: acesso do administrador global sem clínica, preenchimento, operações desabilitadas e zero chamadas de API; seis larguras sem overflow. Lint, TypeScript e build aprovados. Nenhum arquivo de teste unitário foi adicionado.

## 2026-11-08 — UX/UI do formulário de Prontuários

### Auditoria e causa da repetição

- Não havia campo persistido duplicado. A seção tinha o título “Anamnese” e o único textarea da propriedade `anamnesis` também usava o label “Anamnese”.
- Mantida uma única seção principal Anamnese; o campo `anamnesis` passou a se chamar **História clínica e antecedentes**. A propriedade, os valores carregados e o payload continuam os mesmos. O botão de navegação leva à seção; não representa outra seção ou outro campo.
- Preservados os nove campos do DTO: chiefComplaint, anamnesis, visualAcuityRight/Left, intraocularPressureRight/Left, clinicalAssessment, plan e clinicalNotes. Não foram criados campos específicos de refração, biomicroscopia, fundo de olho, prescrição ou laudo, pois não existem no contrato atual.

### Organização e componentes

- Quatro seções: Anamnese; Acuidade visual; Pressão intraocular; Avaliação e conduta. OD e OS ficam verticais na base mobile e lado a lado a partir de md.
- Cards com título numerado, descrição curta e indicação de erros. Mantidas paleta safira, fontes, bordas e espaçamento de 4 px entre elementos do campo. Textareas com altura confortável, redimensionamento vertical e foco visível.
- Navegação por botões que focam/rolam para a seção, sem modificar URLs, sem wizard e sem desmontar campos. A seção focada/selecionada é indicada na navegação. O estado do React Hook Form é único e permanece montado.
- Resumo de erros com botões para focar os respectivos campos; labels, descrições e erros associados por IDs, aria-describedby e aria-invalid. Validação ao enviar e revalidação após interação com erro, sem mensagens prematuras na primeira digitação.
- Indicação explícita dos campos necessários apenas para concluir. Rascunhos continuam permitindo campos vazios. Falta de dados para conclusão marca os campos específicos e oferece foco direto, sem alterar os requisitos do servidor.
- Feedback distingue ausência de alterações, alterações pendentes, salvamento, confirmação de sucesso e falha. Mensagem de sucesso anterior deixa de aparecer quando o usuário volta a editar. Ação principal de salvar recebe destaque na cor existente.
- Cabeçalho do paciente compactado, com status ao lado do nome quando há espaço e metadados em duas colunas no desktop; conteúdo limitado a max-w-5xl para evitar campos excessivamente largos.

### Arquivos criados

- `src/features/medical-records/components/ClinicalSection.tsx`: estrutura acessível dos cards clínicos.
- `src/features/medical-records/components/ClinicalTextFields.tsx`: composição compartilhada de label/descrição/textarea/erro.
- `src/features/medical-records/components/ClinicalFormSections.tsx`: navegação, resumo de erros e composição das quatro seções.

### Arquivos modificados

- `components/EncounterForm.tsx`: composição das seções, feedback, destaque de ações e indicação dos campos exigidos para concluir.
- `components/OcularMeasurements.tsx`: reutilizado para pares de acuidade e PIO em seções distintas, com os mesmos Controller/names/valores.
- `lib/encounter.ts`: alteração apenas do rótulo de anamnesis; schema, normalização, permissões e campos do payload preservados.
- `pages/EncounterPage.tsx`: cabeçalho compacto e largura máxima consistente.
- Este documento. Alterações anteriores no repositório foram preservadas. Nenhuma mudança em `/api` nesta tarefa.

### Bibliotecas e infraestrutura

- Nenhuma biblioteca instalada. Avaliada a documentação atual do shadcn/ui; como o projeto não possui essa infraestrutura e já dispõe de campos e dialog nativo compartilhados, foram reutilizados os componentes existentes com Tailwind, React Hook Form, Zod e TanStack Query. Não foram criados widgets paralelos de Select/Tabs/Dialog.
- Controller mantido nos campos OD/OS. Não foi introduzido outro estado clínico, FormProvider desnecessário, autosave, persistência local ou mudança no fluxo HTTP/cache.
- Diálogos de concluir/cancelar e proteção de navegação/recarregamento/troca de clínica permanecem no fluxo existente. Prévia administrativa de desenvolvimento continua sem acesso à API clínica e com operações desabilitadas.
- Referências consultadas: [formulários acessíveis do W3C](https://www.w3.org/WAI/tutorials/forms/), [setFocus do React Hook Form](https://react-hook-form.com/docs/useform/setfocus), [integração React Hook Form no shadcn/ui](https://ui.shadcn.com/docs/forms/react-hook-form) e [padrões de formulários do NHS](https://service-manual.nhs.uk/design-system/patterns/question-pages). Não foram copiadas regras clínicas dessas referências.

### Testes executados

- `npm run format:check`, `npm run lint` e `npm run build` (inclui TypeScript): aprovados. `git diff --check -- web` aprovado.
- `npm test` executado: nenhum arquivo de teste encontrado, saída 1. Os testes unitários haviam sido removidos a pedido do usuário; não foram recriados nesta refatoração. A validação funcional foi feita no Chromium temporário com Playwright e respostas de API simuladas.
- Browser confirmou exatamente um heading principal “Anamnese”, nenhum textbox rotulado apenas “Anamnese”, carregamento da história previamente registrada e preservação da mesma propriedade no payload.
- Formulário e listagem verificados em 320, 375, 390, 768, 1024 e 1440 px, com App/header/sidebar e fontes atuais: sem overflow horizontal nos cenários medidos.
- Verificados: navegação entre seções mantendo OD/OS; indicação de campos obrigatórios na conclusão; resumo de erros e foco no textarea correto; salvamento; rascunho preservado após erro 500; atualização do feedback após nova edição; conclusão e somente leitura; cancelamento; início via agendamento; histórico de colega em leitura; bloqueio clínico de ADMIN/RECEPTIONIST; proteção de rota, evento de troca de clínica e beforeunload.
- Formulário e histórico também medidos com CSS zoom de 200%, sem overflow. Inspecionadas capturas do formulário de 320 px e diálogo de 390 px. Controles e botões de navegação têm mínimo de 44 px de altura.
- Harness temporário removido e servidor de teste encerrado. Dados usados eram fictícios e não foram introduzidos no fluxo final. Scripts/capturas temporários ficam em `/tmp/medvita-browser`.

### Limitações e próximos passos

- Sem homologação com credenciais/API/PostgreSQL reais. A possível falha de paginação do EncountersService (`orderBy("encounter.started_at")` com joins/paginação) permanece registrada na etapa anterior; o backend não foi alterado.
- Zoom nativo, teclado virtual em aparelho físico, leitor de tela e avaliação com médicos continuam pendentes. CSS zoom e testes de foco não equivalem a certificação completa de acessibilidade.
- Permanece o aviso de bundle principal acima de 500 kB; não foi refeita a arquitetura de carregamento de outros módulos nesta tarefa.
- Sugestão: homologar as operações com o backend e observar o uso do formulário com profissionais, antes de acrescentar campos ou componentes clínicos novos.

## Autenticação — sessão do navegador (08/11/2026)

- Login e renovação passam a entregar o refresh token exclusivamente pelo cookie `medvita_session`, `HttpOnly`, `SameSite=Strict`, `Secure` em produção, sem `Expires`/`Max-Age`.
- O access token continua somente em memória. A inicialização recupera a sessão antes de liberar ou redirecionar rotas; a renovação inicial é compartilhada entre as execuções do StrictMode.
- Logout e troca de senha removem o cookie; refresh inválido/expirado também o remove. A validade e a revogação das sessões no servidor permanecem vigentes.
- As chamadas de autenticação enviam credenciais e o cabeçalho `X-Medvita-Session: 1`. Front e API devem ser servidos pela mesma origem/proxy, como na configuração atual; CORS permanece desabilitado.
- O contrato HTTP de login/refresh deixa de retornar `refreshToken` no JSON; `/auth/refresh` passa a ler o cookie, em vez do corpo JSON.
- Limitação dos navegadores: recursos de restauração de sessão podem restaurar cookies de sessão ao reabrir o navegador. Portanto, fechar o navegador não permite garantir logout em todos os ambientes. O botão Sair continua encerrando a sessão explicitamente quando a API está disponível.
- Validação: build/lint de web e API; verificação temporária do controller com serviço simulado; Chromium com API simulada cobrindo bootstrap único, login, cookie HttpOnly sem persistência, reload autenticado, logout e reload desautenticado. Nenhum arquivo de teste adicionado ao repositório.

## Exames oftalmológicos — estrutura visual e auditoria (08/11/2026)

- API auditada somente para leitura: não há módulo, entidade, DTO, catálogo, endpoints ou upload de exames. Medições de acuidade visual e pressão intraocular continuam em Encounter e não são exames independentes.
- `/exames` agora tem página própria lazy, seguindo paleta, tipografia, alinhamento e seções dos módulos existentes. Aviso distingue indisponibilidade de ausência de registros; não há operações fictícias ou dados de pacientes.
- Contexto de clínica inclui carregamento, falha e ausência de seleção. Atalho para Prontuários apenas para oftalmologista com clínica ativa, sem erro. Nenhuma nova permissão de Exames foi presumida.
- Sem criação, filtros, detalhes, resultados ou anexos: não existem contratos correspondentes. Nenhuma alteração na API ou nova dependência.
- ESLint, TypeScript/build aprovados. Vitest executado sem suítes encontradas. Chromium com API simulada: seis larguras (320/375/390/768/1024/1440), sem overflow, zoom CSS 200%, Tab/Shift+Tab, foco, quatro perfis, seleção/troca de clínica e estados 401/403/503. Sem chamadas clínicas ou de exames. Nenhum teste adicionado ao repositório.
- Relatório, arquivos, contratos pendentes e limites de validação: `src/features/exams/README.md`.
- Status: estrutura visual disponível; módulo **não está funcionalmente concluído**, depende de API de exames. Zoom nativo e dispositivos físicos permanecem pendentes.

## Exames — MVP integrado com ExamsModule (08/11/2026)

- Esta etapa autoriza alterações de API e substitui a indisponibilidade anterior por integração real.
- Backend: ExamType/Exam, catálogo inicial em migration, FKs compostas de clínica/paciente/atendimento/profissional, DTOs, oito endpoints, service transacional, bloqueio concorrente e auditoria sem conteúdo clínico nos logs.
- Permissões: somente oftalmologista com perfil e vínculo ativo; escopo próprio do solicitante. Administrador de clínica, recepcionista e System Admin sem vínculo clínico elegível não recebem acesso a resultados.
- Fluxo: REQUESTED → IN_PROGRESS ao registrar resultado → COMPLETED por confirmação separada. Cancelamento em estados abertos exige motivo. Estados finais são imutáveis. Solicitante/data/clínica não podem ser atribuídos arbitrariamente pelo cliente.
- Frontend: listagem real, busca/filtros/período/paginação, cards/tabela, solicitação, atendimento opcional, lateralidade, edição permitida, resultado descritivo, detalhes, conclusão e cancelamento. Links bidirecionais com histórico/atendimento. Não há anexos neste MVP.
- Reutilização: cliente HTTP, contextos, TanStack Query, RHF/Zod, PatientSelector, seletor de atendimentos pelos hooks existentes, ClinicalDialog, proteção de alterações não salvas e tokens visuais. PatientSelector recebeu props opcionais de aria/ref. Ordenação paginada de Encounters corrigida para a propriedade TypeORM `startedAt` em duas consultas necessárias à integração.
- Validação: dois testes unitários e sete de integração HTTP/PostgreSQL real, migration aplicada/revertida/reaplicada somente em banco descartável. Fluxo real no Chromium, falha controlada com preservação do formulário, filtros, status, dados persistidos, isolamento após troca de clínica, teclado e seis larguras para listas/formulários/modal. Zoom CSS 200%; sem homologação de dispositivos físicos/zoom nativo.
- Sem migration no banco atual ou produção. Para utilizar no ambiente habitual, revisar/aplicar a migration em desenvolvimento e reiniciar a API. Dados atuais e alterações anteriores nos locks/relatórios foram preservados.
- Documentação: `api/docs/EXAMS.md` (contratos/regras/migration/testes) e `web/src/features/exams/README.md` (frontend/validações/limitações).


## Exames — prévia administrativa de design (08/11/2026)

- ADMIN e System Admin agora veem Exames em desenvolvimento para validar filtros, solicitação e resultado, no mesmo padrão da prévia de Prontuários.
- `canPreviewExams` controla menu e rota com `import.meta.env.DEV`; componente carregado sob demanda e excluído do build de produção. Não amplia permissões clínicas ou altera a API.
- Preview usa componentes de campo/filtros reais, com exemplos visuais de tipos. Nenhuma chamada clínica, seleção de paciente real ou persistência. Salvar, concluir e cancelar permanecem desabilitados.
- Lint/build e Chromium aprovados: ADMIN/System Admin em desenvolvimento, recepcionista bloqueada, oftalmologista no fluxo normal, seis larguras sem overflow e confirmação de bloqueio/menu oculto para ADMIN em produção. Testes de navegador com autenticação/vínculos simulados.


## Limpeza e organização dos commits de Exames (08/11/2026)

- Removidos os arquivos `api/test/exams-unit.test.cjs` e `api/test/exams-integration.test.cjs`, ainda não commitados, e os scripts npm associados.
- Documentação preserva as validações já executadas como histórico, sem apresentar comandos de teste removidos como disponíveis.
- Commits separados por correção de ordenação, módulo backend, integração frontend e prévia administrativa de desenvolvimento. Relatórios/progresso e alterações anteriores dos arquivos de lock permanecem fora dos commits.

## Clínicas — interface administrativa e Minha clínica (08/11/2026)

- Contratos auditados antes da implementação; trabalho exclusivo em `/web`, sem alterações no NestJS ou banco.
- Administração global exclusiva de System Admin: listagem, busca/status/paginação locais sobre o array autorizado, cadastro, detalhes, edição e ativação/desativação confirmada.
- Minha clínica para usuários vinculados: consulta de dados/equipe, edição somente para ADMIN local, sem acesso a listagem global ou status. URLs de outra clínica sem vínculo são bloqueadas antes da consulta.
- Formulário RHF/Zod em seções, labels/erros acessíveis, campos alterados enviados conforme UpdateClinicDto, documento/CEP/cidade somente leitura na edição. Proteção contra perda de alterações, falhas preservam valores e envios duplicados são bloqueados.
- Cache por usuário, atualização do resumo compartilhado de clínica após confirmação e revalidação de vínculos. Clínica desativada perde o contexto, limpa consultas clínicas anteriores e exige nova seleção explícita. Revalidação ao foco e a cada 60s; limpeza não cancela consultas da nova clínica.
- Equipe somente para consulta; gerenciamento completo de usuários/vínculos segue como etapa separada. Nenhuma métrica, convite, configuração ou campo de persistência inventado.
- Lint, TypeScript/build aprovados. Vitest sem suítes. Chromium com API simulada: perfis/permissões, listagem/filtros, criação, duplicidade, documento/email inválidos, edição/status, contexto/cache, equipe, 401/403/503, proteção de alterações, Pacientes após troca de clínica e seis larguras, teclado e CSS zoom 200%. Capturas revisadas. Sem teste de persistência real ou alteração de banco.
- Limitação auditada: API normaliza documento, mas não valida dígitos verificadores de CNPJ; GET /clinics não tem paginação/filtros; UpdateClinicDto não aceita documento, CEP ou cidade. Detalhes e relatório em `src/features/clinics/README.md`.

## Usuários globais e vínculos por clínica (08/11/2026)

- Auditoria Users/ClinicUsers concluída e documentada antes da implementação; escopo exclusivo `/web`, sem alterações no NestJS, banco, migrations ou regras de autenticação.
- Usuários globais: listagem, filtros reais de email/status, busca de nome/paginação locais, cadastro com senha inicial, edição autorizada de campos alterados, detalhes/vínculos e ativação/desativação confirmada. Somente System Admin monta consultas globais.
- Credenciais: senha inicial enviada fora de TanStack Query, sem hash/tokenVersion no cache de usuários; senha existente nunca preenchida. Própria senha usa fluxo Auth existente. Sem convite/reset administrativo fictício.
- Equipe: cards/tabela, consulta, seleção global por email exato, criação, mudança de papel/status e respostas de último ADMIN/duplicidade. ADMIN local gerencia vínculos existentes, mas não consulta candidatos globais; bloqueio por falta de endpoint local documentado.
- Integrações: mesma apresentação/consulta de equipe de Clínicas; invalidação de Profissionais sem criar perfil automaticamente; revalidateSession reutiliza refresh existente após alterações próprias. Próprio tokenVersion revogado leva ao login; papel próprio atualizado remove ações imediatamente. Menus/rotas distinguem Usuários globais e Equipe da clínica.
- Validação atual: lint e TypeScript/build aprovados; Vitest sem suítes. Chromium/API simulada cobrindo CRUD, validação, erros 401/403/409/503, privacidade do cache, status/papéis/vínculos, troca de clínica, sessão/senha/logout, navegação e proteção de alterações. Seis larguras, foco/teclado e CSS zoom 200% verificados.
- Smoke dos módulos existentes: Pacientes, Profissionais, Agendamentos, Calendário, Prontuários, Exames, Clínicas e Equipe carregaram estados vazios simulados. Não representa execução do fluxo clínico completo ou persistência real. Nenhum teste unitário permanente adicionado.
- Relatório para TCC: `web/FRONTEND_FINAL_REPORT.md`, com arquitetura, módulos, endpoints, permissões, evidências, limites e roteiro de homologação. Detalhes da feature: `src/features/users/README.md`.
