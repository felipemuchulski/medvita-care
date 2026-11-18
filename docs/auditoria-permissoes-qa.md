# Auditoria de autenticação, autorização e permissões — MedVita Care

Data: 18/11/2026. Referência do repositório: `a8c2e15`. Escopo: implementação disponível em `api/src`, `web/src`, testes e configuração de execução/empacotamento. Perfil de interesse: Oftalmologista.

Esta etapa criou somente este relatório. Não foram aplicadas correções, migrations, mudanças de permissões, conexões ao banco ou alterações remotas. Não foram consultados arquivos de credenciais. Exemplos e verificações usam dados sintéticos.

## 1. Conclusão executiva e limites da evidência

O sistema combina RBAC por clínica com verificações de propriedade nos serviços. O Oftalmologista **já pode criar agendamentos próprios**, consultar sua agenda e sua disponibilidade; **não pode reagendar nem cancelar agendamentos** pelos endpoints de agenda. É viável adicionar essas duas operações sem conceder ADMIN, preservando a verificação de autoria dentro da transação.

O principal achado é uma exposição de prontuário pelo detalhe de agendamento: `AppointmentsService.findById` carrega e retorna `appointment.encounter` completo para ADMIN e RECEPTIONIST. Os endpoints de atendimentos negam esses perfis, mas essa consulta alternativa não aplica a mesma restrição e não audita a leitura clínica. A combinação Guard + serviço + serialização foi verificada em memória com campos sintéticos.

Também há inconsistência entre o bypass de System Admin no Guard e as restrições locais dos serviços; leitura de histórico clínico entre oftalmologistas da mesma clínica; perfil profissional global editável por administradores locais; ausência de configuração explícita de cabeçalhos de segurança e de cache clínico no aplicativo.

**Classificação da evidência:** “comprovado” significa fluxo demonstrável no código e, quando indicado, reprodução em memória. Não significa exploração em produção. Nenhuma alegação de ausência de proteção na borda, estado real de constraints, RLS, privilégios PostgreSQL, vazamento de credenciais ou configuração do ambiente publicado foi validada. Essas verificações permanecem pendentes. Não foi feita auditoria de CVEs das dependências.

## 2. Identidades, papéis e associação dos dados

| Conceito | Implementação e efeito real |
| --- | --- |
| User | Identidade global em `api/src/users/entities/user.entity.ts`, com `active`, `isSystemAdmin` e `tokenVersion`. O hash de senha tem `@Exclude()`; existe serialização global. |
| System Admin | Flag global, não é valor de `ClinicUserRole`. Pode gerenciar usuários e clínicas globais. O Guard permite ultrapassar qualquer `@ClinicRoles`, mas vários serviços ainda exigem vínculo local. |
| ClinicUser | Associação User–Clinic, com `active` e **um** papel por par `clinicId/userId`, protegido por índice único na entidade. Papéis: `ADMIN`, `OPHTHALMOLOGIST`, `RECEPTIONIST`. Um User pode ter papéis diferentes em clínicas diferentes. |
| ADMIN | Administração da clínica: equipe, profissionais, cadastro de pacientes, agenda e auditoria. Não implica acesso direto aos endpoints de prontuários/exames. |
| OPHTHALMOLOGIST | Leitura de pacientes da clínica; agenda própria; atendimento próprio e histórico do paciente na clínica; exames solicitados por seu perfil. Não inclui administração. |
| RECEPTIONIST | Cadastro/consulta/edição de pacientes e operação da agenda da clínica. Não pode alterar status do paciente nem gerenciar equipe. |
| Professional | O nome concreto é `ProfessionalProfile`, em `api/src/professionals/entities/professional-profile.entity.ts`: um perfil global por User (`userId` único), CRM/UF únicos; não possui `clinicId` nem flag própria de atividade. |
| Sem vínculo ativo | Pode autenticar se User estiver ativo e usar operações da própria sessão/senha e consultar os próprios vínculos. Não recebe acesso clínico local por estar autenticado. |

`ProfessionalsService.create/validateProfessionalEligibility` exige clínica e User ativos e ClinicUser ativo como OPHTHALMOLOGIST. Criar ou alterar ClinicUser **não cria automaticamente** ProfessionalProfile. Ter CRM/perfil também não concede papel de médico. `authorizedProfilesQuery/findActiveForClinic` une perfil, User ativo e vínculo ativo de oftalmologista na clínica. Logo, `appointment.professionalId` é ID do **perfil**, não `User.id` nem `ClinicUser.id`; a autoria é estabelecida por `profile.userId === currentUser.sub`.

Um perfil criado em uma clínica serve às demais em que o User se vincule como médico. Criar outro perfil para esse mesmo User retorna conflito. Alterar o papel ou desativar o vínculo não apaga o perfil nem os registros históricos. Como existe um único papel por clínica, trocar OPHTHALMOLOGIST por ADMIN retira a autorização médica dos serviços, mesmo mantendo o perfil profissional.

## 3. Autenticação, Guards, decorators e validação

Arquivos principais: `api/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts`, `guards/authorization.guard.ts`, `types/jwt-payload.type.ts`; decorators em `api/src/common/decorators/`.

