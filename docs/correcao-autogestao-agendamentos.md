# Autogestão dos próprios agendamentos pelo oftalmologista

## Diagnóstico e impactos identificados antes da implementação

Os endpoints PATCH `reschedule` e `cancel` e suas validações de serviço aceitam somente ADMIN e RECEPTIONIST. A criação e as consultas já permitem OPHTHALMOLOGIST com escopo próprio. `ProfessionalProfile` é global por usuário; sua elegibilidade na clínica exige usuário ativo, vínculo ativo de oftalmologista e clínica ativa, conforme `ProfessionalsService.findActiveForClinic`.

Reagendamento e cancelamento carregam o agendamento por ID e clínica, com `pessimistic_write`, dentro de transação. O início de atendimento usa o mesmo bloqueio na linha do agendamento. A alteração e o evento de auditoria são gravados na mesma transação. Estados diferentes de SCHEDULED/CONFIRMED e qualquer Encounter vinculado já impedem alterações. Conflitos abrangem a agenda global do profissional, inclusive em outras clínicas, sem expor seus detalhes. Os DTOs não permitem trocar profissional ou clínica; o ValidationPipe rejeita campos extras.

Impactos previstos: ampliar somente os dois endpoints para oftalmologistas, validar elegibilidade/autoria no serviço após o bloqueio e manter as permissões administrativas. A resposta A01 pode ser preservada sem campos adicionais: ela já informa usuário do profissional, clínica, estado e metadados do atendimento. O React precisa combinar esses dados para oferecer as ações. O calendário abre detalhes e não permite arrastar/redimensionar eventos; manter esse fluxo evita duplicar formulários. As invalidações existentes de agendamentos e calendário e o escopo de autorização A05 devem permanecer ativos.

Testes devem distinguir a coordenação simulada de transações da confirmação em PostgreSQL real: não será utilizado banco nesta etapa. Homologação de concorrência no banco isolado e validação visual em navegador serão explicitadas no relatório final.

## Regras implementadas

Somente os decorators de `PATCH /clinics/:clinicId/appointments/:id/reschedule` e `PATCH /clinics/:clinicId/appointments/:id/cancel` passaram a incluir OPHTHALMOLOGIST, além dos papéis administrativos existentes. Os demais endpoints e políticas globais não foram ampliados.

`AppointmentsService.reschedule` e `cancel` verificam o papel local do ator, independentemente do Guard. Dentro da transação, após `findLocked` carregar o registro por ID e clínica com bloqueio de escrita, o novo método `assertCanChangeOwnAppointment` aplica a regra para oftalmologistas:

1. Resolve o perfil atribuído no registro persistido usando `ProfessionalsService.findActiveForClinic`.
2. Exige perfil existente, usuário ativo, vínculo ativo de oftalmologista e clínica ativa, conforme as consultas existentes desse serviço.
3. Compara `professional.userId` com `currentUser.sub`; perfil de outro usuário resulta em 403.
4. Preserva as verificações seguintes de estado, atendimento vinculado, período e conflito.

A consulta de elegibilidade recebe o EntityManager da transação e usa seu repositório de ProfessionalProfile, incluindo o join de clínica ativa. Isso evita consumir uma segunda conexão enquanto a linha do agendamento está bloqueada. Para essa consulta transacional, perfil/vínculo/usuário/clínica sem elegibilidade resultam em 404; no HTTP, vínculo ou clínica inativos já são negados pela autenticação/autorização. Chamadores anteriores sem manager mantêm a validação de clínica e o comportamento existentes.

Não há interpretação de identificadores do body como autoria. Os DTOs de alteração não incluem `professionalId`, `clinicId` ou `patientId`; o ValidationPipe real rejeita esses campos extras. O registro continua vinculado à mesma clínica, paciente e profissional.

As permissões de ADMIN e RECEPTIONIST seguem o caminho anterior, sem exigir que possuam perfil profissional nem aplicar novas condições de elegibilidade a suas operações. System Admin sem papel local continua sem acesso clínico; a flag global não permite alterar agenda alheia quando o papel local é OPHTHALMOLOGIST.

### Estados, períodos e respostas

