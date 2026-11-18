# Correção A01 — resposta segura de agendamentos

Data: 18/11/2026. Referência: achado A01 de [auditoria-permissoes-qa.md](auditoria-permissoes-qa.md).

Correção implementada localmente e disponível para revisão antes do deploy. Escopo restrito ao contrato de saída dos agendamentos e aos testes de regressão correspondentes. Nenhuma migration, conexão/alteração no PostgreSQL, alteração de ambiente/credenciais ou deploy foi executado. Os testes usam exclusivamente dados sintéticos.

## 1. Causa

`AppointmentsService.findById` carregava `appointment.encounter` com `leftJoinAndSelect` e retornava a entidade integral. O relacionamento incluía anamnese, avaliação, plano, observações e medidas clínicas. ADMIN e RECEPTIONIST tinham autorização para consultar o agendamento e recebiam também esse conteúdo, mesmo sem autorização para consultar os endpoints clínicos.

O `ClassSerializerInterceptor` global não removia esses campos: a entidade Encounter não os exclui, pois eles são necessários nas respostas clínicas autorizadas. Esconder a ação de prontuário no React não protegia o JSON. A resposta de agenda precisava de seu próprio contrato, independente da entidade clínica.

## 2. Arquivos modificados e adicionados

| Arquivo | Alteração |
| --- | --- |
| `api/src/appointments/dto/appointment-response.dto.ts` | Novo contrato `AppointmentResponseDto` e mapper `toAppointmentResponse`, com lista explícita de campos em todos os níveis. |
| `api/src/appointments/appointments.service.ts` | Consulta compartilhada `responseQuery`; projeções mínimas das relações; listagem e detalhe usam o mapper. |
| `api/package.json` | Novo comando `test:appointments`, que compila e executa os testes de permissões existentes e a regressão HTTP de A01. Sem novas dependências. |
| `api/test/appointment-response-http.test.cjs` | Nova suíte com HTTP real Nest/Express/Supertest, JWT e RBAC reais, serialização global, serviços de agenda/atendimento/auditoria e persistência simulada em memória. Inclui geração de SQL TypeORM sem conexão. |
| `web/src/features/appointments/types/appointment.ts` | Tipo de resposta alinhado ao contrato mínimo de paciente/profissional e ao atendimento `{ id, status } | null`. |
| `web/src/features/appointments/lib/appointment-contract.test.ts` | Testes do contrato mínimo com os helpers de agenda/início de atendimento e o mapeamento para calendário. |
| `docs/correcao-a01.md` | Este registro da implementação e validação. |

O relatório de auditoria anterior foi preservado como registro da situação auditada. Não foram alterados controllers, Guards, decorators, entidades, DTOs de entrada, serviços clínicos ou componentes visuais.

## 3. Solução implementada

A proteção ocorre em duas camadas:

1. **Consulta:** `responseQuery` usa `leftJoin` com seleção somente de `encounter.id` e `encounter.status`. Não carrega conteúdo clínico da relação para montar uma resposta de agenda. Também seleciona somente os campos relacionados de paciente/profissional/User necessários às telas.
2. **Contrato de saída:** `toAppointmentResponse` constrói objetos novos campo a campo, inclusive objetos aninhados. Nenhuma entidade ou relação inteira é incorporada por referência ou spread. Mesmo se uma entidade hidratada contiver propriedades clínicas adicionais, elas não entram no JSON de agenda.

O atendimento vinculado é sempre representado por `encounter: { id, status }` ou `encounter: null`, para todos os perfis autorizados, inclusive OPHTHALMOLOGIST. Conteúdo clínico permanece nos endpoints clínicos existentes, com suas restrições e auditoria atuais. Não foram usados `@Exclude()` globais em Encounter, para preservar essas respostas clínicas.

### Campos efetivamente usados pelo front-end

| Consumidor | Campos de agenda/relações utilizados |
| --- | --- |
| `AppointmentsPage`, `AppointmentForm`, `CancelAppointmentDialog` | IDs/contexto, horários, duração, status da agenda, motivo/notas/cancelamento, `patient.name`, `professional.user.name`, CRM/UF. |
| `appointmentToEvent` e Calendário | ID, início/fim, status, nome do paciente e do profissional. |
| `canChange` | Status da agenda e existência de `encounter`. |
| `canStartEncounter`, `EncounterAppointmentAction` | `professional.userId`, contexto da clínica, status da agenda, existência do atendimento e `encounter.id` para abrir o prontuário. |

Os campos usados foram mantidos. `encounter.status` agora também faz parte do contrato TypeScript, sem exigir conteúdo clínico. Nenhuma tela dependia de anamnese, avaliação, plano, notas clínicas ou medidas dentro da resposta de agenda. As consultas próprias de pacientes/profissionais e as respostas clínicas mantêm seus contratos existentes.

### Retornos revisados

