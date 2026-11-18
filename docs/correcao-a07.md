# Correção A07 — autorização explícita e negação por padrão

Data: 18/11/2026. Escopo exclusivo A07. A01 e A06 devem permanecer preservadas. Nenhuma migration, conexão ao PostgreSQL, alteração de ambiente/credenciais ou deploy é necessária nesta etapa.

## 1. Diagnóstico e inventário anterior à alteração

Inventário realizado antes de modificar o Guard, a partir dos controllers em fonte e dos metadados compilados: **54 endpoints, 10 controllers**. Classes de política anteriores: 2 públicos, 9 System Admin, 39 por papel de clínica e 4 autenticados implicitamente. Não há uso isolado de `@Roles()` nos controllers atuais; `@ClinicRoles()` o compõe com o parâmetro de clínica.

`JwtAuthGuard` autentica globalmente antes de `AuthorizationGuard`. O primeiro dispensa JWT para `@Public()`. O segundo retornava true quando não encontrava restrição de papel/admin, deixando novos endpoints sem política acessíveis a qualquer usuário autenticado. Os quatro casos intencionais abaixo dependiam dessa regra e de verificações locais.

As rotas são relativas à API: no unificado recebem `/api`; no separado não recebem prefixo. Legenda: **S** = System Admin; **A** = ADMIN; **O** = OPHTHALMOLOGIST; **R** = RECEPTIONIST; **I** = autenticado implícito, que passa a `@Authenticated()`; **P** = público explícito. Papéis locais pressupõem vínculo/clínica/User ativos na autenticação. O bypass global preexistente do Guard não equivale a bypass dos serviços.

| Controller e método(s) | Endpoint(s) | Política anterior → posterior |
| --- | --- | --- |
| AuthController.createLogin | POST /auth/login | P → P |
| AuthController.refresh | POST /auth/refresh | P → P |
| AuthController.logout | POST /auth/logout | I → Authenticated |
| AuthController.changePassword | PATCH /auth/change-password | I → Authenticated |
| UsersController.create, findAll | POST /users; GET /users | S → S |
| UsersController.findById, update, updateActive | GET /users/:id; PATCH /users/:id; PATCH /users/:id/active | S → S |
| UsersController.updatePassword | PATCH /users/:id/password | I → Authenticated, identidade/senha atual preservadas |
| ClinicController.create, findAll, findByDocument, updateActive | POST /clinics; GET /clinics; GET /clinics/document/:document; PATCH /clinics/:id/active | S → S |
| ClinicController.findById | GET /clinics/:id | A/O/R por parâmetro id → igual |
| ClinicController.update | PATCH /clinics/:id | A por parâmetro id → igual |
| ClinicUsersController.create, updateRole, updateActive | POST /clinics/:clinicId/users; PATCH /clinics/:clinicId/users/:userId/role; PATCH /clinics/:clinicId/users/:userId/active | A → A |
| ClinicUsersController.findByClinic | GET /clinics/:clinicId/users | A/O/R → igual |
| ClinicUsersController.findByUser | GET /users/:userId/clinics | I → Authenticated, identidade preservada |
| ProfessionalsController.create, update | POST /clinics/:clinicId/professionals; PATCH /clinics/:clinicId/professionals/:id | A → A |
| ProfessionalsController.findByClinic, findByUser, findByCrm, findById | GET /clinics/:clinicId/professionals; GET .../user/:userId; GET .../crm/:crm/:crmState; GET .../:id | A/O/R → igual |
| PatientsController.create, update | POST /clinics/:clinicId/patients; PATCH /clinics/:clinicId/patients/:id | A/R → igual |
| PatientsController.findAll, findById | GET /clinics/:clinicId/patients; GET .../:id | A/O/R → igual |
| PatientsController.updateActive | PATCH /clinics/:clinicId/patients/:id/active | A → A |
| AppointmentsController.create, findAll, checkAvailability, findById | POST /clinics/:clinicId/appointments; GET mesma base; GET .../availability; GET .../:id | A/O/R → igual, médico limitado à própria agenda no serviço |
| AppointmentsController.reschedule, cancel | PATCH /clinics/:clinicId/appointments/:id/reschedule; PATCH .../:id/cancel | A/R → igual |
| EncountersController.start, findAll, findById | POST /clinics/:clinicId/encounters; GET mesma base; GET .../:id | O → O, autoria nos serviços |
| EncountersController.findPatientHistory | GET /clinics/:clinicId/patients/:patientId/encounters | O → O, histórico compartilhado na clínica preservado |
| EncountersController.update, complete, cancel | PATCH /clinics/:clinicId/encounters/:id; PATCH .../:id/complete; PATCH .../:id/cancel | O → O, autoria/estado nos serviços |
| ExamsController.types, create, list, detail | GET /clinics/:clinicId/exams/types; POST /clinics/:clinicId/exams; GET mesma base; GET .../:id | O herdado da classe → igual, perfil/autoria nos serviços |
| ExamsController.update, result, complete, cancel | PATCH /clinics/:clinicId/exams/:id; PATCH .../:id/result; PATCH .../:id/complete; PATCH .../:id/cancel | O herdado da classe → igual |
| AuditController.findAll | GET /clinics/:clinicId/audit-logs | A → A, também validado no serviço |