- Somente SCHEDULED e CONFIRMED permitem reagendar/cancelar.
- Qualquer Encounter vinculado impede as duas operações, inclusive atendimento concluído ou cancelado, mesmo que o estado do agendamento esteja inconsistente.
- Reagendamento exige horário futuro, fuso explícito e duração inteira de 5 a 480 minutos; a duração omitida conserva a atual. Mantém o profissional, verifica conflito na agenda global e retorna ao estado SCHEDULED.
- Cancelamento exige motivo de 3 a 500 caracteres após trim, registra `cancelledAt` e estado CANCELLED, conservando o registro e seu histórico.
- Permanecem a validação de sobreposição e o tratamento de violação de exclusão PostgreSQL (`23P01`) como 409. Uma sobreposição em outra clínica não revela o identificador daquele agendamento.
- A alteração e o `AuditService.record` recebem o mesmo EntityManager transacional. Falha na auditoria impede o commit.
- Continua sendo usado `findById` com projeção/DTO da A01: a resposta contém apenas `encounter: null` ou metadados `{ id, status }`, sem campos clínicos completos.

## Matriz de permissões antes/depois

Todas as permissões de alteração abaixo pressupõem estado permitido e ausência de atendimento.

| Ator e contexto | Criar antes/depois | Consultar antes/depois | Reagendar/cancelar antes | Reagendar/cancelar depois |
| --- | --- | --- | --- | --- |
| ADMIN local | Agenda da clínica | Agenda da clínica | Agenda da clínica | Sem alteração |
| RECEPTIONIST local | Agenda da clínica | Agenda da clínica | Agenda da clínica | Sem alteração |
| OPHTHALMOLOGIST com perfil elegível | Exclusivamente própria | Exclusivamente própria | Negado | Exclusivamente própria |
| OPHTHALMOLOGIST em agendamento de outro profissional | Negado | Fora do escopo | Negado | Negado; 403 na tentativa de alteração na clínica autorizada |
| Usuário sem vínculo ativo na clínica | Negado | Negado | Negado | Negado |
| System Admin sem vínculo clínico local | Negado | Negado | Negado | Negado |
| Ator vinculado a duas clínicas usando ID de agendamento A na rota B | Fora do escopo | Fora do escopo | Negado | 404, sem alteração |

Perfil ausente/inativo ou sem elegibilidade é rejeitado pela resolução existente de profissionais. Ausência de vínculo/papel local é rejeitada antes pelo JWT/Guard, e também pela verificação do ator no serviço. Não foram introduzidos múltiplos papéis por clínica ou perfis duplicados.

## Arquivos modificados

| Arquivo | Alteração |
| --- | --- |
| `api/src/appointments/appointments.controller.ts` | Amplia somente os dois decorators de alteração para OPHTHALMOLOGIST. |
| `api/src/appointments/appointments.service.ts` | Verifica elegibilidade/autoria após carregar e bloquear o registro; mantém os fluxos transacionais existentes. |
| `api/src/professionals/professionals.service.ts` | Permite reutilizar o EntityManager em `findActiveForClinic`, sem mudar os chamadores existentes ou regras de perfis globais. |
| `api/test/appointment-self-management.test.cjs` (novo) | 42 cenários HTTP/serviço para permissões, validações, rollback, auditoria e concorrência simulada. |
| `api/test/support/system-admin-fixture.cjs` | Modo opcional de simulação de bloqueio/rollback, falha de auditoria e correção do filtro `appointmentId` para consultas da entidade Appointment. |
| `api/test/appointment-response-http.test.cjs` | Inclui oftalmologista nas respostas HTTP seguras de criação/reagendamento/cancelamento; mantém a negativa para agenda alheia. |
| `api/test/system-admin-permissions.test.cjs` | Atualiza a expectativa da antiga restrição total para a regra própria/alheia, mantendo o teste da separação global/local. |
| `api/package.json` | Inclui a nova suíte nos comandos de testes de agendamento e regressões existentes. |
| `web/src/features/appointments/lib/appointment.ts` | Acrescenta `canManageAppointment`, com autoria, clínica, papel, estado e ausência de atendimento. |
| `web/src/features/appointments/pages/AppointmentsPage.tsx` | Aplica a decisão contextual às ações e à URL direta de reagendamento. |
| `web/src/features/appointments/lib/appointment.test.ts` | Testa a matriz contextual sem tornar OPHTHALMOLOGIST um administrador. |
| `web/src/features/appointments/pages/appointment-self-management.integration.test.tsx` (novo) | 12 cenários DOM com página, formulário, modal, cliente HTTP e hooks/cache reais. |
| `docs/correcao-autogestao-agendamentos.md` | Diagnóstico, implementação, evidências e pendências. |

