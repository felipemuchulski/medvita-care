# ExamsModule — contrato e regras do MVP

Implementado em 08/11/2026. Não há upload/anexos, equipamentos, DICOM, faturamento, IA ou CRUD administrativo do catálogo nesta etapa.

## Modelo e migration

- `exam_types`: catálogo global, código único, nome, descrição opcional, ativo e timestamps.
- `exams`: clínica, paciente, tipo, solicitante, atendimento opcional, lateralidade, status, datas, observações, resultado descritivo e justificativa de cancelamento.
- Migration `1794096000000-AddExams.ts`: cria enums, tabelas, catálogo de seis tipos, índices de clínica/solicitante/período, clínica/paciente/período, clínica/status/período e atendimento.
- Catálogo: OCT, Campimetria, Topografia corneana, Paquimetria, Biometria e Retinografia; seed `ON CONFLICT(code) DO NOTHING`. O frontend usa os UUIDs retornados pela API, nunca códigos presumidos como IDs.
- FKs compostas validam paciente + clínica e atendimento + clínica + paciente + solicitante, inclusive em escrita SQL direta. Índices únicos auxiliares nas tabelas existentes sustentam essas FKs. Nenhuma cascata de exclusão clínica.
- A migration não altera dados existentes; `down` remove apenas os objetos introduzidos, incluindo os registros novos de exames. Não usar rollback em um ambiente com exames reais sem planejamento e autorização.
- `synchronize` permanece desativado. A migration foi aplicada/revertida/reaplicada somente em PostgreSQL temporário de teste, sem acesso ao banco configurado na aplicação.

Para disponibilizar no seu banco de desenvolvimento, revisar a migration e executar a partir de `api`:

```sh
npm run migration:show
npm run migration:run
npm run start:dev
```

Não executar esse procedimento em produção sem autorização e preparação próprias de implantação.

## Autorização

Somente usuário ativo com perfil profissional, clínica ativa e vínculo OPHTHALMOLOGIST ativo pode consultar catálogo, solicitar e consultar exames. O service verifica o vínculo atual no banco, mesmo após o guard global. System Admin não recebe bypass clínico.

Cada oftalmologista só consulta e altera os exames **solicitados por ele** na clínica autorizada, inclusive no histórico do paciente. ADMIN, RECEPTIONIST e System Admin sem vínculo clínico elegível recebem 403. Outro solicitante ou outra clínica recebem 404 ao consultar um exame; não se revela a existência do registro fora do escopo.

A clínica vem da rota e é validada. Solicitante e data de solicitação são definidos no servidor. Não há `clinicId`, `requestedByProfessionalId`, `requestedAt` ou `status` editáveis no DTO. Campos extras são recusados pelo ValidationPipe existente.

Paciente precisa estar ativo e pertencer à clínica para criar uma solicitação. Atendimento associado deve pertencer ao mesmo paciente, clínica e profissional e não estar cancelado. A relação é opcional e não pode ser alterada depois da criação, assim como paciente, tipo e solicitante.

## HTTP

Prefixo: `/clinics/:clinicId/exams`. Todas as rotas usam Bearer token e UUID v4.

| Método | Caminho | Operação |
| --- | --- | --- |
| GET | `/types` | Catálogo ativo, ordenado por nome |
| POST | `/` | Criar solicitação, 201 |
| GET | `/` | Listar e filtrar solicitações autorizadas, 200 |
| GET | `/:id` | Detalhes autorizados, 200 |
| PATCH | `/:id` | Editar lateralidade/observações enquanto REQUESTED |
| PATCH | `/:id/result` | Salvar resultado; passa a IN_PROGRESS |
| PATCH | `/:id/complete` | Concluir, sem corpo |
| PATCH | `/:id/cancel` | Cancelar com justificativa |

### Criação

```json
{
  "patientId": "UUID v4",
  "examTypeId": "UUID v4 retornado pelo catálogo",
  "encounterId": "UUID v4 opcional",
  "laterality": "OD",
  "notes": "Texto opcional, até 4000 caracteres"
}
```

Lateralidades: OD (direito), OS (esquerdo), AO (ambos). `encounterId` pode ser omitido. Observações em branco são normalizadas para null.

### Edição

Corpo parcial: `laterality` e/ou `notes` (máximo 4000). Não admite null. Observações vazias removem o texto. Somente REQUESTED; retornar 409 em outros estados.

### Resultado

```json
{
  "performedAt": "2026-11-08T15:00:00-03:00",
  "resultText": "Resultado descritivo fictício"
}
```