1. `AuthModule` registra `JwtAuthGuard` e depois `AuthorizationGuard` como `APP_GUARD` globais. `@Public()` dispensa o JWT; atualmente usado em login e refresh.
2. `JwtStrategy` extrai Bearer, valida assinatura/expiração e issuer/audience quando configurados. `validate` exige tipo `access`, sessão correspondente ao User, não revogada/não expirada, ausência de JTI revogado, User ativo e `tokenVersion` atual.
3. Em cada autenticação de requisição, `UserService.findForAuthentication` recarrega vínculos e clínicas; `clinicRoles` inclui somente vínculos e clínicas ativos. A autorização do servidor não depende de papéis antigos embutidos no front-end.
4. `@SystemAdmin()` exige a flag global. `@ClinicRoles(param, ...roles)` usa a clínica do parâmetro da URL; `@Roles()` isolado usa `x-clinic-id`. As rotas clínicas inspecionadas usam o parâmetro. Trocar um header não substitui a clínica da URL nessas rotas.
5. `AuthorizationGuard.canActivate` libera System Admin antes da checagem local. Sem metadados de papel/admin, autoriza qualquer usuário já autenticado. As exceções atuais relevantes são operações de sessão, senha e consulta dos próprios vínculos, com verificações próprias nos controllers.
6. `@CurrentUser()` apenas extrai `request.user`; não concede permissão nem restringe objetos. UUID válido também não representa autorização.
7. `configureApplication` aplica `ValidationPipe` com `whitelist`, `forbidNonWhitelisted` e `transform`; controllers usam UUID pipes e DTOs. Os DTOs de reagendamento não permitem trocar paciente/profissional/clínica. Os serviços aplicam allowlists de campos clínicos e regras de estado.

`AuthService.login` usa comparação bcrypt e mensagem genérica para credencial inválida. Emissão usa access token e refresh token; a sessão guarda hash SHA-256 do refresh e seu JTI. O controller retira refresh do JSON e o entrega em cookie HttpOnly/SameSite=Strict, Secure quando `NODE_ENV === production`, com path `/` e sem persistência explícita no navegador. Login/refresh têm `Cache-Control: no-store`. O header `X-Medvita-Session: 1` é exigido em login/refresh/logout; é barreira contra formulários cross-origin, não autenticação.

`refresh` verifica tipo, sessão, JTI, hash e versão do User e rotaciona o token; logout revoga sessão e JTI de acesso. Troca de senha incrementa tokenVersion; `AuthService.changePassword` também revoga sessões. `PATCH /users/:id/password` exige a senha atual do alvo mesmo quando o solicitante é System Admin: não implementa reset administrativo sem senha. Atualizações de email, flag global e atividade também incrementam tokenVersion. Não foi identificado limitador de tentativas no código da aplicação.

## 4. Matriz de permissões efetivamente implementadas

Legenda: **Sim** = permitido, sujeito à validação de entrada/estado; **Próprio** = limitado pelo vínculo do perfil com User; **Não** = negado; **Local** = System Admin precisa também do papel local indicado. Papéis locais pressupõem User, clínica e vínculo ativos. Um System Admin com vínculo segue as regras desse papel nos serviços que exigem acesso local.

| Operação | ADMIN da clínica | OPHTHALMOLOGIST | RECEPTIONIST | System Admin sem vínculo local |
| --- | --- | --- | --- | --- |
| Criar/listar/consultar/editar User global e alterar atividade | Não | Não | Não | Sim |
| Alterar própria senha com senha atual | Sim | Sim | Sim | Sim |
| Alterar senha de outro User com senha atual do alvo | Não | Não | Não | Sim |
| Criar/listar clínicas globalmente; buscar por documento; ativar/inativar | Não | Não | Não | Sim |
| Consultar clínica por ID | Sim | Sim | Sim | Sim |
| Editar cadastro da clínica | Sim | Não | Não | Sim |
| Consultar próprios vínculos | Sim | Sim | Sim | Sim; pode consultar os de outro User |
| Listar equipe da clínica (inclui email/papel/atividade) | Sim | Sim | Sim | Sim |
| Criar vínculo; alterar papel/atividade do vínculo | Sim | Não | Não | Sim |
| Criar/editar ProfessionalProfile | Sim | Não | Não | Sim, observada elegibilidade do alvo |
| Consultar profissionais | Todos os elegíveis da clínica | Próprio | Todos os elegíveis da clínica | Todos os elegíveis da clínica |
| Criar/editar paciente | Sim | Não | Sim | Local: ADMIN ou RECEPTIONIST |
| Consultar pacientes, inclusive inativos se selecionados | Sim, todos da clínica | Sim, todos da clínica | Sim, todos da clínica | Local: qualquer papel |
| Alterar atividade do paciente | Sim | Não | Não | Local: ADMIN |
| Criar agendamento | Sim, qualquer profissional elegível | Próprio | Sim, qualquer profissional elegível | Local: qualquer papel; escopo conforme papel |
| Listar/consultar agendamentos | Todos da clínica | Próprio | Todos da clínica | Local: qualquer papel; escopo conforme papel |
| Consultar disponibilidade | Profissionais elegíveis da clínica | Própria | Profissionais elegíveis da clínica | Local: qualquer papel |
| Reagendar/cancelar agendamento | Sim | **Não** | Sim | Local: ADMIN ou RECEPTIONIST |
| Ler atendimento via detalhe do agendamento | **Sim, exposição indevida** | Próprio | **Sim, exposição indevida** | Local: qualquer papel |
| Iniciar atendimento | Não | Próprio agendamento | Não | Local: OPHTHALMOLOGIST e autoria |
| Listar/consultar diretamente atendimentos | Não | Próprios | Não | Local: OPHTHALMOLOGIST e autoria |
| Consultar histórico do paciente | Não | **Todos os profissionais da mesma clínica** | Não | Local: OPHTHALMOLOGIST |
| Editar/concluir/cancelar atendimento | Não | Próprio, em andamento | Não | Local: OPHTHALMOLOGIST e autoria |
| Listar tipos de exames | Não | Sim, com perfil elegível | Não | Local: OPHTHALMOLOGIST e perfil |
| Solicitar/listar/detalhar/editar/registrar resultado/concluir/cancelar exame | Não | Próprios, conforme estado | Não | Local: OPHTHALMOLOGIST e perfil/autoria |
| Consultar audit-logs da clínica | Sim | Não | Não | Local: ADMIN |

