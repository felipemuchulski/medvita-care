# MedVita Care — Implementação dos módulos finais do back-end

**Data:** 3 de novembro de 2026  
**Escopo:** `AppointmentsModule`, `EncountersModule`, `AuditModule` e integrações mínimas no diretório `api`  
**Resultado:** implementação concluída e validada estaticamente e por testes unitários temporários; persistência real ainda não homologada

## 1. Resumo executivo

Os três módulos finais do fluxo principal do MVP foram implementados:

- agendamentos com paginação, filtros, disponibilidade, reagendamento, cancelamento e proteção concorrente contra sobreposição;
- atendimentos clínicos iniciados a partir da agenda, com dados oftalmológicos, transições controladas, histórico do paciente e conclusão transacional;
- auditoria imutável e consultável por clínica, integrada a autenticação, pacientes, vínculos, agendamentos e atendimentos.

O fluxo implementado é:

```text
Paciente + profissional ativos na clínica
                  ↓
        Agendamento sem conflito
                  ↓
     Atendimento pelo profissional designado
                  ↓
      Registro clínico em andamento
                  ↓
Conclusão transacional do atendimento e da agenda
                  ↓
     Histórico clínico + trilha de auditoria
```

Não foram criados endpoints para concluir diretamente um agendamento. O estado `COMPLETED` da agenda somente é aplicado pelo fluxo válido de conclusão do atendimento.

## 2. Diagnóstico inicial

As entidades `Appointment` e `Encounter`, seus enums, relações e módulos TypeORM já existiam. Entretanto, os módulos não possuíam DTOs, services, controllers ou casos de uso HTTP. Não existiam entidade, service ou módulo de auditoria, nem uma estrutura separada de prontuário/`Record`.

Foram preservados:

- os estados existentes de agendamento e atendimento;
- `scheduledAt` e `durationMinutes` do modelo de agenda;
- a relação global `ProfessionalProfile -> User` e os vínculos por clínica;
- o relacionamento único entre atendimento e agendamento;
- o guard global, os decorators de papéis e o `ValidationPipe` com whitelist;
- `synchronize: false` e a estratégia de migrations do projeto.

Como não havia entidade de prontuário, os campos clínicos mínimos foram adicionados ao próprio `Encounter`. Isso evita criar um módulo adicional e mantém os dados vinculados ao atendimento que lhes dá contexto.

## 3. Arquivos criados e modificados

### 3.1. Criados

| Caminho | Responsabilidade |
| --- | --- |
| `src/appointments/appointments.controller.ts` | Endpoints da agenda |
| `src/appointments/appointments.service.ts` | Regras, escopo, conflitos e transações da agenda |
| `src/appointments/dto/*` | Criação, listagem, disponibilidade, reagendamento e cancelamento |
| `src/encounters/encounters.controller.ts` | Endpoints clínicos e histórico do paciente |
| `src/encounters/encounters.service.ts` | Fluxo clínico, transições e integração transacional com a agenda |
| `src/encounters/dto/*` | Início, atualização, conclusão, filtros e cancelamento |
| `src/audit/audit.module.ts` | Composição do módulo reutilizável |
| `src/audit/audit.controller.ts` | Consulta controlada da trilha |
| `src/audit/audit.service.ts` | Escrita, consulta, saneamento e política de falha de auditoria |
| `src/audit/entities/audit-log.entity.ts` | Registro imutável de auditoria |
| `src/audit/dto/list-audit-logs-query.dto.ts` | Filtros e paginação da auditoria |
| `src/database/migrations/1793692800000-AddClinicalOperationsAndAudit.ts` | Evolução do schema e proteção concorrente |
| `docs/relatorio-modulos-finais-backend-2026-11-03.md` | Este relatório |

### 3.2. Modificados

- `src/app.module.ts`: registro do `AuditModule`;
- entidades de agenda e atendimento: novos campos compatíveis com o MVP;
- módulos de agenda e atendimento: controllers, providers, imports e exports;
- `ProfessionalsService`: consulta interna de profissional ativo por clínica;
- `database-error.util.ts`: identificação da violação PostgreSQL `23P01`;
- `AuthModule`/`AuthService`: auditoria de login válido, inválido e logout;
- `PatientsModule`/`PatientsService`: auditoria transacional de escrita e auditoria obrigatória de leitura;
- `ClinicUsersModule`, controller e service: auditoria transacional de criação, papel e status do vínculo.