Não foram alterados entidades, migrations, DTOs clínicos, profissionais globais, compartilhamento de prontuários, credenciais, `.env` ou dependências.

## Impactos no front-end e calendário

O helper administrativo `canManage` permanece restrito a ADMIN/RECEPTIONIST. O novo `canManageAppointment` é específico por agendamento: exige usuário autenticado, clínica ativa coincidente e estado/atendimento compatíveis; para OPHTHALMOLOGIST exige também correspondência do usuário e do perfil atribuído.

A tela de detalhes passa a oferecer **Reagendar** e **Cancelar agendamento** ao responsável autorizado. A URL direta `/agendamentos/:appointmentId/reagendar` usa a mesma decisão e não monta formulário em contexto proibido. O formulário existente de reagendamento não apresenta seleção de paciente/profissional e envia somente data/duração. O cancelamento usa o modal de confirmação e motivo já existente.

O calendário mantém o comportamento de abrir essa mesma tela de detalhes ao selecionar um evento. Não foram adicionadas ações inline, drag-and-drop nem redimensionamento. As consultas do calendário usam o prefixo `['appointments', clinicId]`, já invalidado pelas mutações, junto às listas e detalhes. Os testes montam o hook real do calendário em paralelo à página e verificam a atualização após as operações.

Não foi necessário alterar os mecanismos A05: wrappers de consultas/mutações, revisão da autorização, limpeza de cache e tratamento 401/403 permanecem intactos. As mutações continuam sem repetição automática. Um 403 continua acionando o bloqueio/revalidação de permissões previsto na A05.

## Testes executados e resultados

Todos os dados são sintéticos. Os testes HTTP executam NestJS/Express, JWT, Guards, ValidationPipe, serialização e serviços reais, com repositórios em memória. Não importam AppModule nem inicializam DataSource; a inicialização de banco é explicitamente proibida no fixture. A abertura temporária de HTTP em `127.0.0.1` exigiu execução fora da restrição de sockets do sandbox.

| Comando | Resultado final |
| --- | --- |
| `npm --prefix api run test:appointments` | Build da API e **57 testes aprovados**. |
| `npm --prefix api run test:professionals` | Build da API e **112 testes aprovados**, incluindo os 57 de agendamento e regressões A01/A06/A07/A02/A04. |
| `npm --prefix api run lint` | Aprovado. |
| `npm --prefix web test -- --reporter=dot` | **48 testes aprovados em 5 arquivos**, incluindo os 35 anteriores, 12 novos cenários de integração e 1 novo teste da matriz contextual. Preserva as regressões A05. |
| `npm --prefix web run build` | TypeScript e Vite aprovados. |
| `npm --prefix web run lint` | Aprovado. |
| `git diff --check` | Aprovado. |

As suítes de 57 e 112 se sobrepõem; não devem ser somadas como testes distintos.

### Cobertura dos cenários solicitados

| Cenários | Evidência |
| --- | --- |
| 1–2. Reagendar/cancelar consulta própria | HTTP 200, autoria, clínica e profissional preservados; transação e evento de auditoria corretos. |
| 3–4. Consulta de outro médico | HTTP e chamada direta do serviço retornam 403; dados e auditoria inalterados. |
| 5. Outra clínica | 403 sem vínculo; 404 para ID da clínica A na rota B mesmo com vínculos nas duas clínicas. |
| 6–7. Perfil ausente/vínculo inativo | Negativas no pipeline HTTP e no serviço, mesmo usando retrato de ator anteriormente válido. Também cobre usuário e clínica inativos. |
| 8–9. Cancelado/concluído | Ambas as operações retornam 400; inclui IN_PROGRESS e NO_SHOW. |
| 10–11. Atendimento em andamento/concluído | Bloqueio de ambas as operações mesmo se o agendamento estiver SCHEDULED; também cobre atendimento cancelado. |
| 12. Conflito | 409 por sobreposição em outra clínica e por violação de exclusão simulada; sem vazamento de ID nem alteração parcial. |
| 13–14. Data passada/duração inválida | 400 no HTTP real; inclui fuso ausente, data inválida, duração fracionária e fora de 5–480. |
| 15. Motivo ausente | 400 para motivo ausente, vazio, espaços, curto ou longo; trim no caso válido. |
| 16–17. Concorrência com início de atendimento | Quatro interleavings determinísticos em memória, usando os métodos reais e exigindo bloqueio no mesmo ID. Ver limites abaixo. |
| 18. ADMIN/RECEPTIONIST | Ambos continuam reagendando/cancelando agenda de outro usuário com resposta segura. |
| 19. Sem alterações parciais | Comparação de snapshots após negativas e após falha da auditoria; nova operação válida demonstra liberação do bloqueio. |
| 20. Auditoria | Ator, clínica, recurso, ação e metadados anteriores corretos; gravação pelo mesmo manager da alteração. |