Não há papel de paciente/portal do paciente, permissões granulares persistidas ou modelo de múltiplos papéis por clínica nesta implementação. Enumerações como CONFIRMED/NO_SHOW não significam que existam endpoints para todas as transições; não foram encontrados endpoints específicos para confirmar ou marcar ausência.

## 5. Catálogo de endpoints e responsáveis

As rotas abaixo são relativas à raiz da API. No modo unificado recebem prefixo `/api`; no modo separado não recebem esse prefixo. O prefixo é definido em `api/src/configure-app.ts`. Cada controller fica em `api/src/<módulo>/<módulo>.controller.ts`, exceto os nomes de classe destacados; os serviços estão no mesmo módulo.

| Controller / serviço | Endpoints e métodos envolvidos |
| --- | --- |
| `AuthController` / `AuthService` | `POST /auth/login` → `createLogin/login`; `POST /auth/refresh` → `refresh`; `POST /auth/logout` → `logout`; `PATCH /auth/change-password` → `changePassword`. |
| `UsersController` / `UserService` (`users/user.service.ts`) | `POST /users` → `create/createUser`; `GET /users` → `findAll`; `GET /users/:id` → `findById`; `PATCH /users/:id` → `update/updateUser`; `PATCH /users/:id/active` → `updateActive`; `PATCH /users/:id/password` → `updatePassword`. |
| `ClinicController` / `ClinicService` | `POST /clinics` → `create`; `GET /clinics` → `findAll`; `GET /clinics/document/:document` → `findByDocument`; `GET /clinics/:id` → `findById`; `PATCH /clinics/:id` → `update/updateClinic`; `PATCH /clinics/:id/active` → `updateActive`. |
| `ClinicUsersController` / `ClinicUsersService` | `POST /clinics/:clinicId/users` → `create`; `GET /clinics/:clinicId/users` → `findByClinic`; `GET /users/:userId/clinics` → `findByUser` (self ou global); `PATCH /clinics/:clinicId/users/:userId/role` → `updateRole`; `PATCH .../:userId/active` → `updateActive`. |
| `ProfessionalsController` / `ProfessionalsService` | Base `/clinics/:clinicId/professionals`: `POST` → `create`; `GET` → `findByClinic`; `GET /user/:userId` → `findByUser`; `GET /crm/:crm/:crmState` → `findByCrm`; `GET /:id` → `findById`; `PATCH /:id` → `update`. |
| `PatientsController` / `PatientsService` | Base `/clinics/:clinicId/patients`: `POST` → `create`; `GET` → `findAll/findAllByClinic`; `GET /:id` → `findById`; `PATCH /:id` → `update`; `PATCH /:id/active` → `updateActive`. |
| `AppointmentsController` / `AppointmentsService` | Base `/clinics/:clinicId/appointments`: `POST` → `create`; `GET` → `findAll`; `GET /availability` → `checkAvailability`; `GET /:id` → `findById`; `PATCH /:id/reschedule` → `reschedule`; `PATCH /:id/cancel` → `cancel`. |
| `EncountersController` / `EncountersService` | Base `/clinics/:clinicId`: `POST /encounters` → `start`; `GET /encounters` → `findAll`; `GET /patients/:patientId/encounters` → `findPatientHistory`; `GET /encounters/:id` → `findById`; `PATCH /encounters/:id` → `update`; `PATCH /encounters/:id/complete` → `complete`; `PATCH /encounters/:id/cancel` → `cancel`. |
| `ExamsController` / `ExamsService` | Base `/clinics/:clinicId/exams`, papel definido na classe: `GET /types` → `types`; `POST` → `create`; `GET` → `list`; `GET /:id` → `detail`; `PATCH /:id` → `update`; `PATCH /:id/result` → `result`; `PATCH /:id/complete` → `complete`; `PATCH /:id/cancel` → `cancel`. |
| `AuditController` / `AuditService` | `GET /clinics/:clinicId/audit-logs` → `findAll`, com restrição ADMIN também no serviço. |

## 6. Isolamento por clínica e por profissional