Nenhum arquivo do diretório `web` foi modificado por esta implementação. As alterações já existentes em `../web/src/App.tsx` e `../web/src/features/` foram preservadas.

## 4. Entidades e banco de dados

### 4.1. Appointment

Foram acrescentados:

- `endsAt` (`timestamptz`), calculado a partir de `scheduledAt + durationMinutes`;
- `cancellationReason`;
- `cancelledAt`.

A migration cria:

- check `scheduled_at < ends_at`;
- duração entre 5 e 480 minutos;
- índice por clínica e data;
- extensão `btree_gist`;
- exclusion constraint GiST global por profissional:

```sql
EXCLUDE USING gist (
  professional_id WITH =,
  tstzrange(scheduled_at, ends_at, '[)') WITH &&
)
WHERE status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
```

O intervalo `[)` permite consultas consecutivas, mas rejeita qualquer sobreposição real. A constraint protege também duas requisições simultâneas que passem pela verificação prévia do service.

### 4.2. Encounter

O atendimento continua possuindo exatamente um `appointmentId` pela constraint única existente. Foram adicionados os campos:

- queixa principal e anamnese;
- acuidade visual OD/OS;
- pressão intraocular OD/OS;
- avaliação clínica;
- conduta (`plan`);
- justificativa de cancelamento.

`startedAt` e `finishedAt` representam início e término. `finishedAt` é preenchido tanto na conclusão quanto no cancelamento, enquanto o status diferencia o resultado.

### 4.3. AuditLog

O log possui `id`, `actorId`, `clinicId`, `action`, `resourceType`, `resourceId`, `metadata` JSONB e `createdAt`. Não possui `updatedAt`, endpoints de alteração ou exclusão. Índices atendem consultas por clínica/data, ator/data e recurso.

Não foram criadas FKs para ator/recurso no log para que exclusões administrativas futuras não eliminem nem invalidem a trilha histórica.

## 5. Endpoints disponíveis

Todas as rotas exigem access token JWT e `clinicId` UUID v4 no caminho.

### 5.1. Agendamentos

