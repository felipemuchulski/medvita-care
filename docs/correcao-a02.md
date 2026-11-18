# Correção A02 — permissões explícitas do System Admin

Data: 18/11/2026. Escopo exclusivo A02; A01, A06 e A07 preservadas. Análise anterior às alterações realizada sobre Guard, decorators, JWT strategy, entidades User/ClinicUser e serviços de usuários, clínicas, vínculos, profissionais, pacientes, agenda, atendimentos, exames e auditoria.

## 1. Problema e comportamento anterior

`AuthorizationGuard` liberava qualquer política privada reconhecida quando `request.user.isSystemAdmin` era true. A07 já impedia endpoints sem política, mas o bypass continuava aplicável a qualquer `@ClinicRoles()` ou `@Roles()` válido.

Os serviços de pacientes, agendamentos, atendimentos, exames e auditoria exigiam papéis locais, clínica e/ou autoria e negavam o global sem vínculo; o Guard, entretanto, o aceitava. Clínicas e vínculos dependiam de seus controllers para autorização do ator. Usuários globais tinham gestão protegida pelo controller; helpers internos também são usados na autenticação e nos demais módulos.

Outros usos da flag identificados:

- `ProfessionalsService.assertCanManage`, `applyReadScope` e `assertCanReadUser`: acesso ao **cadastro administrativo profissional**, não a prontuários/exames. Preservado conforme política existente e restrição de não implementar A04.
- `UsersController.updatePassword` e `ClinicUsersController.findByUser`: exceções self/global explícitas. A troca de senha por ID continua exigindo a senha atual do alvo.
- UserService invalida tokenVersion em mudança de flag global; AuthService/JwtStrategy carregam a flag atual do User. Seed/bootstrap usa a flag para criar/validar a identidade global. Não são bypasses de autorização clínica e não precisam de mudança.
- No React, a flag controla telas administrativas de usuários/clínicas/equipe e cadastro profissional; não concede permissão ao backend. Não foi identificado motivo para mudar a interface nesta etapa.

## 2. Matriz de permissões antes/depois

S = System Admin sem vínculo; S+A/S+O = global com vínculo local ADMIN/OPHTHALMOLOGIST. Vínculos, Users e clínicas ativos são reavaliados na autenticação. Um único papel por User/clínica permanece.

| Operação | Antes | Depois desejado nesta etapa |
| --- | --- | --- |
| Gerenciar Users globais | Apenas global no controller | Global explícito também no serviço; papéis locais não bastam |
| Criar/listar clínicas, buscar documento, alterar atividade | Global no controller | Global explícito também no serviço |
| Consultar/editar cadastro da clínica | Global por bypass ou papel local adequado | Global ou papel local explicitamente declarados; validação também no serviço |
| Criar/alterar vínculos; listar equipe | Global por bypass ou papel local adequado | Global ou papel local explicitamente declarados; validação também no serviço |
| Consultar vínculos de um User | Próprio ou global no controller | Mesma regra também no serviço |
| Cadastro de ProfessionalProfile | Global por bypass no Guard e exceções explícitas no serviço; papéis locais conforme operação | Mesmo acesso administrativo, declarado no endpoint; gestão global do perfil não redesenhada (A04) |
| Pacientes e agenda, S sem vínculo | Guard permite; serviço nega | Guard e serviço negam |
| Pacientes e agenda, S+A | Conforme ADMIN local nos serviços | Mesma política local, sem efeito da flag global |
| Pacientes e agenda, S+O | Conforme OPHTHALMOLOGIST local, agenda própria | Mesma política local e autoria |
| Prontuários/atos médicos, S ou S+A | Guard permite; serviço nega | Guard e serviço negam |
| Prontuários/atos médicos, S+O | Serviço exige autoria/escopo | Mesma exigência; global não amplia o escopo |
| Exames, S ou S+A | Guard permite; serviço nega | Guard e serviço negam |
| Exames, S+O | Perfil elegível, clínica e profissional solicitante | Mesmas condições |
| Audit-logs, S sem vínculo ou S+O | Guard permite; serviço exige ADMIN local | Guard e serviço exigem ADMIN local |
| Audit-logs, S+A ou ADMIN local | Permitido na própria clínica | Mesmo comportamento |
| ADMIN/RECEPTIONIST/OPHTHALMOLOGIST sem flag global | Papéis locais e autoria, sem gestão global de Users/clínicas | Mesmas permissões |
| Usuário sem vínculo/inativo ou clínica inativa | JWT remove vínculos inativos; serviços validam estados | Sem ampliação; gestão global administrativa mantém exceções existentes para administrar clínicas inativas |