| Módulo | Proteção observada | Limite ou ressalva |
| --- | --- | --- |
| Usuários/auth | Users são globais; gestão global exige System Admin; senha/vínculos próprios têm checagem de identidade. | Não é cadastro isolado por tenant. Tokens são verificados contra estado atual do User e sessão. |
| Clínicas | Guard valida o ID da clínica para leitura/edição local. Listagem/documento/criação/atividade são globais. | `ClinicService` não recebe ator; depende da proteção do controller. System Admin acessa clínica inativa. |
| ClinicUsers | Queries usam clinicId ou userId; controlador restringe a consulta de vínculos alheios. Preservação do último ADMIN usa locks. | Mutadores dependem do Guard, sem assert de autorização do ator no serviço. Equipe inclui vínculos inativos. |
| Profissionais | `authorizedProfilesQuery` exige vínculo médico ativo, User e clínica ativos; leitura médica filtrada pelo User. | Perfil global: update local altera atributos vistos em outras clínicas. |
| Pacientes | `assertClinicRole`, clínica ativa, consultas por `id + clinicId`; CPF único por clínica na lógica. | Médico lê todos os pacientes da clínica, não só os de sua agenda. Helpers internos não recebem ator e não devem virar endpoints sem autorização. |
| Agendamentos | `assertClinicRole`; queries de leitura/lock com clinicId; filtro de autoria para médico; criação valida paciente e profissional na clínica. | Detalhe expõe Encounter. Listagem/detalhe retornam entidades relacionadas amplas. Conflitos de horário são globais por ProfessionalProfile. |
| Atendimentos | `assertOphthalmologist`; início verifica profissional do agendamento; detalhe/lista/mutação usam clínica e User; locks nas mutações. | Histórico usa clínica/paciente sem autoria. Início não revalida atividade do paciente; não deve ser confundido com a elegibilidade exigida na criação de agenda. |
| Exames | `authorize` recarrega perfil/User/vínculo/clínica; todas as consultas e locks de exames usam clinicId e profissional solicitante. Paciente deve ser ativo da clínica; atendimento opcional deve corresponder a clínica/paciente/profissional e não estar cancelado. | Tipos de exame são catálogo global ativo. Não há leitura compartilhada de exames de outros solicitantes, mesmo no histórico do paciente. |
| Auditoria | Consulta filtra clinicId e exige ADMIN no serviço; leituras sensíveis bloqueiam com 503 se não forem auditadas. | Não existe garantia de auditoria para retornos sensíveis indiretos de agendamentos. Operações de User/Clinic/Professional não têm a mesma trilha explícita dos módulos clínicos. |

`AppointmentsService.findConflict` não filtra clinicId, deliberadamente impedindo choque do mesmo profissional entre clínicas. `checkAvailability` devolve `available: false`, mas omite detalhes do conflito se ocorrer em outra clínica. Isso protege os identificadores, porém revela uma informação de ocupação entre clínicas; confirmar a política desejada antes de mudar a regra.

As migrations existentes foram somente lidas. `1793692800000-AddClinicalOperationsAndAudit.ts` define exclusion constraint de horários por profissional e índices clínicos. `1794096000000-AddExams.ts` define FKs compostas de exame para paciente/clínica e atendimento/clínica/paciente/profissional, além de checks de estado e resultado. As entidades de agendamento/atendimento têm relações simples e não demonstram, por si, equivalentes FKs compostas. Não foi encontrada definição de RLS nos arquivos inspecionados. A aplicação depende de predicados nas queries; não se pode certificar constraints, grants ou RLS do banco real sem inspeção posterior autorizada.

### Estados e escrita clínica

- Reagendamento/cancelamento de agenda: somente SCHEDULED/CONFIRMED, sem qualquer Encounter vinculado; bloqueio pessimista e auditoria transacional. Reagendamento exige data futura e checagem de conflito; duração validada entre 5 e 480 minutos.
- Início de atendimento: agendamento próprio da clínica, SCHEDULED/CONFIRMED, sem atendimento anterior. Muda ambos para IN_PROGRESS e audita na transação. Não existe início avulso pelo endpoint atual, apesar da coluna appointmentId ser nullable na entidade.
- Edição/conclusão/cancelamento de atendimento: somente autor e estado IN_PROGRESS. Conclusão exige queixa, avaliação e plano e atualiza a agenda para COMPLETED; cancelamento cancela também a agenda. Não há edição de atendimento finalizado pelo fluxo atual.
- Exames: solicitação editável apenas em REQUESTED; resultado em REQUESTED/IN_PROGRESS; conclusão exige resultado/data e IN_PROGRESS; cancelamento somente em estado aberto. Escrita e auditoria compartilham a transação; detalhe usa seleção explícita e leitura auditada; listagem omite notas/resultado/motivo de cancelamento.

## 7. Front-end, rotas protegidas e 401/403

`web/src/App.tsx` coloca os módulos sob `ProtectedRoute`; esse componente (`features/auth/routes/ProtectedRoute.tsx`) verifica **autenticação**, aguarda restauração e redireciona a `/login`. A autorização por papel ocorre nas páginas e helpers, não no roteador central. `PublicOnlyRoute` impede login para sessão autenticada. Ocultar o menu não foi tratado como evidência de proteção no servidor.

`AuthProvider` mantém access token em memória e restaura a sessão via refresh em cookie; não foi encontrado armazenamento de token em localStorage/sessionStorage no fluxo inspecionado. `clearSession` limpa React Query. `api/http-client.ts` tenta um refresh para 401 autenticado e repete a chamada uma vez; coordena refresh concorrente dentro da instância. Falha no refresh ou novo 401 encerra a sessão. **403 não renova token nem desloga:** vira `ApiError` e é apresentado pelas páginas. Queries não repetem 401/403 automaticamente; mutações não têm retry no QueryClient.

Arquivos de política visual: `features/appointments/lib/appointment.ts` (`canCreate`, `canManage`, `canChange`), `features/patients/lib/patient-permissions.ts`, `features/medical-records/lib/encounter.ts`, `features/exams/lib/exam.ts`, `features/professionals/lib/professional.ts`. As páginas de prontuário/exames bloqueiam montagem do conteúdo real para não médicos; previews administrativos são condicionados a `import.meta.env.DEV` e não concedem acesso real aos endpoints. `EncounterList.tsx` permite ler inline registros de outros médicos no histórico, de acordo com a API.