Base `/clinics/:clinicId/appointments`, com prefixo `/api` no modo unificado:

| Operação | Tratamento |
| --- | --- |
| `GET /` | Cada item de `data` passa pelo mapper; paginação preservada; inclui metadados mínimos do atendimento quando existente. |
| `GET /:id` | Projeção mínima e mapper obrigatório. |
| `POST /` | Mantém escrita/auditoria existentes e retorna por `findById`, usando o mesmo contrato seguro. |
| `PATCH /:id/reschedule` | Mantém regras de estado, lock, conflito e auditoria; retorno por `findById`. |
| `PATCH /:id/cancel` | Mantém regras de estado, lock e auditoria; retorno por `findById`. |
| `GET /availability` | Já construía resposta explícita com disponibilidade/período e conflito operacional; foi preservado e coberto por teste HTTP. |

Os helpers internos `findLockedForEncounter` e `saveWithManager` continuam trabalhando com entidades para o fluxo clínico transacional. Eles não foram substituídos pelo DTO público de agenda. As permissões de criação, consulta, reagendamento e cancelamento permanecem iguais: médico cria sua própria agenda, mas continua sem permissão para reagendar/cancelar pela API de agendamentos.

## 4. Contrato antes/depois — dados exclusivamente sintéticos

Antes, o detalhe podia incluir este trecho da entidade relacionada:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "IN_PROGRESS",
  "encounter": {
    "id": "22222222-2222-4222-8222-222222222222",
    "status": "IN_PROGRESS",
    "anamnesis": "ANAMNESE SINTÉTICA",
    "clinicalAssessment": "AVALIAÇÃO SINTÉTICA",
    "plan": "PLANO SINTÉTICO",
    "clinicalNotes": "OBSERVAÇÃO CLÍNICA SINTÉTICA",
    "intraocularPressureRight": 12
  }
}
```

Depois, o contrato completo de um agendamento com atendimento é:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "clinicId": "33333333-3333-4333-8333-333333333333",
  "patientId": "44444444-4444-4444-8444-444444444444",
  "professionalId": "55555555-5555-4555-8555-555555555555",
  "scheduledAt": "2027-01-10T13:00:00.000Z",
  "endsAt": "2027-01-10T13:30:00.000Z",
  "durationMinutes": 30,
  "status": "IN_PROGRESS",
  "reason": "Consulta sintética",
  "notes": "Nota operacional sintética",
  "cancellationReason": null,
  "cancelledAt": null,
  "createdAt": "2027-01-09T13:00:00.000Z",
  "updatedAt": "2027-01-10T13:00:00.000Z",
  "patient": {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "Paciente sintético"
  },
  "professional": {
    "id": "55555555-5555-4555-8555-555555555555",
    "userId": "66666666-6666-4666-8666-666666666666",
    "crm": "123456",
    "crmState": "SP",
    "user": {
      "id": "66666666-6666-4666-8666-666666666666",
      "name": "Médico sintético"
    }
  },
  "encounter": {
    "id": "22222222-2222-4222-8222-222222222222",
    "status": "IN_PROGRESS"
  }
}
```

Sem atendimento, `encounter` é `null`. A listagem mantém `{ data: [...], meta: { total, page, limit, totalPages } }` e aplica o mesmo contrato a cada item. Datas são serializadas para ISO pelo pipeline HTTP.

`reason`, `notes` e `cancellationReason` no nível do **agendamento** são campos operacionais já existentes e foram preservados. Não equivalem a `encounter.clinicalNotes` ou ao motivo clínico de cancelamento do atendimento. A correção controla a origem e os campos retornados; não classifica semanticamente texto livre inserido manualmente nesses campos operacionais.

## 5. Testes executados e resultados

| Comando/verificação | Resultado |
| --- | --- |
| `npm --prefix api run build` | Aprovado; TypeScript/Nest compilados sem erros. |
| `node --test test/appointment-create-permissions.test.cjs test/appointment-response-http.test.cjs` em `api/`, após build | **14/14 aprovados:** cinco testes de permissão existentes e nove novos testes de regressão. |
| `npm --prefix web test -- --reporter=dot` | **7/7 aprovados:** dois existentes e cinco novos testes de contrato/compatibilidade. |
| `npm --prefix web run build` | Aprovado; TypeScript e build Vite, incluindo os consumidores de Agendamentos, Calendário e Prontuários. |
| `npm --prefix api run lint` | Aprovado após ajuste de formatação na consulta. |
| `npm --prefix web run lint` | Aprovado. |
| `git diff --check` | Aprovado. |

O comando reprodutível da suíte de API é `npm --prefix api run test:appointments` (build seguido dos dois arquivos). A primeira tentativa no sandbox restrito não pôde abrir a porta local (`EPERM`); os testes HTTP foram executados novamente com permissão para loopback e passaram. Isso não envolveu publicação do servidor nem acesso externo.