Os testes React montam a página real, formulário e diálogo nativo em Happy DOM com QueryClient, cliente HTTP e hooks reais; somente os contextos de sessão/clínica e o servidor são sintéticos. Verificam ações por papel/autoria, URL direta proibida, confirmação/motivo, foco inicial do modal, payload limitado, feedback acessível de conflito, ausência de retry e atualização dos detalhes e do hook da agenda. As integrações completas de AuthProvider/ClinicProvider da A05 também continuam aprovadas.

## Concorrência e atomicidade: evidências e limites

O código de produção mantém transações TypeORM e `pessimistic_write` no agendamento. `EncountersService.start` adquire o mesmo registro antes de avaliar estado e criar o atendimento. Não foi necessário modificar o módulo clínico.

O simulador opcional de testes coordena a espera pelo bloqueio e snapshots/rollback, permitindo executar e conferir as duas ordens com métodos reais:

- **Atendimento primeiro:** a alteração espera, observa IN_PROGRESS e é rejeitada sem evento de reagendamento/cancelamento.
- **Cancelamento primeiro:** o início espera e é rejeitado ao observar CANCELLED; não cria atendimento.
- **Reagendamento primeiro:** o início espera e pode iniciar após o commit, conservando o novo horário/duração; não há alteração depois do início clínico.
- **Falha de auditoria:** a alteração é revertida; o lock é liberado para nova tentativa.

Esses testes verificam a coordenação solicitada pelo código, mas **não comprovam o comportamento real de locks, níveis de isolamento, deadlocks ou exclusão em PostgreSQL**. O fixture é limitado a esses interleavings no mesmo agendamento, sem reproduzir um banco multiusuário. A violação `23P01` é simulada. A confirmação em PostgreSQL isolado permanece para homologação.

A elegibilidade utiliza as consultas existentes de profissionais e o retrato de ator reconstruído pelo JWT em cada requisição. Não foram introduzidos bloqueios adicionais sobre vínculos/usuários para tornar uma revogação administrativa concorrente linearizável com a operação clínica; essa característica continua a do sistema existente.

## Mobile-first, acessibilidade e pendências de homologação

Não houve mudança visual nos componentes: permanecem botões com altura mínima de 44 px, ações em coluna em telas pequenas, formulário com `min-w-0`, diálogo com largura limitada ao viewport e rolagem vertical, foco nativo/modal e mensagens `role="alert"`/`role="status"`. A nova permissão reutiliza esses componentes.

Não foram executados E2E de navegador, testes com leitor de tela ou medições de layout. Não há runner de navegador disponível nesta execução. Happy DOM validou o foco inicial e os estados do diálogo, mas não substitui a validação real de teclado e responsividade.

Antes de publicar, homologar:

1. Telas **320, 360 e 390 px e desktop**: calendário → detalhes → reagendamento/cancelamento, sem overflow horizontal; toque, carregamento e feedback de sucesso/erro.
2. Teclado e leitor de tela: abrir diálogo, foco inicial, tabulação, Escape, retorno do foco, motivo obrigatório e anúncio das mensagens.
3. Duas contas de oftalmologista e duas clínicas com dados sintéticos: agenda própria permitida, alheia negada e ausência de troca de profissional/clínica.
4. ADMIN e RECEPTIONIST: criação, reagendamento, cancelamento e consultas continuam funcionando.
5. Mudança de papel/vínculo durante edição e sessão expirada/403: manter o bloqueio e isolamento A05, sem reenvio automático de escrita.
6. PostgreSQL de testes isolado: disputar os dois PATCH com início de atendimento usando conexões distintas, verificar locks, ausência de commits parciais/eventos órfãos e conflitos simultâneos entre reagendamentos. Não usar banco ou pacientes de produção.
7. Respostas HTTP: confirmar novamente contrato mínimo da A01 e headers/no-store A06 na hospedagem.

Implementação local para revisão. **Não foram executados migrations, alterações de dados reais, deploy ou publicação.**
