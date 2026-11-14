# MedVita Care — relatório técnico do frontend

Data: 08/11/2026. Material de apoio ao TCC, baseado no código existente e nas validações descritas abaixo. Não é homologação de produção ou avaliação de conformidade integral com LGPD.

## 1. Arquitetura

Frontend React/TypeScript, Vite, React Router, Tailwind CSS, TanStack Query, React Hook Form e Zod. Lucide fornece ícones; Fontsource fornece Montserrat e Roboto; FullCalendar é usado no calendário. Componentes usam HTML semântico e classes Tailwind existentes; não foi instalado outro design system.

`src/features` agrupa funcionalidades por domínio. Cada feature reúne contratos de tipos, integração HTTP, hooks, regras/validações, componentes e páginas conforme sua necessidade. `src/api/http-client.ts` centraliza Fetch, tratamento de erros e renovação de sessão; `src/contexts` concentra autenticação e clínica ativa; `src/components/layout` concentra Header, Sidebar e AppLayout.

O estado de formulário/interação fica nos componentes/RHF. Dados remotos usam QueryClient compartilhado. Rotas de módulos maiores são carregadas por lazy/Suspense. O router de dados permite bloquear navegação com alterações não salvas.

Não há um segundo cliente HTTP, cache persistente ou armazenamento de rascunhos/dados clínicos em localStorage. Typescript descreve contratos, mas a autorização definitiva continua no NestJS.

## 2. Autenticação e escopo

- POST /auth/login, POST /auth/refresh e POST /auth/logout; PATCH /auth/change-password.
- Access token somente na memória do provider. Refresh utiliza cookie de sessão HttpOnly/SameSite configurado pela API, com Secure em produção e cabeçalho específico nas operações de sessão.
- Inicialização aguarda recuperação da sessão antes de decidir rotas protegidas/públicas. HTTP client tenta refresh compartilhado após 401 e limpa o estado se a sessão não for recuperada.
- Cookie de sessão não garante logout ao fechar o navegador quando o navegador restaura sessões. Logout explícito continua sendo a forma de encerramento confirmada pela API.
- A nova operação de contexto `revalidateSession` reutiliza refresh existente para atualizar o usuário após alterações administrativas. Não muda regras JWT, tempo de validade ou contratos do backend.
- ClinicProvider cruza vínculos ativos com os papéis autenticados e o status da clínica. Revalida ao foco e periodicamente; seleção explícita inválida exige nova escolha. Contexto inválido limpa consultas clínicas anteriores.
- Administração global não equivale a autorização clínica. Chaves administrativas são por usuário; dados clínicos usam clínica e, nas features clínicas atuais, usuário/escopo.

## 3. Módulos implementados

### Usuários globais

Objetivo: administrar uma conta única por pessoa, independente dos vínculos com clínicas.

Páginas: `/usuarios`, `/usuarios/novo`, `/usuarios/:userId`, `/usuarios/:userId/editar`. Componentes principais: UsersPage, UserList, UserForm, UserDetails e UserStatusBadge. Camadas em features/users.

Endpoints usados: GET/POST /users; GET/PATCH /users/:id; PATCH /users/:id/active; GET /users/:id/clinics. Própria senha reutiliza a rota /alterar-senha e PATCH /auth/change-password.

Somente System Admin monta consultas globais. Email exato/status são filtros reais da API; nome/paginação são locais sobre o array autorizado. Cadastro exige nome/email/senha de 8..255; não atribui isSystemAdmin. Edição aceita name/email/isSystemAdmin conforme DTO, envia apenas campos alterados e confirma mudança de privilégio. Status é confirmado separadamente.

Senha inicial não entra em useMutation ou query cache. Respostas passam por allowlist; passwordHash/tokenVersion não entram no modelo de apresentação/cache global. Não há exclusão física, convite ou reset administrativo sem senha atual.

Situação: interface integrada aos endpoints existentes e validada com API simulada. Persistência real nesta etapa não homologada.

### Usuários por clínica

Objetivo: gerenciar ClinicUser sem recriar User ou Professional.

Rotas: /usuarios-clinica e /clinicas/:clinicId/usuarios. Componentes: ClinicUsersPage, ClinicMemberList, ClinicUserCreateForm e ClinicUserActions. Reutiliza consultas de equipe do módulo de Clínicas.