### Verificações de identidade e propriedade mantidas

- Logout usa a identidade/sessão autenticada; troca de senha de sessão usa `currentUser.sub` e verifica senha atual.
- `UsersController.updatePassword` aceita o próprio User ou System Admin e exige senha atual do alvo. Não foi transformado em reset administrativo sem senha.
- `ClinicUsersController.findByUser` permite apenas o próprio User ou System Admin.
- Pacientes e agenda verificam papel e clínica nos serviços; médico tem filtro de autoria na agenda. Início/edição/conclusão/cancelamento de atendimento exigem profissional designado; exames exigem perfil/vínculo/autor elegível.
- Nenhum controle de clínica, papel, estado, identidade, autoria ou auditoria dos serviços deve ser removido por esta correção.

### Precedência anterior

Os Guards usam `Reflector.getAllAndOverride` com método antes da classe, **separadamente por chave**. Um papel no método substitui a lista de papéis da classe, mas não apaga outra chave, como `@SystemAdmin()` da classe. `@ClinicRoles()` registra tanto papéis quanto o nome do parâmetro; `@Roles()` isolado usa `x-clinic-id` quando não há parâmetro herdado. System Admin é liberado pelo Guard antes da validação local, mas os serviços clínicos podem negá-lo: A02 permanece fora do escopo.

## 2. Políticas explícitas implementadas

Foi adicionado `@Authenticated()`, com chave `requiresAuthentication`. Ele declara que o endpoint aceita um usuário autenticado sem exigir um papel específico. **Não é uma garantia de propriedade:** verificações self, clínica e autoria continuam obrigatórias no controller/serviço.

Aplicações novas desse decorator em produção, e somente elas:

1. `AuthController.logout` — POST /auth/logout.
2. `AuthController.changePassword` — PATCH /auth/change-password.
3. `UsersController.updatePassword` — PATCH /users/:id/password.
4. `ClinicUsersController.findByUser` — GET /users/:userId/clinics.

Nenhum desses endpoints virou público. Login e refresh continuam explicitamente públicos quanto ao JWT, mantendo as próprias verificações de credenciais/cookie/header de sessão.

`AuthorizationGuard` passa a exigir política reconhecida antes de permitir acesso, inclusive para System Admin:

| Situação | Resultado |
| --- | --- |
| `@Public()` sem restrição privada contraditória | Permite acesso público; login/refresh ainda validam sua entrada. |
| `@Authenticated()` e identidade preenchida pelo JWT Guard | Permite prosseguir para o handler; controles de identidade permanecem. |
| `@SystemAdmin()` | Mantém exigência da flag global. ADMIN de clínica não é System Admin. |
| `@ClinicRoles()` / `@Roles()` com lista não vazia | Mantém contexto/papéis e o bypass global preexistente do Guard. Serviços continuam aplicando regras próprias. |
| Nenhuma política reconhecida | 403 após autenticação; também negado ao System Admin. |
| Lista vazia de papéis ou Public combinado com política privada | 403 por política inválida; configuração falha de forma restritiva. |

### Precedência e combinações

A resolução de cada chave mantém método antes de classe. Tipos de política diferentes não são apagados implicitamente:

- `@ClinicRoles("clinicId", ADMIN)` na classe e `@ClinicRoles("otherClinic", OPHTHALMOLOGIST)` no método: o método substitui lista e parâmetro das mesmas chaves.
- `@Authenticated()` no método não remove `@SystemAdmin()` ou papéis herdados da classe.
- `@SystemAdmin()` herdado continua exigido quando o método declara papéis; não se abriu uma alternativa de acesso a administradores locais.
- `@Public()` combinado com política privada, seja na mesma declaração ou por herança entre classe/método, é uma configuração inválida e é negada. Não se usa Public para liberar métodos de controllers privados. Não existe essa combinação nos 54 endpoints atuais.
- `@Roles()` isolado conserva o fallback `x-clinic-id`; se houver parâmetro de clínica herdado, ele continua prevalecendo. Uma clínica diferente no header não substitui a clínica da URL quando declarada por `@ClinicRoles()`.

O `JwtAuthGuard` não foi modificado. Sem JWT válido, uma rota protegida continua devolvendo 401 antes da autorização; com JWT válido e permissão insuficiente ou política ausente, devolve 403. Uma rota explicitamente pública pode ignorar um Bearer inválido, pois seu fluxo não depende desse JWT — comportamento já existente.

### System Admin e A02 preservados

O bypass de System Admin continua existindo **apenas após reconhecer uma política privada válida**. Não foi usado para liberar endpoints sem política. Pacientes, agenda, atendimentos, exames e auditoria mantêm a exigência local/autoria dos serviços, inclusive quando o Guard permite passar o administrador global.

A02 continua pendente: alguns módulos administrativos aceitam a flag global sem vínculo, enquanto serviços locais/clínicos a negam sem papel adequado. Essa divergência foi coberta por regressão, não corrigida nem convertida em privilégio clínico irrestrito.

## 3. Arquivos modificados

| Arquivo | Finalidade |
| --- | --- |
| `api/src/common/decorators/authenticated.decorator.ts` | Novo decorator de autenticação explícita. |
| `api/src/auth/guards/authorization.guard.ts` | Reconhece Public/Authenticated, nega ausência de política e combinações inválidas, mantém os controles administrativos/clínicos existentes. |
| `api/src/auth/auth.controller.ts` | Marca logout e troca de senha da sessão como Authenticated. |
| `api/src/users/users.controller.ts` | Marca troca de senha por ID como Authenticated sem remover identidade/senha atual. |
| `api/src/clinic-users/clinic-users.controller.ts` | Marca consulta de vínculos por User como Authenticated sem remover a checagem self/global. |
| `api/test/authorization-guard.test.cjs` | Dez testes de negação por padrão, metadados, contexto e precedência. |
| `api/test/authorization-http.test.cjs` | Nove testes de JWT/autenticação/identidade/acesso clínico e manutenção de A02, com persistência sintética. |
| `api/test/route-policy-coverage.test.cjs` | Dois testes de cobertura de políticas das rotas e detecção de endpoint futuro sem declaração. |
| `api/test/http-security.test.cjs` | Declara Authenticated nas rotas sintéticas autenticadas do teste A06; mantém as mesmas expectativas de headers/sessão. A implementação A06 não foi alterada. |
| `api/package.json` | Adiciona `test:authorization` e `test:route-policies`, com build antes dos testes. Sem novas dependências. |
| `docs/correcao-a07.md` | Inventário anterior e posterior, decisões e evidências. |