`ClinicProvider` busca vínculos a cada 60 s e ao recuperar foco. `getAllowedMemberships` exige igualdade entre papel atual do vínculo e o retrato da sessão. Mudança de papel pode retirar a clínica da UI até novo refresh/revalidação. A API já usa o papel atual a cada requisição. Em mudança de clínica há cancelamento/remoção de queries por contexto; logout limpa tudo. Hooks clínicos usam clínica + User e `gcTime: 0`; hooks de agenda usam clínica, mas não papel/User nas chaves. O remount por papel não substitui invalidação de cache em todas as transições de autorização.

Os componentes de agenda usam base em coluna única, `min-w-0`, quebra de texto e expansão `sm/md`; `use-responsive-calendar.ts` usa breakpoint de 1024 px com fallback pequeno. Isso demonstra intenção mobile-first, não aprovação visual/acessível. Não foi realizada execução em navegador ou leitor de tela nesta etapa. Toda futura alteração deve manter mobile-first, responsividade e acessibilidade, com os testes da seção 11.

## 8. Achados comprovados e recomendações

Prioridades: P1 = tratar primeiro por risco de confidencialidade; P2 = consistência/autorização/robustez; P3 = endurecimento. Complexidade estimada: baixa (até 1 dia), média (2–4 dias), alta (5+ dias). São ordens de grandeza de engenharia, incluindo testes direcionados, sem prazo de homologação nem mudança de infraestrutura externa.

### A01 — P1 / alta gravidade: prontuário exposto no detalhe de agendamento

**Evidência:** `api/src/appointments/appointments.service.ts:192`, método `findById`, especialmente `leftJoinAndSelect("appointment.encounter", "encounter")` na linha 203. O controller permite ADMIN/RECEPTIONIST. `Encounter` contém anamnese, queixa, avaliação, plano, medidas e notas sem `@Exclude()` ou `select: false`. O serviço retorna a entidade integral. O serializer global não remove esses campos. O helper visual que esconde a ação clínica não protege o JSON.

**Cenário:** recepcionista com vínculo ativo consulta `GET /clinics/<sua-clinica>/appointments/<id-com-atendimento>`; tem acesso ao objeto clínico apesar de receber 403 no endpoint de atendimentos. A leitura não passa por `recordSensitiveRead`. Também se aplica ao ADMIN local. Não exige acesso a outra clínica nem elevação de papel.

**Validação feita:** execução do Guard real do controller, `findById` real e `instanceToPlain`, usando query/repositório simulados e instâncias reais de Appointment/Encounter com marcadores sintéticos. Ambos os papéis receberam o campo clínico. A consulta SQL e a resposta HTTP completas ainda precisam de teste de integração em QA.

**Correção proposta:** contrato explícito da resposta de agenda; representar o vínculo clínico apenas por metadados operacionais necessários, como ID/status, sem conteúdo clínico. Manter conteúdo clínico nos endpoints autorizados e auditados. Revisar também respostas de criação/reagendamento/cancelamento, pois retornam por `findById`. **Complexidade média.** Testes T02/T03.

### A02 — P2 / inconsistência: System Admin autorizado no Guard e negado nos serviços

**Evidência:** `AuthorizationGuard.canActivate` libera `isSystemAdmin` na linha 44; `PatientsService.assertClinicRole`, `AppointmentsService.assertClinicRole`, `EncountersService.assertOphthalmologist`, `ExamsService.authorize` e `AuditService.assertClinicAdmin` exigem papel local. Em contrapartida, profissionais aceitam explicitamente o administrador global e Clinic/ClinicUsers dependem do Guard.

**Impacto:** o mesmo perfil global acessa equipe/profissionais sem vínculo, mas recebe 403 em pacientes/agenda/auditoria e não obtém privilégio médico. Reprodução em memória confirmou 403 do serviço de agenda sem vínculo local. Isso não prova bypass clínico pelo administrador global; prova semântica divergente.

**Correção proposta:** documentar e aprovar política global versus local; preferir poderes administrativos explícitos e acesso clínico condicionado à função apropriada, sem bypass universal por conveniência. Alinhar Guard, serviços, UI e testes sem ampliar automaticamente acesso médico. **Complexidade média.** T01/T04.

### A03 — P2 / decisão de escopo: histórico permite ler prontuários de outros médicos

**Evidência:** `EncountersService.findById/findAll` usa `authorizedQuery` por User; `findPatientHistory` na linha 168 usa `clinicQuery` por clínica e paciente e retorna conteúdo completo, sem condição de autoria ou relação assistencial com o paciente. O React apresenta esses registros em modo somente leitura.

**Impacto:** um médico ativo da clínica pode ler o histórico de qualquer paciente da clínica, inclusive atendimentos de outros profissionais e estados diferentes; recebe 404 se tentar o detalhe direto do atendimento alheio. A leitura é auditada. Isso é comprovadamente uma diferença de política, mas **não pode ser classificado como acesso indevido sem decidir se o prontuário é compartilhado na clínica**.

**Correção proposta:** aprovar política de histórico compartilhado ou restrito; explicitar capacidade de leitura separada da autoria para escrita e aplicar os critérios a todos os caminhos. Não restringir automaticamente o histórico nesta etapa. **Complexidade média; alta se houver novo modelo de relação assistencial.** T03.

### A04 — P2 / limite de tenant: administrador local altera perfil profissional global

**Evidência:** `ProfessionalProfile.userId` é global e único; `ProfessionalsService.update` valida ADMIN na clínica da URL, encontra o perfil elegível e altera CRM/UF/RQE/especialidade no registro global.