Endpoints: GET/POST /clinics/:clinicId/users; PATCH /clinics/:clinicId/users/:userId/role; PATCH .../:userId/active; GET /users/:userId/clinics.

ADMIN local gerencia papéis/status existentes da clínica ativa; RECEPTIONIST e OPHTHALMOLOGIST consultam a equipe; System Admin pode selecionar escopo administrativo por rota e buscar candidatos em GET /users?email=...&active=true.

Não existe busca local de candidatos autorizada na API: ADMIN local recebe orientação para solicitar novo vínculo ao System Admin. Não se contorna a restrição com consultas globais. Papéis disponíveis são ADMIN, RECEPTIONIST e OPHTHALMOLOGIST; isSystemAdmin não é papel do vínculo.

O servidor protege último ADMIN ativo, exige ADMIN como primeiro vínculo e recusa duplicidades/ativação com conta ou clínica inativa. Alterações próprias revalidam sessão, vínculos e escopo; alterações globais que revogam tokenVersion exigem novo login. Perfil profissional permanece independente.

Situação: fluxo administrativo implementado; bloqueio de busca local documentado; persistência real não homologada nesta etapa.

### Clínicas

Objetivo: administrar cadastro global e apresentar Minha clínica aos usuários vinculados.

Componentes: ClinicsPage, ClinicForm/ClinicFormFields, ClinicList, ClinicDetails, ClinicTeam e ClinicStatusBadge. Endpoints: GET/POST /clinics, GET/PATCH /clinics/:id, PATCH /clinics/:id/active e consultas de vínculos/equipe.

System Admin lista/cadastra/edita/altera status. ADMIN local edita clínica autorizada; demais vinculados consultam. Documento, CEP e cidade ficam somente leitura na edição por limitação de UpdateClinicDto. API não valida dígitos verificadores de CNPJ e retorna lista global sem paginação; frontend não afirma ter validação inexistente.

Dados confirmados atualizam resumo do contexto/menu e consultas. Clínica desativada sai do contexto autorizado. A consulta de equipe agora compartilha apresentação com Usuários por Clínica e possui navegação para ações autorizadas.

Situação: implementação anterior preservada; integração de equipe revisada nesta entrega. CRUD de Clínicas havia sido validado com API simulada, sem alterar banco.

### Profissionais

Objetivo: perfil profissional único associado a User; vínculo OPHTHALMOLOGIST não cria perfil automaticamente.

Componentes: ProfessionalsPage, ProfessionalsList e ProfessionalForm. Endpoints: /clinics/:clinicId/professionals (GET/POST), /:id (GET/PATCH) e /clinics/:clinicId/users para elegibilidade; API também possui consultas específicas por usuário/CRM.

A interface exige contexto de clínica autorizado e respeita escopo de papel/usuário existente. CRM/UF/RQE seguem a implementação atual. Mudanças em usuários/vínculos invalidam as consultas de profissionais para reavaliar elegibilidade.

Situação: módulo existente preservado; navegação/estado vazio revisados com resposta simulada. Não houve novo teste de criação de perfil nesta etapa.

### Pacientes

Objetivo: cadastro e consulta administrativa de pacientes no escopo da clínica.

Componentes: PatientsPage, CreatePatientPage, EditPatientPage, PatientDetailsPage e formulários existentes. Endpoints GET/POST /clinics/:clinicId/patients, GET/PATCH .../:patientId e PATCH .../:patientId/active.

Permissões são verificadas antes das consultas e ações; frontend não obtém uma lista global de pacientes. Formulários e normalização/validações atuais foram preservados.

Situação: implementação existente; navegação/estado vazio revisados. Cadastro/edição/persistência não foram novamente homologados nesta tarefa.

### Agendamentos

Objetivo: criar, consultar, reagendar e cancelar consultas autorizadas.

Componentes: AppointmentsPage, AppointmentForm, seletores e ações de atendimento. Endpoints GET/POST /clinics/:clinicId/appointments, GET .../:id, PATCH .../:id/reschedule e PATCH .../:id/cancel; profissionais/pacientes são obtidos por APIs existentes.

Criação/gestão administrativa seguem papel autorizado; início de atendimento é disponibilizado ao profissional designado conforme regras clínicas. Data/horário e offset operacional existentes são preservados.