Histórico clínico compartilhado da clínica, regras de estado, A01 e A06 permanecem fora das mudanças de comportamento. Não existe concessão de acesso clínico global.

## 3. Política implementada e alterações no Guard

O retorno universal por `isSystemAdmin` foi removido. O Guard diferencia:

- `@SystemAdmin()`: exige a flag global para gestão global. ADMIN de clínica não a satisfaz.
- `@ClinicRoles()` / `@Roles()`: exige os papéis locais e a clínica correta **mesmo quando o User é System Admin**.
- `@SystemAdminOrClinicRoles(param, ...roles)`: nova alternativa explícita, exclusivamente em endpoints administrativos selecionados. Permite a flag global **ou** o papel local informado. Compõe os metadados de ClinicRoles, sem alterar o comportamento desse decorator nos demais módulos.
- `@Authenticated()` e `@Public()`: continuam com o significado de A07; ausência de política, lista vazia de papéis e configurações contraditórias continuam negadas.

O novo decorator é declarado como MethodDecorator e sua permissão global é lida somente no handler, não herdada da classe. Não foi criado bypass por controller. Se uma política combinar SystemAdmin e papéis locais por chaves diferentes, ambas as restrições são exigidas; uma combinação não apaga a outra. Não existia essa combinação nos endpoints de produção, mas há teste para impedir regressão futura. A alternativa OR deve ser declarada pelo novo decorator; misturá-lo com SystemAdmin é inválido.

### Exceções globais administrativas explícitas

São **12 handlers**, todos com o mesmo acesso efetivo administrativo que já existia:

| Controller | Métodos / endpoints |
| --- | --- |
| ClinicController | `findById`: GET /clinics/:id; `update`: PATCH /clinics/:id |
| ClinicUsersController | `create`: POST /clinics/:clinicId/users; `findByClinic`: GET mesma base; `updateRole`: PATCH .../:userId/role; `updateActive`: PATCH .../:userId/active |
| ProfessionalsController | `create`, `findByClinic`, `findByUser`, `findByCrm`, `findById`, `update`: POST/GET /clinics/:clinicId/professionals, GET .../user/:userId, GET .../crm/:crm/:crmState, GET .../:id e PATCH .../:id |

Os nove endpoints globais de Users/Clinics que já usavam SystemAdmin continuam com esse decorator. As demais **27 rotas por papéis locais** não têm a exceção global: pacientes, agenda, atendimentos, exames e auditoria. O inventário total continua em **54 endpoints e 10 controllers** (2 públicos, 4 Authenticated, 9 SystemAdmin, 12 administrativos mistos e 27 locais).

Consultas de vínculos do próprio User e alteração de senha por ID conservam suas exceções self/global explícitas, além de Authenticated. Não se tornaram rotas públicas, e a senha atual do alvo continua necessária para alterá-la.

## 4. Autorização nos serviços

Foi criado `common/authorization/administrative-access.ts`, com funções sem acesso ao banco:

- `assertSystemAdmin`: verifica identidade global nas operações administrativas globais.
- `assertAdministrativeClinicAccess`: verifica global ou papel local na clínica indicada, exclusivamente para operações administrativas. Não é usado por serviços clínicos.

As funções recebem `AuthenticatedUser`, que vem da JwtStrategy: papéis são recarregados e filtrados por User, vínculo e clínica ativos a cada autenticação. Não substituem o JWT Guard nem tornam confiável um objeto recebido no body. Não adicionam revalidação transacional de revogações ocorridas no meio de uma requisição, que continua sendo uma limitação independente.

| Serviço | Alteração/controle |
| --- | --- |
| UserService | `createUser`, `findAll`, `updateUser` e `updateActive` agora exigem ator global. Novo `findByIdForAdmin` protege o GET administrativo por ID. |
| ClinicService | `create`, `findAll`, `findByDocument` e `updateActive` exigem ator global. `updateClinic` exige global ou ADMIN da clínica. Novo `findByIdForUser` exige global ou vínculo local de leitura. |
| ClinicUsersService | Criação/mudança de papel/status exigem global ou ADMIN local; listagem da equipe exige global ou um dos três papéis locais; `findByUser` repete a checagem self/global também no serviço. Preservados locks, último ADMIN, atividade dos alvos e auditoria. |
| ProfessionalsService | Sem mudança de implementação: já possui exceções globais administrativas explícitas e filtros de elegibilidade do perfil. O controller agora declara a mesma política. Nenhuma remodelagem de A04. |
| PatientsService, AppointmentsService, EncountersService, ExamsService, AuditService | Sem mudança de implementação: continuam exigindo seus papéis locais, clínica/autoria/estado e auditoria conforme a operação. O Guard agora concorda com eles. |