**Impacto:** ADMIN da clínica A pode alterar atributos vistos na clínica B quando o mesmo médico tem vínculo em ambas, sem ser ADMIN de B. Não há exposição comprovada dos prontuários de B por esse caminho, mas há efeito de escrita entre clínicas. A legitimidade dessa gestão global por administrador local requer aprovação de produto.

**Correção proposta:** definir quem mantém identidade profissional global e distinguir atributos locais; restringir atualização global conforme decisão aprovada. Não duplicar perfil ou criar migrations sem projeto e autorização próprios. **Complexidade média para restrição de escrita; alta para remodelagem.** T05.

### A05 — P2 / inconsistência de atualização de acesso e cache no React

**Evidência:** `getAllowedMemberships` cruza papel da sessão e vínculo; `ClinicProvider` atualiza apenas vínculos periodicamente. O retrato de `AuthProvider` muda no refresh. Chaves de agenda em `use-appointments.ts` contêm clínica, ID/filtros, sem papel/User; a limpeza automática por clínica depende da troca de activeId.

**Impacto comprovado no fluxo:** um papel alterado pode fazer a clínica desaparecer até revalidação da sessão. O cache de agenda não distingue escopos de papel. **Exibição indevida após rebaixamento ainda precisa de reprodução**, pois a limpeza de contexto pode removê-lo; não se afirma vazamento de cache confirmado. 403 não limpa caches automaticamente.

**Correção proposta:** sincronizar retrato de autorização e vínculo; cancelar/remover dados que perderem escopo e incluir identidade/escopo nas chaves pertinentes. Preservar formulários com tratamento explícito de perda de permissão. **Complexidade média.** T06.

### A06 — P2 / lacuna na aplicação: cabeçalhos de segurança e cache sensível

**Evidência:** `api/src/main.ts` e `configure-app.ts` não registram middleware de segurança, política CSP, HSTS, frame-ancestors/X-Frame-Options, nosniff, Referrer-Policy ou Permissions-Policy, nem desabilitam explicitamente `X-Powered-By`. A configuração explícita de cache cobre login/refresh e fallback HTML, mas não respostas de pacientes, agendamentos, prontuários e exames.

**Impacto:** aplicativo não garante essas proteções nem impede explicitamente armazenamento HTTP de respostas clínicas. Fingerprint `X-Powered-By` depende do comportamento do adaptador e da borda; ausência e conteúdo dos headers públicos precisam ser medidos. Não há prova de exploração de XSS/clickjacking, cache compartilhado ou divulgação de topologia real nesta auditoria.

**Correção proposta:** configurar headers compatíveis com a versão instalada e com o React/calendário; CSP inicialmente observável antes de endurecer; HSTS somente no contexto HTTPS apropriado; retirar fingerprints na aplicação e borda; `no-store` para respostas sensíveis. Confirmar funcionalidade com fontes/assets locais e sem permissões CSP desnecessárias. **Complexidade média.** T07.

### A07 — P3 / lacuna de defesa: autorização sem política explícita libera autenticados

**Evidência:** `AuthorizationGuard.canActivate` retorna true quando não há `@SystemAdmin` nem papéis na linha 33. JWT continua obrigatório salvo `@Public`.

**Impacto:** novo endpoint autenticado que esqueça a declaração de política não é bloqueado pelo Guard de autorização. Nas exceções atuais de senha/vínculos existem verificações próprias; não foi encontrado um endpoint administrativo atual aberto a qualquer usuário por essa regra isoladamente.

**Correção proposta:** inventariar exceções intencionais, declarar política de usuário autenticado/self e testar cobertura de metadados antes de adotar negação por padrão. **Complexidade média.** T01/T08.

## 9. Autenticação e infraestrutura: testes adicionais exigidos