Resultado não vazio, até 12000 caracteres. Data ISO com segundos e offset/Z; deve estar entre a solicitação e o momento atual. REQUESTED → IN_PROGRESS ao salvar o primeiro resultado. Pode atualizar o resultado em IN_PROGRESS, mantendo o estado. Não há conclusão implícita.

### Conclusão e cancelamento

IN_PROGRESS → COMPLETED exige resultado e realização já registrados. `completedAt` é definido no servidor.

REQUESTED ou IN_PROGRESS → CANCELLED exige `{ "reason": "Justificativa" }`, não vazia e até 2000 caracteres. Define `cancelledAt` e `cancellationReason`. Conteúdo anterior fica preservado no registro.

COMPLETED e CANCELLED são imutáveis e não podem ser reabertos. Não há exclusão de exames.

### Listagem

Query: `page` (1..1000000, padrão 1), `limit` (1..100, padrão 20), `patientId`, `encounterId`, `examTypeId`, `status`, `search` (até 150), `from`, `to`. Período inclusivo sobre `requestedAt`. Busca textual por nome do paciente ou tipo, sem interpretar curingas `%`/`_` digitados pelo usuário.

Ordenação estável por requestedAt e id descendentes. Exames de outros solicitantes nunca entram na listagem.

```text
{ data: ExamSummary[], meta: { total, page, limit, totalPages } }
```

`ExamSummary` inclui IDs de associação, lateralidade/status/datas/timestamps, `patient: {id,name}`, `examType: {id,code,name,isActive}`, `requestedByProfessional: {id,userId,crm,crmState,user:{id,name}}` e `encounter: {id,startedAt} | null`. Não inclui resultado, observações, CPF, e-mail ou credenciais.

Detalhes e respostas de mutação acrescentam `notes`, `resultText` e `cancellationReason`, que podem ser null. Somente propriedades selecionadas entram na resposta; a entidade User inteira não é carregada.

### Erros

- 400: DTO, enum, período ou data inválidos; atendimento cancelado.
- 401: autenticação ausente/expirada/inválida.
- 403: papel, perfil ou vínculo não elegíveis; clínica inativa.
- 404: paciente/tipo/atendimento inválido ou exame fora do escopo.
- 409: transição incompatível ou tentativa de editar registro finalizado.
- 503: impossibilidade de salvar/auditar. Erros SQL inesperados são sanitizados, sem expor parâmetros clínicos em logs.

## Transações, concorrência e auditoria

Criação e alterações usam transação; vínculos são verificados com bloqueios de leitura e o exame é bloqueado com `pessimistic_write` nas alterações. Conclusão e cancelamento concorrentes não podem ambos vencer.

Eventos: EXAM_REQUESTED, EXAM_UPDATED, EXAM_RESULT_RECORDED, EXAM_COMPLETED, EXAM_CANCELLED e EXAM_READ. Gravações usam AuditService e o mesmo EntityManager da transação. Ator, clínica, ação, recurso e UUID são registrados, sem resultados/observações/justificativas nos metadados.

Leituras de detalhes/listagem falham de forma fechada se não puderem ser auditadas. A resposta clínica de uma mutação também é auditada dentro da transação para evitar persistência silenciosa quando a auditoria da resposta falhar.

## Testes

Os arquivos de testes unitários e de integração e seus comandos npm foram removidos a pedido do responsável pelo projeto. Os resultados abaixo são o histórico das validações executadas antes da remoção, não uma suíte atualmente disponível no repositório.

Limitação preexistente: as migrations históricas do repositório não contêm a criação inicial de todas as tabelas de domínio. A suíte utilizada preparava o baseline em banco vazio a partir do SQL do metadata TypeORM (`createSchemaBuilder().log()`), sem `synchronize:true`, e só então executava `runMigrations`, `undoLastMigration` e `runMigrations` da nova migration. Isso testa sua execução e reversão contra a estrutura atual; não homologa um provisionamento completo via migrations históricas.

Executados: dois testes unitários de DTO/autorização e sete testes de integração HTTP com AppModule, autenticação JWT, guards, validação, auditoria e PostgreSQL 18 real. Cobrem criação, edição, resultados, conclusão/cancelamento, registros inválidos e de outra clínica/paciente, tipo inativo, perfil ausente, vínculos, papéis, propriedade do profissional, filtros/paginação, concorrência, FKs e rollback de auditoria. Somente dados fictícios.

Integração web/API/PostgreSQL validada também no Chromium; detalhes no README da feature web. Não há anexos nesta versão.