`UserService.findById/findByEmail/findForAuthentication/updatePassword` e `ClinicService.findById/findByEmail` continuam sendo operações internas usadas pela autenticação/validação de recursos. Não foram indiscriminadamente convertidos em endpoints globais nem tiveram seus contratos internos quebrados. Os controllers de GET administrativo usam as novas entradas autorizadas; os helpers internos não devem ser expostos em novas rotas sem política e checagem de escopo.

As assinaturas dos métodos administrativos que passaram a exigir ator foram atualizadas nos controllers. O build confirma os chamadores TypeScript do repositório. Chamadas internas futuras devem fornecer a identidade autenticada ou usar o helper interno apropriado, e não fabricar uma identidade global para evitar a validação.

## 5. Arquivos modificados

| Arquivo | Finalidade |
| --- | --- |
| `api/src/auth/guards/authorization.guard.ts` | Retira bypass universal; diferencia políticas globais, locais e administrativas OR. |
| `api/src/common/decorators/system-admin-or-clinic-roles.decorator.ts` | Novo decorator administrativo por handler. |
| `api/src/common/authorization/administrative-access.ts` | Verificações administrativas explícitas usadas nos serviços. |
| `api/src/users/users.controller.ts`, `api/src/users/user.service.ts` | Passagem do ator e autorização global nos métodos administrativos. |
| `api/src/clinics/clinics.controller.ts`, `api/src/clinics/clinics.service.ts` | Política explícita de leitura/gestão global ou local e verificações no serviço. |
| `api/src/clinic-users/clinic-users.controller.ts`, `api/src/clinic-users/clinic-users.service.ts` | Política explícita da equipe e validação do ator/identidade no serviço. |
| `api/src/professionals/professionals.controller.ts` | Substitui os decorators por alternativas administrativas explícitas, mantendo os papéis originais. |
| `api/test/system-admin-permissions.test.cjs` | Matriz de integração HTTP de nove módulos, controllers/serviços reais e persistência em memória. |
| `api/test/authorization-guard.test.cjs`, `api/test/authorization-http.test.cjs` | Atualiza somente expectativas do bypass antigo e testa as novas alternativas/restrições. |
| `api/test/route-policy-coverage.test.cjs` | Mantém cobertura A07 e adiciona allowlist dos 12 handlers; proíbe exceção global por classe ou em rota não aprovada e verifica negação global em políticas locais. |
| `api/package.json` | Adiciona `test:system-admin-permissions`, com build e todas as regressões pertinentes. Sem novas dependências. |
| `docs/correcao-a02.md` | Este relatório; os relatórios anteriores foram preservados como registros históricos. |

Não foram alterados os serviços/DTOs de agendamentos A01, middleware HTTP A06, decorator Authenticated/negação por padrão de A07, serviços clínicos, serviços de perfis profissionais, entidades, migrations, ambiente/credenciais ou React.

## 6. Testes e evidências

Comando completo:

```sh
npm --prefix api run test:system-admin-permissions
```

Os testes usam dados sintéticos e servidor HTTP/HTTPS em loopback, com a permissão necessária do ambiente. A suíte nova instancia os controllers e serviços de produção de Users, Clinics, ClinicUsers, Professionals, Patients, Appointments, Encounters, Exams e Audit. O repositório TypeORM é substituído por mapas/query builders em memória; a JwtStrategy real recarrega Users/vínculos dessas fixtures e valida JWTs sintéticos. `DataSource.initialize` é bloqueado.

| Verificação | Resultado |
| --- | --- |
| Build da API, incluído no comando completo | Aprovado. |
| Lint da API | Aprovado. |
| Matriz nova A02 | **13/13 testes aprovados**, abrangendo múltiplas requisições por perfil/módulo. |
| Regressões A01, A06, A07 e cobertura de rotas | **48/48 testes aprovados**, com expectativas antigas de bypass ajustadas à política A02. |
| Total de testes da API | **61 testes**, incluindo a matriz nova e regressões. |
| Cobertura de políticas | **54 endpoints em 10 controllers**, sem política ausente ou exceção global fora da allowlist. |
| Testes React (`npm --prefix web test -- --reporter=dot`) | **7/7 aprovados.** |
| Build React (`npm --prefix web run build`) | Aprovado; React/FullCalendar e TypeScript. |
| `git diff --check` | Aprovado. |

### Cenários positivos/negativos