| Ponto pendente | Motivo, risco e evidência a obter | Recomendação / complexidade |
| --- | --- | --- |
| Refresh concorrente e replay | `AuthService.refresh` faz leitura/verificação/save sem lock ou compare-and-swap. Dois refreshes simultâneos podem validar o mesmo JTI antes da atualização; a deduplicação React vale por instância, não entre abas. Reproduzir com barreira de concorrência; testar revogação durante refresh e política de reutilização. | Rotação atômica e política explícita de replay, se confirmado; média. T09. |
| Logout com falha de rede | `AuthProvider.logout` limpa memória em finally; se a chamada não alcançar o servidor, cookie HttpOnly e sessão podem continuar válidos e restaurar no próximo reload. | Simular offline e reload; definir comunicação e nova tentativa de revogação sem falsa garantia de logout remoto; média. T09. |
| Limitação de login/refresh | Não há throttling na aplicação inspecionada; limite no proxy/WAF não foi verificado. Comparação de senha só ocorre quando encontra User, exigindo avaliação de diferença temporal. | Medir em ambiente isolado; aplicar limites contra abuso sem bloquear indiscriminadamente rede de clínica; média. T09. |
| Cookie/SameSite e CORS | CORS usa origem única FRONTEND_URL e credentials; mesmo no modo unificado pode ser ativado se essa variável existir. Cookie Strict limita uso entre sites distintos. Comentário de `requireBrowserRequest` afirma CORS desabilitado, mas a configuração é condicional. | Testar origem permitida/proibida, preflight, desenvolvimento com proxy, expiração e Secure em produção. Não tratar CORS como RBAC; baixa/média. T07/T09. |
| Inativação concorrente | JWT recarrega vínculo, mas revogação/inativação pode ocorrer depois do Guard. Exames revalidam e usam locks; início de atendimento não revalida paciente ativo e depende do perfil ligado à agenda. | Definir efeito esperado da inativação em registros existentes e requisições em curso; testar corridas e status sem bloquear histórico indevidamente; média. T03/T10. |
| Último administrador | ClinicUsers protege último vínculo ADMIN ativo com locks; User global pode ser inativado sem consultar essa regra, deixando apenas vínculo de usuário inativo. | Testar inativação global do último administrador, demissões simultâneas e primeiro vínculo; decidir regra entre módulos; média. T05/T10. |
| Auditoria e erros internos | Exames convertem falhas de escrita inesperadas em 503 genérico; outros serviços relançam erros não reconhecidos, que podem chegar ao logger Nest com parâmetros. | Injetar falhas usando marcadores sintéticos; examinar resposta e logs, sem dados reais. Testar rollback quando auditoria falha; média. T10. |
| Borda e topologia | Não foram feitas chamadas ao domínio publicado, proxy, painel de hospedagem ou banco. Bundle pode conter endereço público de API se VITE_API_URL for configurado; não prova segredo. | Inspecionar headers de HTML/assets/API/401/403/404/500; ocultar Server/X-Powered-By, validar HTTPS/proxy e ausência de hosts internos, paths, versões e stack traces em respostas; média. T07. |
| Artefato estático | `configure-app.ts` ignora dotfiles, reserva namespace /api e evita fallback para assets inexistentes; `scripts/build-unified.mjs` e `test-unified.cjs` têm verificações de empacotamento. O diretório estático pode servir qualquer arquivo não oculto que seja incluído nele. | Validar conteúdo do artefato, .map, backups e configurações com dados sintéticos e 404; sem presumir exposição de arquivos do backend fora de public; baixa/média. T07. |
| PostgreSQL real | `connection-options.ts` exige CA, TLS com validação de hostname, `rejectUnauthorized: true`, mínimo TLS 1.2, synchronize/migrationsRun false. Estado de RLS, grants, constraints e isolamento real não foi consultado. | Inspeção posterior em ambiente aprovado e integração descartável; alta se exigir defesa adicional de tenant. T10. |

## 10. Viabilidade de autogestão de agenda do Oftalmologista

**Viável, sem ADMIN e sem necessidade evidente de migration para essa capacidade.** A clínica, o perfil e a autoria já existem no modelo. A mudança proposta é ampliar somente as ações de reagendar/cancelar para o médico autor, não conceder administração.

Após aprovação:

1. Incluir OPHTHALMOLOGIST nos decorators de `PATCH .../reschedule` e `PATCH .../cancel` **e** na autorização correspondente do serviço. Só mudar o decorator não funciona; só mudar o front-end também não.
2. Na mesma transação e antes de qualquer escrita, carregar o agendamento com lock por `id + clinicId` e verificar o User do perfil designado. Para médico, exigir `professional.userId === currentUser.sub`; preservar comportamento de ADMIN/RECEPTIONIST. ID arbitrário ou filtro enviado pelo cliente não pode definir autoria.
3. Preservar estado SCHEDULED/CONFIRMED, ausência de atendimento, data/duração, conflitos globais por profissional, motivo de cancelamento e auditoria. O DTO de reagendamento continua sem permitir troca de profissional/paciente/clínica. Padronizar 403/404 para alvo fora do escopo sem revelar dados.
4. No React, substituir a decisão apenas por papel de `canManage` por capacidade contextual para a ação sobre aquele agendamento. Preservar o vínculo mínimo com Encounter após A01 para `canChange`. Revisar agenda e calendário, mensagens 401/403, invalidação de cache e navegação direta.
5. Validar médico sem perfil, perfil de outro User, outra clínica, vínculo/paciente/profissional inativo e concorrência com início de atendimento. Não usar ADMIN como solução de contorno.

Estimativa: **complexidade média (2–4 dias)** para API, UI e testes direcionados, depois de estabilizar o contrato de resposta de A01. Regra de histórico compartilhado e poderes globais são decisões separadas e não precisam ser ampliadas para entregar essa capacidade.

## 11. Plano incremental e testes automatizados necessários

As etapas abaixo são propostas para uma próxima fase **após aprovação**. Nenhum teste novo foi salvo no repositório nesta auditoria. Casos que necessitem PostgreSQL devem usar instância descartável explicitamente isolada; não executar migrations ou preparar fixtures no banco atual.