Não houve alteração em serviços de produção, contratos/DTOs de agendamento A01, middleware/configuração A06, JWT strategy, entidades, migrations, arquivos React, variáveis de ambiente ou credenciais.

## 4. Verificação automatizada de cobertura das rotas

`test/route-policy-coverage.test.cjs` percorre a fonte em `api/src` com a AST do TypeScript para descobrir classes `@Controller()` sem depender do sufixo do arquivo. Considera também aliases/namespace de imports Nest. Para cada controller, carrega somente sua versão compilada e usa `MetadataScanner` para enumerar métodos HTTP, inclusive herdados.

Cada rota é validada com `AuthorizationGuard` real e um ator sintético System Admin: a ausência de política ou configuração contraditória deve falhar **antes** do bypass global. O teste também verifica que métodos HTTP declarados na fonte existem no compilado e falha se não descobrir nenhuma rota. Há uma contraprova com um controller futuro sem política para demonstrar que a detecção falha como esperado.

Comando independente:

```sh
npm --prefix api run test:route-policies
```

O teste não importa AppModule, não inicializa a aplicação de produção, não lê arquivos `.env` e bloqueia `DataSource.initialize`. Deve ser incluído nos checks de integração contínua junto à suíte completa. Verifica a existência/validade da política, mas não substitui testes de negócio para confirmar que o papel escolhido é correto. Controllers criados dinamicamente por factories fora do padrão de classes/decorators devem receber revisão e extensão explícita dessa descoberta.

## 5. Testes executados, resultados e evidências

| Verificação | Resultado |
| --- | --- |
| `npm --prefix api run build` | Aprovado. |
| `npm --prefix api run lint` | Aprovado. |
| Execução Node dos seis arquivos listados pelo comando `test:authorization`, após o build | **48/48 aprovados:** 21 novos testes A07 e 27 de regressão A01/A06/permissões. |
| Cobertura de rotas dentro da suíte | **54 endpoints em 10 controllers**, sem política ausente/inválida; contraprova de rota futura sem política aprovada. |
| `npm --prefix web test -- --reporter=dot` | **7/7 aprovados.** |
| `npm --prefix web run build` | Aprovado; React/FullCalendar e checagem TypeScript. |
| `git diff --check` | Aprovado. |

Comando reprodutível completo (compila e executa testes):

```sh
npm --prefix api run test:authorization
```

### Cenários demonstrados

- Endpoint sem política não executa o handler: 401 sem JWT e 403 com JWT válido, inclusive para System Admin. Headers A06 continuam presentes.
- Public funciona sem JWT; Authenticated exige JWT válido. ADMIN local não satisfaz SystemAdmin.
- Clínica da URL e papel são respeitados; sem vínculo, vínculo inativo, clínica inativa e outra clínica são negados. `x-clinic-id` não substitui o contexto declarado na URL.
- JWT expirado, JTI revogado, sessão revogada/expirada, tipo refresh usado como access, tokenVersion incompatível, token inválido e User inativo recebem 401.
- Precedência de metadados de classe/método, papéis vazios, políticas contraditórias, Authenticated sem enfraquecer restrições herdadas e funcionamento de Roles isolado.
- Controllers reais de vínculos e senha por ID preservam self/global e senha atual; trocar a própria senha invalida tokens anteriores.
- Login/refresh em cookie, restauração de sessão no formato usado pelo React e troca de senha da sessão continuam funcionando; refresh e access anteriores deixam de funcionar após troca de senha.
- Controller/serviço reais de exames permitem ao médico elegível ler o próprio exame e registrar leitura auditada, retornam 404 para ID fora do escopo e negam perfis administrativos. O administrador global sem vínculo continua negado no serviço, preservando A02.
- Serviços reais de pacientes, agenda, atendimentos e auditoria continuam negando System Admin sem papel local. A regressão A01 verifica início, edição, leitura e conclusão de atendimento próprio e ausência de conteúdo clínico na agenda de administrativos.
- Regressão A06 passa em modos separado/unificado, login/refresh/logout, CORS, cache/erros, assets públicos, HTTP/HTTPS/HSTS e confiança explícita em proxy.