- Matriz de leitura de todos os nove módulos para global sem vínculo, global+ADMIN, global+OPHTHALMOLOGIST, ADMIN local, RECEPTIONIST, OPHTHALMOLOGIST local e usuário sem vínculo.
- Global cria/edita Users e clínicas, consulta documento, cria vínculos, altera papel/status e administra clínica inativa. A gestão de perfis profissionais continua permitida explicitamente, sem conceder essa edição ao médico/recepção locais.
- Global sem vínculo recebe 403 nos módulos clínicos. Global+ADMIN acessa pacientes/agenda/auditoria local, sem prontuário/exames. Global+OPHTHALMOLOGIST acessa prontuário/exames/agenda próprios e continua sem reagendar/cancelar agenda por ser global.
- Médico global não cria agendamento para outro profissional e não consulta detalhe de atendimento, agenda ou exame alheio. Histórico compartilhado do paciente na clínica continua permitido pela regra existente.
- Global+ADMIN pode cancelar agendamento elegível como ADMIN local, mas não inicia atendimento nem solicita exames sem papel médico. A flag global não é convertida em um segundo papel local.
- Acesso entre clínicas é negado nos módulos locais. Identificador de paciente de outra clínica não revela o recurso: 403 sem autorização local ou 404 quando o ator tem autorização na clínica da URL, mas o recurso não pertence a ela.
- Usuário inativo recebe 401; vínculo/clínica inativos perdem acesso local com 403; request sem JWT recebe 401. O global continua administrando a clínica/equipe inativas, como antes; cadastro profissional preserva sua validação de clínica ativa (400).
- Chamadas diretas a serviços administrativos sem ator autorizado falham com 403 antes de consultar/alterar alvos; testes positivos demonstram que global continua operando sem depender apenas do Guard.
- A01 continua retornando somente metadados do atendimento na agenda. A06 continua aplicando headers/cache e preservando sessão/CORS/modos de execução. A07 continua negando ausência de política e tokens inválidos/expirados/revogados.

O teste de cobertura usa papéis locais sintéticos válidos para verificar as políticas locais e testa separadamente o global sem vínculo. Também valida a lista exata de endpoints que podem declarar a alternativa administrativa; adicionar esse decorator em outro handler falha no teste até revisão explícita da allowlist.

## 7. Impactos e limites

- Acesso clínico antes aceito pelo Guard e negado pelo serviço agora é negado já no Guard. Pode haver mudança do texto da resposta 403; não foi alterada a semântica de autenticação 401 ou os contratos de sucesso.
- Operações administrativas globais conservam o alcance existente, inclusive consultas de equipe, dados da clínica e cadastro profissional. As exceções são por handler e por método de serviço; não se estendem a dados clínicos.
- A04 permanece pendente: edição do perfil global por administrador local e a estrutura de um perfil por User não foram redesenhadas. Global com vínculo médico pode ler todos os perfis elegíveis como cadastro administrativo, mas sua agenda/atos clínicos continuam limitados pelo papel e autoria.
- A política existente de gestão de vínculos permite atribuir os papéis do enum, inclusive OPHTHALMOLOGIST. Essa operação administrativa não foi ampliada/restringida; o acesso clínico posterior exige vínculo/perfil/escopo apropriados. Restringir quem pode atribuir papel médico seria uma decisão de produto separada, não um efeito implícito desta correção.
- O frontend não teve alterações visuais ou de navegação; abordagem mobile-first, responsividade e acessibilidade permanecem preservadas. A interface já distinguia gestão global de papéis clínicos locais.
- Repositórios em memória não validam PostgreSQL real, hidratação SQL, isolamento, locks/rollback ou corridas de revogação. Não foram executados bootstrap/seed/migrations ou testes que preparem PostgreSQL.
- O artefato `deploy/` não foi reconstruído/publicado. Headers na Hostinger, navegador real, TLS/proxy e cache de borda continuam sujeitos à homologação descrita em A06.

## 8. Pendências antes de uma publicação aprovada

1. Revisar esta matriz e as 12 exceções administrativas. Não usar o novo decorator em módulos clínicos nem ampliar sua allowlist para contornar um 403 inesperado.
2. Homologar contas sintéticas globais sem vínculo, com ADMIN e com OPHTHALMOLOGIST e os três papéis locais em clínicas diferentes; validar interface e acesso direto aos endpoints.
3. Validar Users/clínicas/equipe/perfis administrativos e fluxos clínicos existentes, incluindo desativação de vínculo/clínica e logout/restauração de sessão.
4. Em ambiente QA aprovado e isolado, conferir os comportamentos com PostgreSQL persistido e locks/último ADMIN, sem usar dados reais ou preparar fixtures em produção.
5. Reexecutar os checks da API/React, reconstruir o artefato apropriado após revisão e aplicar as verificações de Hostinger de A06. Nenhuma etapa de publicação foi executada automaticamente.

Status: **A02 implementado e validado localmente; aguardando revisão técnica e homologação antes de qualquer deploy.**