| Etapa | Entrega pequena e critério de aceite | Testes necessários |
| --- | --- | --- |
| 1 — Fixar política e baseline | Aprovar matriz de papéis globais/locais, leitura compartilhada e edição do perfil global. Criar regressões antes de mudanças. | **T01:** parametrizar Guard real + controllers para anônimo/sem vínculo/três papéis/global sem vínculo/global com cada papel; clínica A/B, vínculo/clínica/User inativos; JWT ausente/expirado/revogado/versão antiga; exceções self. Garantir precedência de metadados de método/classe e clínica da URL sobre header. |
| 2 — Fechar exposição A01 | Resposta de agendamento contém somente dados operacionais aprovados; módulos continuam reconhecendo existência/estado do atendimento. | **T02:** integração HTTP com serializer real: ADMIN/RECEPTIONIST nunca recebem anamnese, plano, notas, avaliação ou medidas no detalhe nem respostas de mutação; verificar também lista/calendário, campos extras e ausência de passwordHash/refresh token em respostas. **T03:** endpoints clínicos continuam negando administrativos; médico lê/edita apenas conforme política aprovada; testar histórico, filtros, IDs de outro médico/tenant, finalizados/cancelados, auditoria de leitura e 503 se falhar. |
| 3 — Alinhar políticas A02/A04/A07 | Guard e serviço concordam com as decisões aprovadas, sem ampliar implicitamente privilégios clínicos. | **T04:** testar mesmos endpoints com global sem vínculo e com cada papel local; flag global não autoriza ato clínico indevido. **T05:** mesmo User médico em A/B, atualização global conforme política, conflito de perfil/CRM, autoalteração de papel, promoção indevida por médico/recepção, último ADMIN, alvo inativo e consultas de vínculos de outro User. **T08:** inventário de rotas exige política explícita; exceções autenticadas/self testadas; body tentando injetar role/clinicId/professionalId/isSystemAdmin em endpoints que não os aceitam deve falhar. |
| 4 — Estender autogestão da agenda | Médico reagenda/cancela somente agenda própria; ADMIN/RECEPTIONIST mantêm operações atuais. | **T11:** médico próprio sucesso, médico alheio negado sem escrita/auditoria de sucesso, outra clínica negada, sem perfil negado, data passada/duração inválida, conflito 409, motivo inválido, status incompatível e qualquer Encounter impedem mudança; tentativa de trocar autor/paciente/clínica falha. Testar lock e corrida reagendar/cancelar versus iniciar atendimento, sem alteração parcial. |
| 5 — Sincronizar React e validar telas pequenas | Mudança de papel/vínculo e 401/403 deixam UI e cache coerentes; ações contextuais funcionam por teclado e toque. | **T06:** testes de componentes com API simulada e E2E: acesso direto às URLs, restauração, 401→refresh→retry único, falha→login, 403 sem logout/refresh, ausência de retry de escrita, múltiplas chamadas 401, troca de clínica e papel com requests pendentes, limpar cache entre Users e impedir reutilização de agenda de papel anterior. **T12:** E2E em 320/360/390 px e desktop: sem overflow horizontal, botões atingíveis, labels/erros associados, ordem de foco, diálogo com foco contido/restaurado e Escape, teclado/zoom 200%, role alert/status, carregamento e estados sem permissão; executar verificador de acessibilidade e revisão de leitor de tela. Incluir agenda/calendário/formulários/cancelamento e não depender de hover. |
| 6 — Headers, sessão e regressão integrada | Garantir transporte, cache, origem e erros seguros sem regressão funcional. | **T07:** HTTP/artefato para headers em HTML/assets/API/erros, no-store sensível, ausência de fingerprints, CSP compatível, HSTS no HTTPS, origem permitida/proibida, namespace /api, dotfiles/backups/maps e ausência de stack/infra interna. **T09:** rotação/replay/refresh concorrente entre abas, logout falho/reload, cookies HttpOnly/Secure/Strict, header obrigatório e abuso com limites. **T10:** PostgreSQL isolado com tenants A/B e mesmo médico compartilhado: relações cruzadas rejeitadas, exclusão de horários, rollback da auditoria, corridas de inativação/papel/último ADMIN, logs com marcadores sintéticos sem conteúdo clínico. |

Cada etapa deve ser revisável separadamente e manter os módulos existentes funcionais. Alterações de modelo/banco, se futuramente necessárias, exigem escopo próprio; o plano imediato de resposta da agenda e autogestão não presume migrations. Não publicar nem alterar permissões em produção como efeito desta auditoria.

## 12. Verificações executadas nesta etapa

| Verificação | Resultado e alcance |
| --- | --- |
| Revisão estática | Controllers, decorators, Guards, serviços, entidades, DTOs, providers React, cliente HTTP, helpers de permissão, rotas, configuração e migrations existentes lidas. Nenhuma consulta ao banco. |
| `api/test/appointment-create-permissions.test.cjs` | **5/5 aprovados.** Executado via ts-node em memória, redirecionando imports de dist para src e aliases para fonte atual, sem rebuild; `DataSource.initialize` bloqueado. Cobre Guard de criação, criação própria, negação de outro profissional/clínica, ADMIN/RECEPTIONIST e conflito simulado. Não valida SQL, rollback real nem hidratação: o teste substitui `findById`. |
| `npm --prefix web test -- --reporter=dot` | **2/2 aprovados**, um arquivo `features/appointments/lib/appointment.test.ts`. Cobertura pontual de helper; não é suíte completa de React/segurança/acessibilidade. |
| Reprodução adicional A01/A02 em memória | Guard do detalhe, serviço e class-transformer da fonte atual, query simulada e entidades sintéticas: ADMIN e RECEPTIONIST receberam campo clínico; global sem vínculo recebeu 403 do serviço. Nada foi persistido. |
| Suítes não executadas | `system-admin-bootstrap.test.cjs` contém inicialização de PostgreSQL e preparação de banco; foi excluído desta etapa. `test-unified.cjs` testa artefato compilado e servidor local, mas não foi executado; não se atribui à fonte atual a validação histórica do artefato. Não houve build, migration, seed, conexão de banco, deploy ou ensaio no domínio publicado. |

## 13. Referências de orientação

As conclusões sobre a implementação vêm dos arquivos citados. Para a próxima fase, autorização explícita e validação por requisição seguem a orientação do [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). A configuração de cabeçalhos deve ser escolhida conforme a versão instalada e conferida na [documentação oficial de segurança HTTP do NestJS](https://docs.nestjs.com/security/helmet), sem assumir que uma API descrita para versões posteriores já exista no projeto.

**Status final:** auditoria entregue para revisão. Nenhuma recomendação ou ampliação de permissão foi aplicada automaticamente.