### Limites da validação

Testes HTTP/HTTPS executados em loopback com a permissão necessária do ambiente. Usam Nest/Express real, Guards reais, Passport/JWT e controllers/serviços indicados; identidades, sessões e persistência são fixtures em memória. Não foram usados dados clínicos reais. O teste de exames simula repositórios/query builders, sem validar SQL/hidratação PostgreSQL. A geração de SQL da projeção A01 continua coberta pela suíte existente sem conexão.

Não foram executados testes de bootstrap que preparam banco, migrations, deploy, chamadas ao domínio publicado, suíte sobre artefato antigo `deploy/` ou ensaios visuais em navegador. Nenhuma alteração visual foi necessária; mobile-first, acessibilidade e responsividade do React permanecem intactos. Os checks de front-end não substituem homologação manual dos fluxos de sessão.

## 6. Possíveis impactos

- Rotas futuras sem política passam a falhar com 403 para usuário autenticado. Isso é intencional; não se deve contornar com Public ou Authenticated indiscriminadamente.
- Rotas de fixtures/testes precisam declarar a mesma intenção de acesso das rotas reais. A única adaptação na regressão A06 foi explicitar suas rotas de transporte autenticadas.
- Não há alteração do formato de resposta clínica/agenda, flags de sessão, cookies, respostas 401/403 já previstas, papéis locais ou regras de acesso aos serviços existentes.
- Metadados de tipos diferentes se combinam; usar Authenticated no método de uma classe clínica não libera acesso a todos os usuários. Public em classe privada é rejeitado como configuração contraditória.
- O Guard atua em endpoints Nest; assets/HTML públicos servidos pelo middleware estático e preflights tratados pelo CORS continuam com o comportamento público de A06. Não são endpoints clínicos sem política.
- A02, histórico clínico compartilhado e demais achados permanecem pendentes e não devem ser considerados resolvidos por A07.

## 7. Pendências para homologação

1. Validar login, reload/restauração de sessão, logout, troca de senha e seleção de clínica no navegador usando contas sintéticas dos três papéis e System Admin.
2. Conferir acesso direto às URLs e respostas 401/403 sem relaxar política para corrigir problemas de UI.
3. Em QA isolado e aprovado, confirmar comportamento com vínculos/Users/clínicas inativos e dados persistidos, sem usar o PostgreSQL de produção para preparar fixtures nesta etapa.
4. Validar agenda, prontuário e exames próprios, histórico conforme a regra atual e acesso cruzado entre clínicas; confirmar manutenção dos headers A06 no domínio publicado quando houver entrega aprovada.
5. Reconstruir e validar o artefato de entrega após revisão. O `deploy/` existente não foi atualizado automaticamente.

## 8. Manutenção futura

Toda nova rota deve declarar Public, Authenticated, SystemAdmin ou papel de clínica, no método ou por herança de classe válida. Authenticated deve ser usado apenas quando não houver exigência de papel; identidade e propriedade precisam de testes próprios. Clínica e recurso não são autorizados apenas por terem UUID válido.

Adicionar `test:authorization`/`test:route-policies` aos checks de revisão/CI. Ao adicionar uma rota ou alterar um decorator, incluir casos positivos e negativos por papel/tenant/autor e atualizar este inventário ou a documentação sucessora. Não ampliar o bypass global nem redesenhar a precedência como efeito lateral de outra correção; A02 exige decisão própria.

Status: **A07 implementado e validado localmente; aguardando revisão e homologação, sem deploy automático.**