Situação: módulo existente; navegação/estado vazio revisados com API simulada. Fluxo de escrita completo não foi reexecutado nesta entrega.

### Calendário

Objetivo: visualizar agendamentos em FullCalendar e navegar às operações existentes.

Componentes: CalendarPage, FullCalendarView e hooks de responsividade/consulta. Reutiliza GET /clinics/:clinicId/appointments; não duplica agenda persistida nem backend.

Filtros e ações seguem contexto/autorizações de agendamentos. Mês e tipografia seguem os ajustes existentes.

Situação: calendário carregou na revisão de navegação com agenda vazia simulada; não foi homologada nova escrita via calendário nesta tarefa.

### Prontuários

Objetivo: atendimento oftalmológico com anamnese, acuidade visual, pressão intraocular, avaliação e plano.

Componentes: MedicalRecordsPage, EncounterPage, EncounterForm, seções/campos clínicos, diálogos e leitura. Endpoints GET/POST /clinics/:clinicId/encounters, GET /clinics/:clinicId/patients/:patientId/encounters, GET/PATCH .../encounters/:id, PATCH .../:id/complete e .../:id/cancel.

Acesso clínico exige papel de oftalmologista; operações de edição respeitam profissional designado/status. Há proteção de alterações não salvas, cache com escopo de clínica/usuário e prévia administrativa isolada de desenvolvimento, sem consultas clínicas.

Situação: implementação anterior preservada; navegação/estado vazio clínico revisados. Não foi reexecutada cadeia de início/salvamento/conclusão em banco nesta tarefa.

### Exames

Objetivo: solicitação e resultado descritivo, independente das medições de Encounter.

Componentes: ExamsPage, ExamList, ExamForm, ExamDetails, formulário de resultado e confirmações. Endpoints GET /clinics/:clinicId/exams/types; GET/POST /exams; GET/PATCH /exams/:id; PATCH /:id/result, /:id/complete e /:id/cancel.

Oftalmologista elegível consulta/gerencia exames próprios; solicitações, resultados, conclusão e cancelamento têm transições e campos delimitados. Não há anexos ou IA. A prévia administrativa existe apenas em desenvolvimento, sem dados clínicos/persistência.

Situação: backend/frontend foram implementados anteriormente, com migration de Exames. Nesta tarefa, somente navegação/estado vazio foram revisitados. Evidências anteriores constam nos documentos da feature e não são contabilizadas como nova homologação atual.

### Dashboard

Tela existente de navegação/resumo. Não foi implementada uma API agregada de métricas nesta tarefa. Não se deve apresentar seus atalhos/placeholders como indicadores clínicos de produção.

## 4. Interface, Mobile First e acessibilidade

Paleta safira e tons existentes, Montserrat para títulos e Roboto para textos. Bordas arredondadas, cards, formulários em fieldset/legend, gap de 4px entre label/controle e botões padronizados. Layout de uma coluna progride para colunas e tabelas; sem biblioteca visual adicional.

Controles novos possuem labels associados, mensagens locais e aria-invalid/aria-describedby quando aplicáveis. Modais usam ClinicalDialog com dialog nativo, foco inicial/restauração e bloqueio de fechamento enquanto processa. Senha possui alternância explícita mostrar/ocultar. Formulários não persistem rascunhos em localStorage.

Áreas de toque dos botões novos seguem mínimo de 44px. Navegação com alterações não salvas utiliza os bloqueios e eventos existentes de troca de contexto/logout.

## 5. Segurança e tratamento de dados

A interface limita ações e consultas por papel, mas não substitui a autorização do NestJS. Manipular JavaScript do navegador não deve autorizar endpoints protegidos no servidor.

User, ClinicUser e Professional permanecem entidades distintas. Criação de conta não cria vínculo ou perfil profissional. Administrador global cadastral não recebe acesso clínico automático.

Senhas não são preenchidas a partir de registros existentes nem guardadas em cache. Dados globais usam chaves por ator; dados de clínica usam escopo correspondente; logout limpa o QueryClient. Respostas globais de usuário são filtradas por allowlist para não reter hashes/tokenVersion.

Erros são exibidos por mensagens adequadas, sem stack traces ou sucesso antecipado. As respostas de erro inesperado do servidor são tratadas pelo cliente compartilhado. Logs/testes desta entrega usam somente dados fictícios.

