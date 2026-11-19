# Bootstrap do primeiro administrador global

Implementado e validado localmente em 15/11/2026. **Não houve conexão, criação ou consulta no Supabase.** Nenhum bootstrap é executado pelo startup, build ou deploy. Não há endpoint de bootstrap.

## Auditoria e permissões atuais

| Arquivos inspecionados | Resultado |
|---|---|
| `users/users.module.ts`, `users/user.service.ts`, `users/entities/user.entity.ts` | `User` tem nome/email/hash obrigatórios, email único global, `active`, `isSystemAdmin` boolean padrão false e `tokenVersion`. Vínculos e perfil profissional são relações separadas e opcionais para a conta global. Não havia bootstrap nos fontes atuais. |
| `users/dto/create-user.dto.ts`, `common/hashing/bcrypt.service.ts` | Validação existente: nome não vazio até 150, email válido até 150, senha 8..255 caracteres. Bootstrap reutiliza DTO/normalização e `BcryptService` (bcrypt custo 10). Adiciona limite de 72 bytes UTF-8 para impedir truncamento silencioso do bcrypt. Não há mecanismo existente de troca obrigatória no primeiro login. |
| `auth/auth.module.ts`, `auth/auth.service.ts`, `auth/strategies/jwt.strategy.ts` | Login aceita conta ativa sem vínculo: devolve `isSystemAdmin:true`, `clinicRoles:[]`, access token e cookie de refresh HttpOnly. O payload JWT usa identidade/sessão/versão de token; a estratégia recarrega o usuário e seu privilégio global do banco em cada autenticação. Não foi necessário mudar JWT ou cookies. |
| `auth/guards/jwt-auth.guard.ts`, `auth/guards/authorization.guard.ts`, decorators `SystemAdmin`/`ClinicRoles` | Rotas protegidas exigem JWT válido. `isSystemAdmin:true` passa pela autorização global e pelo guard de papéis de clínica. Isso não elimina as verificações específicas dos services. |
| `users/users.controller.ts`, `users/dto/update-user.dto.ts` | Criar/listar/consultar/editar/status de usuários exigem System Admin. `PATCH /users/:id` aceita `isSystemAdmin`, mas somente um System Admin autenticado pode chamá-lo. Cadastro não aceita esse campo: ValidationPipe com whitelist/forbidNonWhitelisted o rejeita. Usuário comum não pode se promover. `UserService` incrementa tokenVersion quando privilégio/email/status/senha muda. |
| `clinics/clinics.controller.ts` | System Admin pode criar/listar/consultar/editar/ativar/desativar clínicas, sem vínculo próprio. Atualização usa guard ADMIN local, que permite System Admin; o service não exige vínculo adicional. |
| `clinic-users/clinic-users.controller.ts`, `clinic-users/clinic-users.service.ts` | System Admin cria/consulta vínculos, define papel e gerencia status. Permanecem as regras de clínica/conta ativas, duplicidade e primeiro vínculo ADMIN/último ADMIN local protegido. A conta bootstrap não recebe vínculo automático. |
| `patients/patients.service.ts`, `appointments/appointments.service.ts`, `encounters/encounters.service.ts`, `exams/exams.service.ts`, `audit/audit.service.ts` | Services mantêm exigência de papel/vínculo específico para dados clínicos e auditoria. A flag global sozinha não dá leitura irrestrita de pacientes/prontuários/exames. Pacientes e exames sem vínculo foram bloqueados nos testes. |
| `web/src/features/users/pages/UsersPage.tsx`, `features/clinics/pages/ClinicsPage.tsx`, `features/clinic-users/pages/ClinicUsersPage.tsx`, Sidebar e contexto clínico | Há telas globais `/usuarios` e `/clinicas` controladas por `isSystemAdmin`, independentes da clínica ativa. Equipe global usa `/clinicas/:clinicId/usuarios`, com escopo escolhido pela rota. Sem vínculo, o administrador deve começar pela administração de Clínicas/Usuários, não pelos módulos clínicos. |
| `database/data-source.ts`, `database/connection-options.ts`, `main.ts` | CLI compartilha DataSource/TLS/CA existente. `synchronize:false`, `migrationsRun:false` preservados. Nenhuma migration, entidade, service, guard, contrato HTTP, CORS ou frontend foi alterado. |

### Lacunas e limites encontrados, sem alteração automática