| Método | Rota | Finalidade | Papéis |
| --- | --- | --- | --- |
| `POST` | `/clinics/:clinicId/appointments` | Criar | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/clinics/:clinicId/appointments` | Listar e filtrar | `ADMIN`, `RECEPTIONIST`, `OPHTHALMOLOGIST` próprio |
| `GET` | `/clinics/:clinicId/appointments/availability` | Verificar um período | mesmos papéis; oftalmologista somente o próprio |
| `GET` | `/clinics/:clinicId/appointments/:id` | Consultar | mesmos papéis e escopo |
| `PATCH` | `/clinics/:clinicId/appointments/:id/reschedule` | Reagendar | `ADMIN`, `RECEPTIONIST` |
| `PATCH` | `/clinics/:clinicId/appointments/:id/cancel` | Cancelar com justificativa | `ADMIN`, `RECEPTIONIST` |

Criação:

```json
{
  "patientId": "UUID",
  "professionalId": "UUID",
  "scheduledAt": "2026-11-10T09:00:00-03:00",
  "durationMinutes": 30,
  "reason": "Consulta de rotina",
  "notes": "Retorno anual"
}
```

Filtros de listagem: `page`, `limit`, `patientId`, `professionalId`, `status`, `from` e `to`.

Disponibilidade:

```http
GET /clinics/:clinicId/appointments/availability?professionalId=UUID&scheduledAt=2026-11-10T09:00:00-03:00&durationMinutes=30
```

Cancelamento:

```json
{ "reason": "Paciente solicitou cancelamento" }
```

### 5.2. Atendimentos

Os dados clínicos são restritos a usuários com vínculo ativo `OPHTHALMOLOGIST`. Escrita, conclusão e cancelamento exigem que o usuário seja o profissional designado no agendamento.

| Método | Rota | Finalidade |
| --- | --- | --- |
| `POST` | `/clinics/:clinicId/encounters` | Iniciar pelo agendamento |
| `GET` | `/clinics/:clinicId/encounters` | Listar os atendimentos do profissional |
| `GET` | `/clinics/:clinicId/encounters/:id` | Consultar atendimento próprio |
| `PATCH` | `/clinics/:clinicId/encounters/:id` | Salvar dados durante `IN_PROGRESS` |
| `PATCH` | `/clinics/:clinicId/encounters/:id/complete` | Validar e concluir |
| `PATCH` | `/clinics/:clinicId/encounters/:id/cancel` | Cancelar com justificativa |
| `GET` | `/clinics/:clinicId/patients/:patientId/encounters` | Histórico clínico do paciente na clínica |

Início:

```json
{ "appointmentId": "UUID" }
```

Atualização/conclusão:

```json
{
  "chiefComplaint": "Baixa de acuidade visual",
  "anamnesis": "Evolução há três meses",
  "visualAcuityRight": "20/40",
  "visualAcuityLeft": "20/30",
  "intraocularPressureRight": 15.5,
  "intraocularPressureLeft": 16,
  "clinicalAssessment": "Miopia",
  "plan": "Correção óptica e retorno em 12 meses",
  "clinicalNotes": "Observação complementar opcional"
}
```

Queixa principal, avaliação clínica e conduta são obrigatórias na conclusão. Os demais campos podem ser preenchidos durante o atendimento.

Filtros: `page`, `limit`, `patientId`, `professionalId`, `status`, `from` e `to`.

### 5.3. Auditoria

| Método | Rota | Finalidade | Papel |
| --- | --- | --- | --- |
| `GET` | `/clinics/:clinicId/audit-logs` | Consultar logs da clínica | `ADMIN` vinculado |

Filtros: `page`, `limit`, `action`, `actorId`, `resourceType`, `resourceId`, `from` e `to`.

## 6. Regras de negócio implementadas

### Agenda

- paciente ativo e pertencente à clínica;
- clínica e profissional/vínculo ativos;
- datas de entrada com fuso explícito;
- duração limitada e término posterior ao início;
- conflito verificado no service e no PostgreSQL;
- conflito do mesmo profissional considerado inclusive entre clínicas;
- somente estados `SCHEDULED`, `CONFIRMED` e `IN_PROGRESS` ocupam agenda;
- estado terminal ou atendimento existente bloqueia reagendamento/cancelamento;
- justificativa e histórico preservados no cancelamento;
- conclusão pública direta inexistente.

### Atendimento

- criado exclusivamente de agendamento válido da mesma clínica;
- paciente e profissional herdados da agenda, sem entrada manipulável no DTO;
- unicidade por agendamento protegida pelo banco e pelo service;
- somente profissional designado inicia, altera, conclui ou cancela;
- dados clínicos editáveis somente em `IN_PROGRESS`;
- conclusão duplicada, edição terminal e cancelamento após conclusão bloqueados;
- conclusão atualiza atendimento e agendamento na mesma transação;
- registros concluídos não podem ser sobrescritos pelos endpoints atuais;
- histórico do paciente isolado pela clínica e auditado.

### Auditoria

- escritas críticas e seus logs usam a mesma transação TypeORM;
- leituras de paciente e prontuário são bloqueadas com `503` quando não podem ser auditadas;
- login/logout usam registro independente em melhor esforço para não criar sessão válida e devolver erro ao cliente por falha posterior do log;
- chaves relacionadas a senha, segredo, token, hash e conteúdo clínico são removidas de `metadata`;
- não há atualização ou exclusão pública de logs.

## 7. Segurança e autorização

O `AuthorizationGuard` continua sendo a primeira camada. Os services clínicos repetem o escopo obrigatório por `clinicId`, pois o guard permite bypass ao administrador global.

Para pacientes, agenda, atendimento e consulta de auditoria, um administrador global sem vínculo ativo com a clínica não recebe acesso automático. Isso evita acesso transversal a dados pessoais e clínicos. Identificadores de outra clínica retornam ausência ou proibição sem revelar o recurso.

Oftalmologistas consultam a própria agenda e os próprios atendimentos. O histórico clínico completo do paciente pode ser consultado por oftalmologista ativo da mesma clínica para continuidade assistencial; cada acesso é registrado antes da resposta.

## 8. Testes e validações

### 8.1. Executados

| Verificação | Resultado |
| --- | --- |
| Testes temporários Jest/ESM | 19 aprovados em 3 suítes |
| Regras de agenda e intervalos consecutivos | Aprovadas |
| Violação concorrente `23P01` -> `409` | Aprovada |
| SQL da migration contém GiST/exclusion/range `[)` | Aprovado por inspeção executável |
| Transição início/conclusão atendimento-agenda | Aprovada com transação simulada |
| Unicidade do atendimento | Aprovada no service/mocks |
| Campos mínimos e bloqueio de edição terminal | Aprovados |
| Saneamento e isolamento da auditoria | Aprovados |
| Falha fechada em leitura clínica | Aprovada |
| `npm.cmd run lint` | Aprovado |
| `npm.cmd run build` | Aprovado |
| Inicialização Nest e resolução de dependências | Aprovada |
| Registro das 14 novas rotas | Aprovado |
| `migration:show` | Executado em modo somente leitura |

Os arquivos temporários de teste foram removidos após o registro dos resultados neste relatório.

### 8.2. Persistência

Não foi executada escrita no PostgreSQL configurado. A conexão somente leitura identificou o banco principal `medvita`; o usuário possui permissão para objetos no banco, mas não possui `CREATEDB`. O daemon Docker também não está disponível. Portanto, não havia PostgreSQL descartável seguro.

Estado observado por `migration:show`:

```text
[ ] EnableUuidOsspExtension1792265281000
[X] AddIsSystemAdminToUsers1792265281923
[ ] AddAuthSessionsAndTokenRevocation1793210400000
[ ] AddClinicalOperationsAndAudit1793692800000
```

A migration nova não foi executada no banco principal. A constraint GiST e as transações ainda precisam de homologação em PostgreSQL descartável.

## 9. Pendências

1. Executar todas as migrations pendentes em ambiente descartável antes do deploy.
2. Verificar se não há agendamentos antigos sobrepostos antes de criar a exclusion constraint; dados conflitantes farão a migration falhar corretamente.
3. Garantir permissão para instalar `btree_gist` no ambiente de destino.
4. Homologar concorrência real com duas transações PostgreSQL simultâneas.
5. Transformar as suítes temporárias em testes permanentes e adicionar script `test`/CI.
6. Definir política operacional de retenção, exportação e monitoramento dos logs de auditoria conforme LGPD.
7. Considerar futuramente um fluxo versionado de retificação clínica; o MVP atual bloqueia edição após conclusão.

## 10. Preparação para o front-end

- o React deve manter a clínica ativa e sempre enviar `clinicId` no caminho;
- datas devem ser enviadas em ISO 8601 com `Z` ou offset, nunca como data local sem fuso;
- listagens retornam `{ data, meta: { total, page, limit, totalPages } }`;
- `409` na agenda representa conflito de horário ou atendimento duplicado;
- `400` representa DTO/transição inválida; `403`, papel ou clínica não autorizados; `404`, recurso fora do escopo;
- disponibilidade retorna `available`, `period` e detalhes do conflito somente quando ele pertence à mesma clínica;
- a tela clínica deve salvar rascunhos pelo `PATCH` comum e concluir somente pela rota `/complete`;
- após concluir, a interface deve tornar o prontuário somente leitura;
- administradores podem consultar auditoria, mas não alterá-la;
- o frontend não deve oferecer ações clínicas para recepção ou administração.

## Conclusão

Os módulos finais estão implementados, integrados e compilando, com regras centrais validadas por testes unitários e inicialização real da aplicação. O código está pronto para a próxima etapa de homologação, mas ainda não deve ser declarado pronto para produção enquanto a migration, a persistência e a concorrência não forem validadas em PostgreSQL descartável.