Não foi realizada auditoria legal ou avaliação integral de conformidade com LGPD; as medidas descritas são controles técnicos observados no código.

## 6. Validações executadas nesta entrega

| Validação | Evidência / resultado |
| --- | --- |
| ESLint | npm run lint --prefix web, aprovado |
| TypeScript/build | npm run build --prefix web (tsc -b + Vite), aprovado |
| Vitest | --passWithNoTests: nenhuma suíte encontrada; não equivale a testes unitários aprovados |
| Usuários globais | CRUD, filtros/email exato, paginação, estados vazios, validação, duplicidade, falha 503 com preservação e status confirmados no Chromium com API simulada |
| Senha e cache | Mostrar/ocultar, validação 8..255, senha/hash/tokenVersion ausentes do cache administrativo inspecionado |
| Vínculos | Criação, duplicidade, papel, status, erro do último ADMIN, conta/clínica elegíveis e escopos validados com respostas simuladas |
| Autorizações | System Admin, ADMIN, recepcionista, oftalmologista, sem vínculo, URL de outra clínica, 401 e 403 |
| Sessão própria | Mudança do próprio papel retira ações administrativas; próprio email revogado e troca de senha levam ao login |
| Navegação | Pacientes, Profissionais, Agendamentos, Calendário, Prontuários, Exames, Clínicas e Equipe carregaram sem erro de execução nos estados vazios simulados |
| Contexto e logout | Troca de clínica não mantém membros anteriores; logout limpa queries com dados |
| Responsividade | 320, 375, 390, 768, 1024 e 1440 px, listas/formulários/detalhes/equipe/confirmação sem overflow horizontal indevido |
| Acessibilidade | Tab/Shift+Tab, foco visível, modal nativo e zoom CSS a 200%; revisão de capturas desktop/mobile |

Automação temporária fora do repositório: users.cjs e users-smoke.cjs em /tmp/medvita-browser. Não foi adicionada suíte unitária permanente, seguindo a preferência anterior de remoção de arquivos de testes. Não foram alterados NestJS, migrations, banco ou dependências nesta etapa.

## 7. Fluxo principal e pendências para homologação

O código contempla a sequência por papéis: administração cria contas/clínicas/vínculos; ADMIN ou recepcionista cadastra paciente e agenda consulta; oftalmologista designado inicia/preenche/conclui o atendimento, consulta histórico e solicita/registra exame; usuário encerra sessão. Essa sequência requer contas/vínculos/perfis coerentes, não um único usuário com acesso universal.

**A sequência clínica inteira com persistência real não foi executada nesta tarefa.** As verificações atuais cobrem as operações administrativas novas e a navegação/estados descritos, com API simulada. Para homologação do TCC, executar essa cadeia no ambiente autorizado com backend/migrations preparados, dados fictícios e evidências por papel.

Pendências delimitadas:

- Pesquisa local segura de candidatos a vínculo: endpoint inexistente; criação por seleção fica com System Admin.
- Reset administrativo sem senha atual e recuperação por email: não existem contratos correspondentes.
- Paginação no servidor de usuários/clínicas: contratos atuais retornam arrays.
- Perfil profissional deve ser cadastrado no módulo responsável; vínculo de oftalmologista não é suficiente.
- Anexos de exames, configurações avançadas de clínicas e métricas de dashboard não integram esta entrega.
- Atualização entre navegadores não usa push; revogações dependem de requisições/revalidação existentes.
- Dispositivos físicos, zoom nativo, Safari/Firefox e testes de carga não foram homologados.
- Retorno automático à URL original após login e recuperação de sessão precisam integrar a homologação completa; os testes novos de navegação utilizaram sessão simulada restaurada e acesso explícito às rotas.

## 8. Documentação e alterações

Auditoria de contratos e detalhes da implementação nova em src/features/users/README.md. Demais contratos estão nos serviços HTTP das features e nos READMEs existentes de Clínicas/Exames. Histórico preservado em FRONTEND_PROGRESS.md.

Arquivos novos: features/users (API, tipos, schemas, hooks, componentes, página e README), features/clinic-users (API, hooks, componentes e página), este relatório. Arquivos integrados: App, Header/Sidebar, AuthProvider/auth-context, ClinicProvider e ClinicTeam. Não houve refatoração ampla dos módulos clínicos existentes.