- Não há proteção identificada de **último System Admin ativo** em `UserService.updateUser/updateActive`: um administrador pode se desativar ou remover seu próprio privilégio. O bloqueio de último ADMIN em ClinicUsers não protege a conta global. Recomenda-se uma regra transacional específica para impedir perda do último administrador, em tarefa separada; não foi modificada nesta implementação.
- Administradores existentes podem conceder/remover privilégio global via endpoint protegido. Isso é funcionalidade administrativa já implementada, não uma elevação disponível ao usuário comum. O bootstrap não restringe essa política existente.
- O guard global tem bypass de papéis locais para System Admin; a restrição clínica depende também dos services. Não se recomenda ampliar esse bypass. Novos endpoints clínicos devem manter verificações específicas no service.
- Módulos clínicos podem aparecer no menu sem contexto utilizável; isso não concede acesso clínico. Prévia visual de Exames/Prontuários em desenvolvimento também não equivale a acesso aos dados em produção.
- Não há primeiro-login obrigatório nem redefinição administrativa sem senha atual no contrato existente. Depois do primeiro login, pode-se usar o fluxo normal de alteração da própria senha. Alterar senha encerra sessões conforme a autenticação atual.
- Frontend auditado por leitura de código; não houve teste no navegador publicado. Dados cadastrais globais de contas/clínicas/equipe são administrativos e não se confundem com autorização irrestrita aos resultados e prontuários.

## Funcionamento e segurança

O bootstrap insere **somente um registro em `users`**, com `active:true`, `isSystemAdmin:true`, `tokenVersion:0` e hash gerado pelo mesmo serviço de cadastro. Não cria clínica, paciente, profissional, vínculo, agendamento ou exame. Não modifica registros existentes.

Antes do INSERT, a transação adquire `LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE` com espera máxima de 5 segundos. Esse lock serializa tanto execuções concorrentes do bootstrap quanto INSERT/UPDATE comuns na tabela enquanto as verificações/criação são realizadas. A transação READ COMMITTED consulta após adquirir o lock, evitando decisão baseada em snapshot anterior. O bloqueio pode atrasar brevemente outros cadastros/alterações de usuários; execute a inicialização em janela controlada.

Qualquer administrador global existente bloqueia criação — inclusive inativo, deliberadamente, para não transformar bootstrap em recuperação de acesso. Email ocupado, comparado sem distinguir maiúsculas/minúsculas, também bloqueia: não promove conta comum, não reativa, não redefine senha e não adota conta existente. Reexecução interrompe sem modificações. Falha de constraint, lock ou conexão impede commit.

`check` e `validate` usam transação REPEATABLE READ, READ ONLY e rollback, sem INSERT. Check é uma pré-verificação, não reserva o direito de criar; a criação repete tudo sob lock.

Não há endpoint ou integração HTTP para executar o script, nem flags em DTOs de usuários comuns. É uma operação de infraestrutura: somente operadores com acesso ao processo/ambiente e credenciais PostgreSQL devem poder executá-la. Flags não substituem proteção operacional do host e do banco; alguém com credenciais de escrita diretas no PostgreSQL já ultrapassa o RBAC HTTP. Restrinja esse acesso.

Query logging do processo é desativado; logs contêm apenas flags de resultado ou mensagens controladas. Não imprimem nome/email, senha, hash, cookies, tokens ou DATABASE_URL. Erros brutos do driver não são serializados. `.env` não foi modificado. Nenhuma dependência foi adicionada.

## Variáveis obrigatórias

Configure somente no ambiente privado do processo ou no `.env` local ignorado pelo Git:

- `SYSTEM_ADMIN_NAME`: nome da conta, não vazio, até 150 caracteres.
- `SYSTEM_ADMIN_EMAIL`: email válido, até 150 caracteres, normalizado para minúsculas.
- `SYSTEM_ADMIN_PASSWORD`: mínimo 8 caracteres e máximo 72 bytes UTF-8. Sem senha padrão.
- `SYSTEM_ADMIN_ALLOW_PRODUCTION`: somente para criação autorizada com `NODE_ENV=production`, valor de reconhecimento `bootstrap-first-system-admin`.

Check/create exigem os três dados de conta. Validate exige apenas SYSTEM_ADMIN_EMAIL. Não coloque credenciais em comandos do histórico, repositório, `.env.example` ou logs. Após criar, remova SYSTEM_ADMIN_PASSWORD e a autorização de produção do ambiente permanente; o login usa o hash no banco, não essas variáveis.

## Comandos futuros — não executados no Supabase nesta etapa

Na pasta `api/`, confirme privadamente que DATABASE_URL é do projeto correto e que DB_SSL_CA_PATH aponta à CA disponível. A CLI usa a configuração existente, inclusive resolução de caminhos no código compilado. Não desative verificação TLS. Não precisa executar migrations novamente se o banco já está atualizado.

Pré-verificação (conecta ao banco, apenas leitura):

```bash
npm run bootstrap:admin:check -- --confirm-bootstrap
```

Criação inicial (escreve apenas o User, depende de autorização explícita):

```bash
npm run bootstrap:admin:create -- --confirm-bootstrap
```

Para o ambiente de produção devidamente autorizado, depois de configurar os dados privados:

```bash
SYSTEM_ADMIN_ALLOW_PRODUCTION=bootstrap-first-system-admin \
npm run bootstrap:admin:create -- --confirm-bootstrap
```

Confirmação posterior (apenas leitura, não exige senha):