### O que a regressão valida

- ADMIN, RECEPTIONIST e OPHTHALMOLOGIST recebem somente ID/status de atendimento em lista e detalhe, nos estados IN_PROGRESS, COMPLETED e CANCELLED, ou null quando ausente.
- Respostas HTTP de criação, reagendamento e cancelamento usam o contrato seguro, com notas operacionais e dados usados pelas telas preservados.
- Comparação das chaves exatas do JSON e marcadores sintéticos em campos clínicos/relações adicionais verifica que o mapper não deixa escapar conteúdo inesperado, incluindo informações de User e relações aninhadas.
- O Oftalmologista cria agenda própria, inicia atendimento, salva e consulta conteúdo clínico e conclui o atendimento pelos endpoints clínicos reais; a agenda mostra apenas metadados antes/depois da conclusão.
- ADMIN/RECEPTIONIST recebem 403 no detalhe clínico; outro médico recebe 404 no detalhe alheio; falta de JWT produz 401 e outra clínica é negada. O médico continua recebendo 403 para reagendar/cancelar agenda.
- `AuditService` real registra os eventos com repositório em memória; uma falha simulada na gravação da leitura clínica produz 503 e não devolve conteúdo clínico. A resposta operacional da agenda continua sem conteúdo de prontuário.
- O SQL gerado pelo QueryBuilder TypeORM real seleciona apenas `id` e `status` do alias Encounter. Essa verificação monta metadados sem inicializar conexão.
- Os helpers do React reconhecem atendimento existente e seus três estados sem dados clínicos, impedem início/reagendamento incompatíveis e mapeiam calendário usando relações mínimas.

### Alcance e limites

Os testes HTTP usam servidor Nest/Express real em `127.0.0.1`, controllers, DTOs/pipes, JwtStrategy, Guards, serviços, interceptor de serialização e JSON transmitido por HTTP. Não se limitam a chamar o mapper ou serializar objetos manualmente. Somente persistência e identidades/sessões são fornecidas por fixtures sintéticas em memória; `DataSource.initialize` é bloqueado explicitamente na suíte nova.

Não foi testada execução SQL contra PostgreSQL, hidratação com dados persistidos, locks/rollback reais ou plano de execução. Não foram executadas a suíte de bootstrap que prepara PostgreSQL nem a suíte unificada contra `deploy/`, pois esse artefato não foi reconstruído nesta etapa. Os resultados acima não são atribuídos ao artefato de deploy existente. Os novos testes não iniciam a aplicação de produção nem carregam AppModule/arquivos de ambiente.

## 6. Possíveis impactos

- Consumidores que dependiam de campos adicionais de Patient, ProfessionalProfile ou User dentro da resposta de agenda devem usar seus endpoints próprios. O React deste repositório foi ajustado nos tipos e passou no build sem depender desses campos.
- O conteúdo clínico completo deixa de aparecer na agenda inclusive para o médico: ele continua disponível pelos endpoints clínicos autorizados e auditados. Isso é intencional e elimina caminhos alternativos de leitura clínica não auditada por meio da agenda.
- A listagem passa a trazer metadados de atendimento de forma consistente com o detalhe, usando left join; agendamentos sem atendimento continuam sendo retornados. Como o relacionamento é um-para-um, não se espera multiplicação de itens; paginação/SQL real devem ser conferidos em homologação.
- Não houve alteração de layout, componentes, estilos, navegação ou formulários React. A abordagem mobile-first e os mecanismos existentes de acessibilidade/responsividade foram preservados; a validação visual em navegador permanece pendente.
- A02 e demais achados da auditoria permanecem fora deste escopo. Não houve ampliação de papéis, mudança do histórico compartilhado, gestão de perfil profissional, sessão ou cabeçalhos HTTP.

## 7. Pendências para homologação antes do deploy

1. Em ambiente de QA aprovado, validar a consulta/hidratação TypeORM com PostgreSQL e fixtures sintéticas, incluindo paginação, agenda sem atendimento e atendimentos em todos os estados. Nenhuma preparação desse ambiente foi executada nesta etapa.
2. Validar navegação visual Agendamentos → iniciar/abrir atendimento → concluir → agenda/Calendário; conferir mensagens, estados e cache após operações. Testar ADMIN e RECEPTIONIST sem conteúdo clínico no painel de rede.
3. Conferir telas de 320/360/390 px e desktop, teclado, foco/diálogos, zoom e leitor de tela. Os testes de helpers e o build não substituem esse ensaio de interface.
4. Verificar eventuais consumidores externos que utilizem campos removidos das relações de agenda; revisar o contrato acima antes de liberar.
5. Após revisão da correção, reconstruir e validar o artefato unificado com o processo de entrega do projeto. Não reutilizar o `deploy/` anterior como se já contivesse A01.

Status: **implementação local concluída; aguardando revisão técnica e homologação antes do deploy**.