```bash
npm run bootstrap:admin:validate -- --confirm-bootstrap
```

Saídas de sucesso são JSON sem dados de conta: check contém `canBootstrap:true, modified:false`; create contém `administratorCreated:true, modified:true`; validate contém `administratorExists:true, modified:false`. Falhas retornam exit code 1. Se já existe administrador, interrompe; não execute SQL de reset nem force promoção de conta comum.

Em ambiente com apenas dependências de produção, faça build antes e use a CLI compilada:

```bash
node dist/database/seeds/system-admin.cli.js --check --confirm-bootstrap
node dist/database/seeds/system-admin.cli.js --create --confirm-bootstrap
node dist/database/seeds/system-admin.cli.js --validate --confirm-bootstrap
```

A autorização adicional de produção continua necessária para `--create`. O build não copia a CA automaticamente: mantenha o arquivo no caminho configurado. Sem confirmação, a CLI bloqueia **antes de importar/inicializar o DataSource**. Os comandos npm não são chamados por `build`, `start`, `start:prod` ou deploy. Não há migração ou alteração automática de schema.

## Testar na aplicação publicada após criação autorizada

1. Abra `/login` do frontend e informe as credenciais definidas privadamente.
2. Confirme acesso a `/usuarios` e `/clinicas`. A conta pode estar sem clínica selecionada e sem vínculos.
3. Cadastre clínicas/contas pela interface. Na equipe da nova clínica, o primeiro vínculo ativo deve ser ADMIN local, como a API já exige. System Admin global não substitui esse registro automaticamente.
4. Gerencie os demais vínculos como OPHTHALMOLOGIST ou RECEPTIONIST conforme a finalidade de cada conta. Não atribua perfil médico ou vínculo à conta bootstrap apenas para liberar telas clínicas.
5. Confirme que outra conta comum não acessa listagem global de usuários/clínicas e que dados clínicos continuam exigindo vínculos adequados.

Login/refresh dependem também da configuração publicada de URL da API, CORS, HTTPS e cookies; nenhuma dessas configurações foi alterada ou homologada remotamente nesta tarefa.

## Validação local reproduzível e resultados

Registro histórico: os arquivos e scripts de teste citados nesta seção foram removidos a pedido do usuário em 18/11/2026. Os comandos de teste abaixo não estão mais disponíveis.

```bash
npm run build
npm run lint
npm run test:bootstrap:admin
```

Requer PostgreSQL local com `pg_config`, `initdb`, `pg_ctl`, extensões uuid-ossp/btree_gist e OpenSSL com `-addext`. Opcionalmente defina PG_TEST_BIN para os binários PostgreSQL. A suíte cria um cluster descartável em diretório temporário, acessível apenas em 127.0.0.1, usa CA de teste e TLS validado. Não importa a conexão real do DataSource e não lê credenciais do Supabase para conectar. As migrations existentes são aplicadas exclusivamente nesse cluster, sem modificar seus arquivos.

Testes cobrem DTOs, normalização, limite de senha, recusa anterior à conexão, produção sem autorização, check sem escrita, validate ausente, email ocupado sem promoção, administrador inativo, rollback forçado por constraint local, concorrência com somente um vencedor, bcrypt custo 10, reexecução sem alterar senha/timestamps e ausência de outros registros após bootstrap.

Os testes HTTP usam controllers, services, guard JWT/Passport, serialização, auditoria e repositórios reais no banco local. Confirmam login/refresh do global sem clínica, cookie HttpOnly, resposta sem refresh token no JSON, listagem/cadastro/edição de usuários, rejeição de mass assignment em POST, bloqueio da elevação por conta comum, criação/consulta/edição/status de clínicas, criação/consulta/papel/status dos vínculos, primeiro ADMIN local obrigatório e bloqueio de pacientes/exames sem vínculo clínico. Dados adicionais necessários a esses cenários são fixtures criadas somente pela suíte, depois de comprovar que o bootstrap criou apenas User.

Resultado: build, lint e suíte local aprovados em PostgreSQL 18 com TLS. Cluster temporário encerrado/removido. Sem criação no Supabase, execução de bootstrap em produção, alteração de migrations ou teste visual remoto.

## Arquivos criados/modificados

- `src/database/seeds/system-admin.seed.ts`: confirmação, validação, check/create/validate e transação.
- `src/database/seeds/system-admin.cli.ts`: entrada manual com DataSource compartilhado e erros sem dados sensíveis.
- `test/system-admin-bootstrap.test.cjs`: integração PostgreSQL local e permissões HTTP.
- `package.json`: quatro comandos manuais, sem hook de startup/build/deploy.
- `.env.example`: nomes de variáveis com valores vazios.
- `docs/SYSTEM_ADMIN_BOOTSTRAP.md`: auditoria, comandos, resultados e lacunas.

Nenhum commit/deploy foi realizado. A criação efetiva no Supabase fica para uma etapa posterior expressamente autorizada.
