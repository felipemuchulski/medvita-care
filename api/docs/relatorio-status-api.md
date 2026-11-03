# MedVita Care — Documentação e status da API

**Última atualização:** 2 de novembro de 2026
**Escopo analisado:** código-fonte atual do diretório `api/src`
**Tecnologias principais:** NestJS, TypeScript, TypeORM, PostgreSQL, Passport, JWT, bcrypt, class-validator e class-transformer

> **Atualização de implementação:** as correções P0 e o `ClinicUsersModule` foram entregues em 2 de novembro de 2026. Consulte o relatório detalhado em `docs/relatorio-execucao-backend-2026-11-02.md`.

---

## 0. Atualização executiva para planejamento

### 0.1. Leitura rápida

O back-end possui uma base técnica utilizável, porém ainda não está concluído como produto. Autenticação, autorização, usuários e clínicas já têm rotas HTTP; os fluxos centrais da operação clínica ainda estão apenas modelados no banco.

O caminho crítico para o MVP é:

```text
Fundação, Usuários por clínica, Profissionais e Pacientes (entregues)
        ↓
Agendamentos
        ↓
Atendimentos
        ↓
Auditoria, segurança operacional e preparação para produção
```

Usuários por Clínica, Profissionais e Pacientes foram implementados. O perfil profissional é global por usuário, enquanto pacientes pertencem diretamente a uma clínica e são isolados por `clinicId`. A próxima etapa funcional recomendada é Agendamentos.

### 0.2. Principais alterações já realizadas

| Período/entrega | Alteração principal | Resultado atual |
| --- | --- | --- |
| Estrutura inicial | Entidades de clínicas, usuários, vínculos, profissionais, pacientes, agendamentos e atendimentos | Modelo de domínio criado |
| Persistência | PostgreSQL, TypeORM, `DataSource`, scripts e migrations | Base de banco configurada |
| Cadastros iniciais | Controllers, services e DTOs de Clínicas e Usuários | CRUD parcial disponível por HTTP |
| Segurança de senha | Contrato de hashing e implementação com bcrypt | Senhas persistidas como hash |
| Autenticação | Login, access token, refresh token, sessões persistidas, rotação e logout | Fluxo implementado, ainda sem testes automatizados |
| Revogação | `tokenVersion`, blacklist e revogação de sessões | Alterações sensíveis invalidam tokens anteriores |
| Autorização | Guard global, administrador do sistema e papéis por clínica | Aplicado às rotas atuais de Usuários, Clínicas, vínculos, Profissionais e Pacientes |
| Usuários por clínica | Gestão de vínculos, papéis e status | Base funcional para isolamento dos módulos clínicos |
| Profissionais | DTOs, service, controller, normalização e RBAC | Perfis globais disponíveis no contexto autorizado da clínica |
| Pacientes | CRUD lógico, CPF, paginação, filtros e RBAC | Cadastros isolados e pesquisáveis por clínica |
| Documentação | Relatório técnico da API e variáveis de ambiente de exemplo | Base documental existente |

Os commits mais recentes da API concentraram-se em autenticação, autorização, Usuários por Clínica, Profissionais e correções de fundação. Nesta execução, o PatientsModule foi implementado; as alterações preexistentes no diretório `web` não fizeram parte da análise nem foram modificadas.

### 0.3. Estado real de prontidão

| Área | Prontidão | Observação para o cronograma |
| --- | --- | --- |
| Autenticação | Implementada, não homologada | Precisa de testes unitários/E2E e validação com banco limpo |
| Autorização | Implementada nas rotas atuais | Precisa de testes de acesso cruzado entre clínicas |
| Usuários | Parcial | CRUD administrativo existe; faltam paginação, contratos de erro e cobertura de testes |
| Clínicas | Parcial, com correções bloqueadoras | CRUD existe, mas há falhas descritas na seção 0.4 |
| Usuários por clínica | Funcional | DTOs, service, controller, rotas, isolamento e proteção do último administrador implementados |
| Profissionais | Funcional | Cadastro, atualização e consultas com CRM/UF, vínculo ativo e isolamento por clínica |
| Pacientes | Funcional | Cadastro, atualização, status, CPF, busca, paginação e isolamento por clínica |
| Agendamentos | Apenas estrutural | Sem API, conflitos de agenda ou transições de estado |
| Atendimentos | Apenas estrutural | Sem API, prontuário operacional, histórico ou auditoria |
| Testes automatizados | Ausente | Existem dependências de teste, mas não há specs nem script `test` |
| Operação/produção | Pendente | Sem health check, Swagger, logs estruturados, rate limit ou rotina de limpeza |

### 0.4. Bloqueadores e riscos encontrados

#### P0 — situação após a implementação

1. **Clínica sem e-mail:** corrigido; a normalização só ocorre quando o e-mail é informado.
2. **Alteração indevida de `active`:** corrigido; o campo foi removido de `UpdateClinicDto` e campos desconhecidos são rejeitados.
3. **Primeiro administrador:** criação automatizada removida por decisão do projeto; o cadastro inicial será manual no PostgreSQL via DBeaver, preservando `isSystemAdmin` e o hash bcrypt.
4. **Extensão UUID:** migration compatível adicionada antes da migration histórica.
5. **Testes:** 23 testes temporários foram aprovados e removidos conforme o escopo da execução; uma suíte permanente ainda é necessária.

#### P1 — resolver junto com os primeiros módulos

- configurar `ValidationPipe` com `whitelist`, `forbidNonWhitelisted` e `transform`;
- validar parâmetros com `ParseUUIDPipe` para retornar 400 em UUID inválido;
- validar corretamente filtros booleanos; hoje qualquer valor diferente de `"true"` pode ser interpretado como falso;
- adicionar paginação e limites máximos às listagens;
- padronizar respostas de erro e restrições de unicidade vindas do banco;
- validar variáveis de ambiente no bootstrap, não apenas ao primeiro uso;
- testar migrations `up` e `down` em banco descartável;
- remover o comentário obsoleto sobre adicionar papel ao usuário em `UserService`.

#### P2 — necessário antes de produção

- Swagger/OpenAPI e versionamento de API;
- CORS explícito, headers de segurança e rate limit, especialmente no login;
- logs estruturados, correlation ID, métricas e health/readiness checks;
- limpeza periódica de sessões e tokens revogados expirados;
- recuperação de senha e/ou convite inicial de usuário;
- política de segredos e configuração por ambiente;
- trilha de auditoria para leitura e alteração de dados clínicos;
- revisão LGPD: finalidade, acesso mínimo, retenção, exportação e anonimização/exclusão aplicável;
- estratégia de backup, restauração e migração em deploy.

### 0.5. Módulos principais que faltam

#### Obrigatórios para o fluxo principal do MVP

| Ordem | Módulo | Entregas mínimas | Dependência |
| --- | --- | --- | --- |
| Concluído | Usuários por clínica | Vínculos, status, papéis, listagens, duplicidade, isolamento e último administrador | Usuários e Clínicas |
| Concluído | Profissionais | Perfil global, CRM/UF, consultas, vínculo oftalmologista ativo e isolamento por clínica | Usuários por clínica |
| Concluído | Pacientes | CRUD lógico, CPF, filtros, paginação, ativação e isolamento por `clinicId` | Autorização por clínica |
| 1 | Agendamentos | Criar, reagendar, cancelar, listar por período/status/profissional/paciente, detectar conflito e controlar status | Profissionais e Pacientes |
| 2 | Atendimentos | Iniciar, concluir, cancelar, vincular agendamento, validar participantes, registrar dados clínicos e transições | Agendamentos |
| 3 | Auditoria clínica | Registrar ator, clínica, ação, recurso e data; cobrir leitura/alteração de informação sensível | Todos os módulos clínicos |

#### Módulos técnicos necessários para uma entrega operável

- **Testes e fixtures:** banco de teste, factories/seeds e cenários E2E multi-clínica;
- **Observabilidade:** health check, logs estruturados, métricas e rastreabilidade;
- **Jobs de manutenção:** expiração/limpeza de sessões e blacklist;
- **Documentação da API:** OpenAPI, exemplos e contratos de erro;
- **Administração inicial:** procedimento operacional manual documentado, sem endpoint, seed ou comando automático.

#### Escopo que precisa de decisão de produto

Os itens abaixo não aparecem no código atual e não devem ser assumidos como parte do MVP sem validação de requisitos:

- exames, laudos, prescrições e anexos;
- notificações por e-mail, SMS ou WhatsApp;
- confirmação automática e lista de espera;
- faturamento, convênios e cobrança;
- múltiplas agendas, salas ou equipamentos;
- portal do paciente;
- consentimentos e assinatura eletrônica.

### 0.6. Cronograma sugerido

Estimativa indicativa para **uma pessoa desenvolvedora de back-end**, em sprints de duas semanas, incluindo testes e documentação. O total esperado para um MVP técnico é de aproximadamente **8 a 12 semanas**, com margem adicional para homologação e mudanças de regra de negócio.

| Sprint | Objetivo | Critério de saída |
| --- | --- | --- |
| 0 | Corrigir P0, criar infraestrutura de testes, documentar o administrador inicial manual e validar migrations em banco limpo | Build/lint/test aprovados e ambiente criado do zero |
| 1 | Implementar Usuários por Clínica e matriz formal de permissões | Vínculos e papéis cobertos por E2E, inclusive acesso cruzado negado |
| 2 | Implementar Profissionais e Pacientes | CRUDs paginados, normalizados e isolados por clínica |
| 3 | Implementar Agendamentos | Criação, consulta, reagendamento, cancelamento e conflitos testados |
| 4 | Implementar Atendimentos | Fluxo iniciar/concluir/cancelar e vínculo com agenda testados |
| 5 | Auditoria, documentação, observabilidade, jobs e hardening | Checklist de produção e homologação concluído |

Se Agendamentos possuir muitas regras de grade, recorrência, encaixe ou bloqueio de agenda, ele deve ocupar dois sprints. Testes não devem ser deixados para a última sprint: cada módulo só avança quando seus cenários de autorização e isolamento estiverem cobertos.

**Progresso atual:** as correções de fundação, `ClinicUsersModule`, `ProfessionalsModule` e `PatientsModule` foram entregues. A próxima sprint funcional é Agendamentos. Permanecem pendentes a homologação em PostgreSQL descartável e uma suíte permanente de testes.

### 0.7. Definição de back-end concluído

O back-end pode ser considerado pronto para homologação quando:

- uma instalação vazia cria o banco e possui procedimento manual seguro e documentado para o primeiro administrador;
- todos os módulos obrigatórios possuem DTO, service, controller, autorização e testes;
- nenhuma consulta clínica aceita acesso cruzado entre clínicas;
- conflitos e transições de estado possuem regras explícitas e testes;
- dados clínicos sensíveis possuem trilha de auditoria;
- migrations são testadas e o deploy possui plano de rollback/backup;
- contratos estão publicados no OpenAPI;
- logs, health checks e alertas mínimos estão disponíveis;
- build, lint, testes unitários e E2E fazem parte do CI;
- os critérios de LGPD definidos para o produto foram validados.

### 0.8. Resultado da validação de 2 de novembro de 2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd run build` | Aprovado |
| `npm.cmd run lint` | Aprovado, sem erros exibidos |
| Testes automatizados | 23 testes temporários aprovados e posteriormente removidos; suíte permanente ainda ausente |
| Migration em PostgreSQL limpo | Não executada nesta auditoria; permanece como item obrigatório |
| Teste funcional com credenciais e banco real | Não executado nesta auditoria |

---

## 1. Objetivo do projeto

O MedVita Care está sendo desenvolvido como uma plataforma de gestão para clínicas oftalmológicas. A API foi estruturada para concentrar as regras de negócio, persistência dos dados, autenticação dos usuários e autorização por clínica e por função.

O domínio atual contempla:

- clínicas;
- usuários do sistema;
- associação entre usuários e clínicas;
- perfis profissionais;
- pacientes;
- agendamentos;
- atendimentos clínicos;
- autenticação com JWT;
- proteção das rotas da API.

---

## 2. Resumo executivo

A API possui infraestrutura de aplicação, conexão com PostgreSQL, migrations e as principais entidades do domínio. Os módulos de Clínicas e Usuários possuem controller, service, DTOs e rotas HTTP. O módulo de Autenticação possui access e refresh tokens, sessões persistidas, rotação de refresh token, logout com revogação, blacklist, validação do usuário no banco e autorização por papéis.

Os módulos de Usuários por Clínica, Profissionais e Pacientes já estão disponíveis pela API. Agendamentos e Atendimentos ainda possuem apenas as entidades e precisam das camadas de aplicação.

### Status geral dos módulos

| Módulo/área | Estado atual | O que já existe |
| --- | --- | --- |
| Aplicação e configuração | Parcial | Bootstrap, variáveis de ambiente, validação e serialização globais; faltam validação de ambiente e hardening do pipe |
| Banco de dados | Funcional/estrutural | PostgreSQL, TypeORM, entidades e migrations; execução limpa ainda precisa ser validada |
| Autenticação | Implementada, não homologada | Login, access/refresh tokens, sessões, rotação, logout, blacklist, strategy, guards e troca de senha |
| Usuários | Parcial | Entidade, DTOs, service, controller e rotas; faltam paginação e testes |
| Clínicas | Parcial | Entidade, DTOs, service, controller e rotas; possui correções P0 pendentes |
| Hashing de senhas | Funcional | Contrato abstrato e implementação bcrypt |
| Usuários por clínica | Funcional | Entidade, DTOs, service, controller, papéis e relacionamentos |
| Profissionais | Funcional | Entidade, DTOs, service, controller, normalização, RBAC e consultas por clínica |
| Pacientes | Funcional | Entidade, DTOs, service, controller, CPF, paginação, filtros e isolamento por clínica |
| Agendamentos | Estrutural | Entidade, estados e relacionamentos |
| Atendimentos | Estrutural | Entidade, estados e relacionamentos |
| Autorização por papéis | Funcional no escopo HTTP atual | Administrador do sistema, papéis por clínica, vínculo e clínica ativos |
| Testes automatizados | Pendente | Os arquivos de testes foram removidos do projeto |

> **Definição utilizada:** um módulo “funcional” possui as camadas necessárias para executar o fluxo atual. Um módulo “estrutural” possui entidade e registro no TypeORM, mas ainda não oferece casos de uso por rotas HTTP.

---

## 3. Organização da aplicação

### 3.1. Estrutura principal

```text
src/
├── app.module.ts
├── main.ts
├── auth/
├── users/
├── clinics/
├── clinic-users/
├── professionals/
├── patients/
├── appointments/
├── encounters/
├── common/
└── database/
```

### 3.2. O que é um módulo no NestJS

Um módulo organiza uma parte da aplicação. Ele informa ao NestJS:

- quais outros módulos são necessários por meio de `imports`;
- quais controllers recebem requisições HTTP;
- quais services, strategies e guards podem ser injetados por meio de `providers`;
- quais recursos podem ser utilizados por outros módulos por meio de `exports`.

Exemplo conceitual:

```ts
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class ExampleModule {}
```

### 3.3. `AppModule`

O `AppModule` é o módulo raiz. Ele conecta todos os módulos existentes:

```text
AppModule
├── ConfigModule
├── TypeOrmModule
├── ClinicsModule
├── UsersModule
├── ClinicUsersModule
├── ProfessionalsModule
├── PatientsModule
├── AppointmentsModule
├── EncountersModule
└── AuthModule
```

Suas responsabilidades atuais são:

- carregar as variáveis de ambiente com `ConfigModule`;
- configurar a conexão com PostgreSQL;
- carregar automaticamente as entidades registradas pelos módulos;
- manter `synchronize: false`, deixando alterações de banco sob controle das migrations;
- reunir os módulos da aplicação.

### 3.4. `main.ts`

O `main.ts` inicializa o NestJS e aplica comportamentos globais:

- `ValidationPipe`: executa as validações declaradas nos DTOs;
- `ClassSerializerInterceptor`: respeita regras de serialização, como `@Exclude()` no hash da senha;
- porta configurável pela variável `PORT`, com padrão `3000`.

---

## 4. Módulo de Autenticação (`AuthModule`)

### 4.1. Responsabilidade

O módulo de autenticação confirma a identidade do usuário. Ele recebe e-mail e senha, valida as credenciais e gera um token JWT. Depois, valida esse token antes de permitir acesso às rotas protegidas.

Atualmente, ele oferece:

- login com e-mail e senha;
- bloqueio do login de usuários inativos;
- geração de access token JWT;
- validação de assinatura e expiração do token;
- proteção global das rotas;
- marcação explícita de rotas públicas;
- acesso ao payload do usuário autenticado;
- troca de senha do próprio usuário autenticado.

### 4.2. Arquivos do módulo

```text
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── dto/
│   ├── login.dto.ts
│   ├── change-password.dto.ts
│   └── refresh-token.dto.ts
├── entities/
│   ├── auth-session.entity.ts
│   └── revoked-token.entity.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── authorization.guard.ts
├── strategies/
│   └── jwt.strategy.ts
└── types/
    └── jwt-payload.type.ts

common/decorators/
├── public.decorator.ts
├── current-user.decorator.ts
├── roles.decorator.ts
└── system-admin.decorator.ts
```

### 4.3. Como o módulo foi configurado

O `AuthModule` importa:

- `UsersModule`, para consultar e atualizar usuários;
- `HashingModule`, para comparar e gerar hashes de senha;
- `ConfigModule`, para acessar variáveis de ambiente;
- `JwtModule`, para assinar tokens;
- `TypeOrmModule`, para persistir sessões e tokens revogados.

O JWT é configurado de forma assíncrona porque depende do `ConfigService`:

```ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.getOrThrow<string>("JWT_SECRET"),
    signOptions: {
      expiresIn: Number(
        configService.get<string>("JWT_ACCESS_EXPIRES_IN_SECONDS", "900"),
      ),
      issuer: configService.get<string>("JWT_TOKEN_ISSUER"),
      audience: configService.get<string>("JWT_TOKEN_AUDIENCE"),
    },
  }),
})
```

#### Variáveis utilizadas

| Variável | Função | Comportamento |
| --- | --- | --- |
| `JWT_SECRET` | Assinar e validar access tokens | Obrigatória; a aplicação falha ao iniciar se não estiver definida |
| `JWT_REFRESH_SECRET` | Assinar e validar refresh tokens | Deve ser independente em produção; por compatibilidade, usa `JWT_SECRET` quando ausente |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | Duração do access token | Opcional; padrão de 900 segundos |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | Duração do refresh token/sessão | Opcional; padrão de 604.800 segundos (7 dias) |
| `JWT_TOKEN_ISSUER` | Emissor aceito nos tokens | Opcional |
| `JWT_TOKEN_AUDIENCE` | Público aceito nos tokens | Opcional |

O segredo precisa ser longo, aleatório, diferente em cada ambiente e nunca deve ser enviado ao frontend ou versionado no Git.

### 4.4. O que é JWT

JWT significa **JSON Web Token**. É uma credencial assinada digitalmente, composta por três partes:

```text
HEADER.PAYLOAD.SIGNATURE
```

- **Header:** identifica o tipo do token e o algoritmo de assinatura.
- **Payload:** contém informações sobre o usuário.
- **Signature:** comprova que o conteúdo não foi alterado depois de emitido.

O payload utilizado pelo projeto é:

```ts
export type JwtPayload = {
  sub: string;
  sid: string;
  jti: string;
  tokenVersion: number;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
};
```

| Campo | Significado |
| --- | --- |
| `sub` | ID UUID do usuário; é a identificação principal do token |
| `sid` | ID da sessão persistida no servidor |
| `jti` | ID único do token, usado pela blacklist e pela rotação |
| `tokenVersion` | Versão de segurança do usuário no momento da emissão |
| `type` | Separa explicitamente access token de refresh token |
| `iat` | Momento da emissão, adicionado pela biblioteca JWT |
| `exp` | Momento da expiração, adicionado pela biblioteca JWT |

E-mail, privilégio administrativo e papéis não ficam congelados no token. A `JwtStrategy` os carrega do banco em cada requisição autenticada.

O payload é codificado, mas não é criptografado. Portanto, não devem ser incluídos senha, hash de senha, documentos pessoais, dados clínicos ou outros dados sigilosos.

### 4.5. Fluxo de login

```text
Cliente envia e-mail e senha
            ↓
LoginDto valida o formato dos dados
            ↓
AuthService localiza o usuário pelo e-mail
            ↓
Verifica se o usuário está ativo
            ↓
bcrypt compara a senha com passwordHash
            ↓
AuthService cria a sessão e o par de tokens
            ↓
Access token é assinado com JWT_SECRET
            ↓
Refresh token é assinado, armazenado como hash e associado à sessão
            ↓
API devolve accessToken, refreshToken e dados atuais do usuário
```

Requisição:

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "usuario@email.com",
  "password": "senha-do-usuario"
}
```

Resposta esperada:

```json
{
  "accessToken": "TOKEN_JWT",
  "refreshToken": "REFRESH_TOKEN_JWT",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "UUID_DO_USUARIO",
    "name": "Nome do usuário",
    "email": "usuario@email.com",
    "isSystemAdmin": false,
    "clinicRoles": []
  }
}
```

Credenciais inválidas, usuário inexistente e usuário inativo produzem `401 Unauthorized` sem revelar qual informação estava incorreta.

### 4.6. Como o cliente usa o token

Nas rotas protegidas, o frontend deve enviar:

```http
Authorization: Bearer TOKEN_JWT
```

Sem token, com token inválido, alterado ou expirado, a API responde `401 Unauthorized`.

### 4.7. `auth.controller.ts`

O controller expõe as rotas de autenticação.

| Método | Rota | Proteção | Função |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Pública | Validar credenciais, abrir sessão e emitir o par de tokens |
| `POST` | `/auth/refresh` | Pública; exige refresh token válido no body | Rotacionar o refresh token e emitir um novo par |
| `POST` | `/auth/logout` | Access token obrigatório | Revogar a sessão e inserir o access token na blacklist |
| `PATCH` | `/auth/change-password` | Access token obrigatório | Alterar a senha e revogar todas as sessões do usuário |

No login, o decorator `@Public()` informa que a rota não exige token:

```ts
@Post("login")
@Public()
createLogin(@Body() createLoginDto: LoginDto) {
  return this.authService.login(createLoginDto);
}
```

Na troca de senha, `@CurrentUser()` entrega o usuário autenticado com dados atuais:

```ts
@Patch("change-password")
changePassword(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: ChangePasswordDto,
) {
  return this.authService.changePassword(user.sub, dto);
}
```

O ID vem de `user.sub`, e não do body ou da URL. Isso impede que o cliente escolha diretamente qual usuário terá a senha alterada.

### 4.8. `auth.service.ts`

O `AuthService` contém as regras de autenticação.

#### `login(loginDto)`

1. normaliza e localiza o usuário por meio do `UserService`;
2. converte usuário inexistente em erro genérico de credenciais;
3. impede login se `active` for falso;
4. compara a senha recebida com `passwordHash` usando bcrypt;
5. cria uma sessão persistida;
6. emite access e refresh tokens com `sid`, `jti` e `tokenVersion`;
7. armazena somente o hash do refresh token;
8. retorna o par de tokens e os dados atuais do usuário.

#### `refresh(refreshTokenDto)`

Valida assinatura, tipo, expiração, sessão, hash, `jti`, usuário ativo e `tokenVersion`. Em caso de sucesso, rotaciona o refresh token; a reutilização do token anterior é rejeitada.

#### `logout(user)`

Revoga a sessão no banco e registra o `jti` do access token em `revoked_tokens` até sua expiração.

#### `changePassword(userId, changePasswordDto)`

1. localiza o usuário pelo ID do token;
2. compara a senha atual com o hash armazenado;
3. rejeita a operação se a senha atual for inválida;
4. gera o hash da nova senha;
5. atualiza o usuário pelo `UserService`;
6. incrementa a versão de segurança e revoga todas as sessões do usuário;
7. retorna uma mensagem solicitando novo login.

#### `findUserByEmail(email)`

É um método privado usado pelo login. Ele transforma `NotFoundException` em `UnauthorizedException` para não informar se um determinado e-mail está cadastrado.

### 4.9. DTOs de autenticação

#### `LoginDto`

- exige e-mail válido;
- exige senha como string não vazia.

#### `ChangePasswordDto`

- exige a senha atual;
- exige nova senha;
- exige no mínimo 8 e no máximo 255 caracteres na nova senha.

#### `RefreshTokenDto`

- exige `refreshToken` como string não vazia;
- valida o formato JWT antes de executar o service.

Os DTOs validam formato e obrigatoriedade. A verificação da senha correta continua sendo responsabilidade do service.

---

## 5. `JwtStrategy`: como o token é validado

### 5.1. Responsabilidade

A `JwtStrategy` define para o Passport:

- onde encontrar o token;
- qual segredo deve validar a assinatura;
- se a expiração deve ser respeitada;
- como conferir sessão, blacklist, usuário e versão de segurança;
- quais dados atuais serão anexados à requisição.

### 5.2. Configuração

```ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
});
```

#### `jwtFromRequest`

```ts
ExtractJwt.fromAuthHeaderAsBearerToken()
```

Instrui o Passport a procurar o token no header:

```http
Authorization: Bearer TOKEN
```

#### `ignoreExpiration: false`

Faz com que tokens expirados sejam rejeitados. Se o campo `exp` estiver no passado, a requisição recebe `401 Unauthorized`.

#### `secretOrKey`

Usa o mesmo `JWT_SECRET` empregado na assinatura. Se o token tiver sido criado com outro segredo ou tiver seu conteúdo alterado, a assinatura será inválida.

### 5.3. Método `validate`

O Passport só chama esse método depois de validar formato, assinatura e expiração. Em seguida, a strategy:

1. aceita apenas tokens com `type: "access"`;
2. consulta a sessão pelo `sid` e pelo usuário;
3. rejeita sessão revogada ou expirada;
4. consulta a blacklist pelo `jti`;
5. recarrega o usuário, os vínculos e as clínicas no banco;
6. rejeita usuário inativo ou `tokenVersion` divergente;
7. monta `AuthenticatedUser` com e-mail, privilégio e papéis atuais.

Tudo que o método retorna é colocado em:

```ts
request.user
```

No fluxo atual:

```text
Assinatura e expiração válidas
    ↓
Sessão ativa e jti fora da blacklist
    ↓
Usuário ativo e tokenVersion atual
    ↓
Papéis e privilégios recarregados do banco
    ↓
request.user = AuthenticatedUser
```

Desativação, alteração de papel/vínculo e mudança de privilégio passam a ter efeito na requisição seguinte. Alterações de e-mail, senha, `isSystemAdmin` ou status também incrementam `tokenVersion`, invalidando tokens anteriores.

---

## 6. Guards: como as rotas são protegidas

### 6.1. Responsabilidade

Um guard é executado antes do controller e decide se a requisição pode continuar.

O `JwtAuthGuard`:

1. verifica se a rota foi marcada com `@Public()`;
2. libera imediatamente as rotas públicas;
3. nas demais rotas, aciona a strategy chamada `jwt`;
4. permite a execução se o token for válido;
5. responde `401 Unauthorized` se o token estiver ausente ou for inválido.

Depois da autenticação, o `AuthorizationGuard` interpreta os metadados de autorização:

- `@SystemAdmin()` exige `isSystemAdmin` atual;
- `@ClinicRoles(param, ...roles)` exige vínculo ativo, clínica ativa e um dos papéis informados;
- administradores do sistema podem acessar rotas com papel de clínica;
- falhas de permissão retornam `403 Forbidden`.

### 6.2. Registro global

O guard foi registrado no `AuthModule` com:

```ts
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
},
{
  provide: APP_GUARD,
  useClass: AuthorizationGuard,
}
```

Isso torna a autenticação obrigatória por padrão em toda a API. Não é necessário repetir `@UseGuards(JwtAuthGuard)` em cada controller.

### 6.3. Leitura das rotas públicas

O guard usa o `Reflector`:

```ts
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
```

- `context.getHandler()` representa o método da rota;
- `context.getClass()` representa a classe do controller;
- `getAllAndOverride()` procura o metadado no método e na classe.

Se encontrar `isPublic: true`:

```ts
if (isPublic) {
  return true;
}
```

Caso contrário:

```ts
return super.canActivate(context);
```

O `super.canActivate()` executa o Passport e a `JwtStrategy`.

### 6.4. Diferença entre strategy e guard

| Componente | Pergunta respondida |
| --- | --- |
| `JwtStrategy` | “Como localizar e validar este token?” |
| `JwtAuthGuard` | “A requisição possui uma sessão autenticada válida?” |
| `AuthorizationGuard` | “O usuário atual possui o privilégio ou papel exigido?” |

---

## 7. Decorators personalizados

Decorators adicionam informações ou comportamentos declarativos a classes, métodos e parâmetros. No projeto, eles deixam os controllers mais claros e evitam repetição de código relacionado ao HTTP.

### 7.1. `@Public()`

Implementação:

```ts
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

O decorator adiciona o metadado:

```text
isPublic = true
```

Ele não libera a rota sozinho. Quem interpreta esse metadado é o `JwtAuthGuard`.

Exemplo:

```ts
@Public()
@Post("login")
login() {}
```

Fluxo:

```text
@Public() adiciona metadado
           ↓
JwtAuthGuard lê o metadado
           ↓
Guard libera a rota sem exigir JWT
```

### 7.2. `@CurrentUser()`

O `@CurrentUser()` é um decorator de parâmetro. Ele acessa a requisição HTTP atual e retorna `request.user`:

```ts
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
```

O valor de `request.user` foi colocado anteriormente pelo Passport, a partir do retorno de `JwtStrategy.validate()`.

Uso:

```ts
changePassword(@CurrentUser() user: AuthenticatedUser) {
  return user.sub;
}
```

Sem esse decorator, cada controller precisaria acessar manualmente o objeto `request` e repetir a extração do usuário.

### 7.3. Ordem completa de execução

```text
Requisição HTTP
      ↓
JwtAuthGuard
      ├── possui @Public()? → libera sem autenticação
      └── não possui? → executa JwtStrategy
                              ↓
                    valida token, sessão, blacklist e usuário
                              ↓
                    adiciona AuthenticatedUser em request.user
                              ↓
                    AuthorizationGuard valida privilégio/papel
                              ↓
                    controller recebe o usuário atual
```

### 7.4. `@SystemAdmin()` e `@ClinicRoles()`

`@SystemAdmin()` protege operações globais, como listar usuários, criar clínicas e ativar/desativar registros. `@ClinicRoles("id", ...)` usa o parâmetro indicado como contexto da clínica e confere os papéis ativos carregados pela strategy. As rotas de consulta da própria clínica aceitam os três papéis; a atualização cadastral exige `ADMIN` da clínica.

---

## 8. Módulo de Usuários (`UsersModule`)

### 8.1. Responsabilidade

Gerenciar os usuários que acessam o sistema, seus dados cadastrais, situação ativa e senha.

### 8.2. Componentes

- `User`: entidade da tabela `users`;
- `UserService`: regras de negócio e persistência;
- `UsersController`: rotas HTTP;
- DTOs de criação, atualização, ativação e senha;
- integração com o `HashingModule`.

### 8.3. Entidade `User`

Campos principais:

- `id` UUID;
- `name`;
- `email` único;
- `passwordHash`;
- `active`, com padrão verdadeiro;
- `isSystemAdmin`, com padrão falso;
- `tokenVersion`, com padrão zero, usado para invalidar tokens anteriores;
- datas de criação e atualização.

Relacionamentos:

- um usuário pode possuir vários vínculos com clínicas;
- um usuário pode possuir um perfil profissional.

O campo `passwordHash` possui `@Exclude()` e não é serializado nas respostas pelo interceptor global.

### 8.4. Funções do `UserService`

| Método | Função |
| --- | --- |
| `createUser` | Normaliza o e-mail, impede duplicidade, gera o hash da senha e salva o usuário |
| `findAll` | Lista usuários, com filtros opcionais por e-mail e status ativo |
| `findById` | Localiza por UUID ou retorna 404 |
| `findForAuthentication` | Carrega usuário, vínculos e clínicas para validação em cada requisição |
| `findByEmail` | Normaliza e localiza por e-mail ou retorna 404 |
| `updateUser` | Atualiza nome/e-mail/privilégio, impede e-mail duplicado e incrementa a versão quando necessário |
| `updateActive` | Ativa ou desativa o usuário e incrementa a versão de segurança |
| `updatePassword` | Salva um hash de senha e incrementa a versão de segurança |

### 8.5. Rotas

Todas as rotas abaixo exigem access token válido. As operações administrativas exigem `@SystemAdmin()`:

| Método | Rota | Autorização | Função |
| --- | --- | --- | --- |
| `POST` | `/users` | Administrador do sistema | Criar usuário |
| `GET` | `/users` | Administrador do sistema | Listar usuários |
| `GET` | `/users?email=...&active=true` | Administrador do sistema | Filtrar usuários |
| `GET` | `/users/:id` | Administrador do sistema | Buscar por ID |
| `PATCH` | `/users/:id` | Administrador do sistema | Atualizar nome/e-mail/privilégio |
| `PATCH` | `/users/:id/active` | Administrador do sistema | Ativar ou desativar |
| `PATCH` | `/users/:id/password` | Próprio usuário ou administrador do sistema | Alterar senha com a senha atual |

> A rota `/auth/change-password` é a opção preferencial para o próprio usuário autenticado e revoga todas as suas sessões.

---

## 9. Módulo de Clínicas (`ClinicsModule`)

### 9.1. Responsabilidade

Cadastrar e administrar as clínicas da plataforma.

### 9.2. Componentes

- `Clinic`: entidade da tabela `clinics`;
- `ClinicService`: regras de negócio e persistência;
- `ClinicController`: rotas HTTP;
- `CreateClinicDto`, `UpdateClinicDto` e `UpdateActiveDto`.

### 9.3. Entidade `Clinic`

Armazena:

- nome e documento;
- telefone e e-mail;
- CEP, rua, número, complemento, bairro, cidade e UF;
- situação ativa;
- datas de criação e atualização.

Relacionamentos:

- usuários associados;
- pacientes;
- agendamentos;
- atendimentos.

### 9.4. Funções do `ClinicService`

| Método | Função |
| --- | --- |
| `create` | Normaliza documento/e-mail, verifica documento duplicado e salva a clínica |
| `findAll` | Lista todas as clínicas |
| `findByDocument` | Normaliza e localiza uma clínica pelo documento |
| `findByEmail` | Normaliza e localiza uma clínica pelo e-mail; ainda sem rota própria |
| `findById` | Localiza por UUID ou retorna 404 |
| `updateClinic` | Atualiza os dados permitidos e normaliza o e-mail |
| `updateActive` | Ativa ou desativa a clínica |

### 9.5. Rotas

Todas as rotas abaixo exigem access token e a autorização indicada:

| Método | Rota | Autorização | Função |
| --- | --- | --- | --- |
| `POST` | `/clinics` | Administrador do sistema | Criar clínica |
| `GET` | `/clinics` | Administrador do sistema | Listar clínicas |
| `GET` | `/clinics/document/:document` | Administrador do sistema | Buscar por documento |
| `GET` | `/clinics/:id` | Qualquer papel ativo na própria clínica | Buscar por ID |
| `PATCH` | `/clinics/:id` | `ADMIN` da própria clínica | Atualizar dados cadastrais |
| `PATCH` | `/clinics/:id/active` | Administrador do sistema | Ativar ou desativar |

### 9.6. Regras existentes

- documento único;
- documento normalizado sem máscara e com caracteres alfanuméricos;
- e-mail normalizado em letras minúsculas;
- e-mail não é único entre clínicas;
- desativação lógica por meio de `active`.

---

## 10. Módulo de Hashing (`HashingModule`)

### 10.1. Responsabilidade

Centralizar a proteção das senhas e impedir que os outros módulos dependam diretamente dos detalhes da biblioteca bcrypt.

### 10.2. Arquivos

#### `HashingService`

Contrato abstrato:

```ts
abstract hash(password: string): Promise<string>;
abstract compare(password: string, passwordHash: string): Promise<boolean>;
```

#### `BcryptService`

Implementação concreta:

- `hash`: transforma uma senha em hash;
- `compare`: verifica uma senha contra um hash;
- utiliza custo de 10 salt rounds.

#### `HashingModule`

Mapeia o contrato para a implementação:

```text
HashingService → BcryptService
```

Assim, `UsersModule` e `AuthModule` dependem do contrato `HashingService`, não diretamente de bcrypt.

---

## 11. Módulos estruturais

Os módulos desta seção estão importados pelo `AppModule`. Usuários por Clínica já possui todas as camadas HTTP; os demais ainda são estruturais e registram apenas suas entidades no TypeORM.

### 11.1. Usuários por Clínica (`ClinicUsersModule`)

Representa o vínculo entre uma clínica e um usuário.

Estrutura existente:

- `clinicId`;
- `userId`;
- situação ativa;
- índice único para clínica + usuário;
- relação com `Clinic` e `User`;
- enum de papéis:
  - `ADMIN`;
  - `OPHTHALMOLOGIST`;
  - `RECEPTIONIST`.

Funcionalidades implementadas:

- associar usuários;
- listar usuários de uma clínica;
- listar clínicas do próprio usuário ou como administrador do sistema;
- alterar papel;
- ativar/desativar vínculos;
- impedir duplicidade e proteger o último administrador ativo;
- aplicar o guard e a matriz de papéis aos endpoints do módulo.

### 11.2. Profissionais (`ProfessionalsModule`)

Representa os dados profissionais associados a um usuário.

Estrutura existente:

- relação individual com `User`;
- CRM;
- UF do CRM;
- RQE opcional;
- especialidade com padrão “Oftalmologia”;
- combinação CRM + UF única.

Funcionalidades implementadas:

- cadastro e atualização do perfil global por usuário;
- consultas por identificador, usuário, CRM/UF e clínica;
- normalização de CRM e RQE e validação das UFs brasileiras;
- validação de clínica, usuário e vínculo `OPHTHALMOLOGIST` ativos;
- unicidade por usuário e por CRM/UF;
- leitura do diretório por administradores e recepção;
- leitura limitada ao próprio perfil para oftalmologistas;
- escrita restrita a administrador global ou `ADMIN` da clínica;
- ausência de exclusão física.

Rotas disponíveis:

- `POST /clinics/:clinicId/professionals`;
- `GET /clinics/:clinicId/professionals`;
- `GET /clinics/:clinicId/professionals/:id`;
- `GET /clinics/:clinicId/professionals/user/:userId`;
- `GET /clinics/:clinicId/professionals/crm/:crm/:crmState`;
- `PATCH /clinics/:clinicId/professionals/:id`.

O contrato completo está em `docs/relatorio-professionals-2026-11-02.md`.

### 11.3. Pacientes (`PatientsModule`)

Representa os pacientes atendidos pelas clínicas.

Estrutura existente:

- clínica responsável;
- nome, CPF, data de nascimento e sexo;
- telefone, e-mail e endereço;
- situação ativa;
- CPF único dentro de cada clínica, quando informado;
- relações com agendamentos e atendimentos;
- enum de sexo: `MALE`, `FEMALE` e `NOT_INFORMED`.

Funcionalidades implementadas:

- cadastro e atualização cadastral;
- CPF opcional, normalizado, validado e único por clínica;
- listagem paginada com busca por nome/CPF e filtro de status;
- ativação e desativação lógica por rota própria;
- isolamento por `clinicId` em todas as consultas;
- leitura por `ADMIN`, `RECEPTIONIST` e `OPHTHALMOLOGIST`;
- escrita por `ADMIN` e `RECEPTIONIST`, com status restrito a `ADMIN`;
- bloqueio de administrador global sem vínculo clínico explícito;
- método exportado para validação de paciente ativo pelo futuro módulo de agenda.

Rotas disponíveis:

- `POST /clinics/:clinicId/patients`;
- `GET /clinics/:clinicId/patients`;
- `GET /clinics/:clinicId/patients/:id`;
- `PATCH /clinics/:clinicId/patients/:id`;
- `PATCH /clinics/:clinicId/patients/:id/active`.

O contrato completo está em `docs/relatorio-patients-2026-11-02.md`.

### 11.4. Agendamentos (`AppointmentsModule`)

Representa uma consulta agendada entre clínica, paciente e profissional.

Estrutura existente:

- clínica, paciente e profissional;
- data e horário;
- duração padrão de 30 minutos;
- motivo e observações opcionais;
- relação opcional com atendimento;
- estados:
  - `SCHEDULED`;
  - `CONFIRMED`;
  - `IN_PROGRESS`;
  - `COMPLETED`;
  - `CANCELLED`;
  - `NO_SHOW`.

Funcionalidades pendentes:

- agendar, reagendar e cancelar;
- verificar conflitos de horário;
- validar vínculos com a clínica;
- listar por período, profissional, paciente e status;
- controlar transições de status.

### 11.5. Atendimentos (`EncountersModule`)

Representa a realização clínica da consulta.

Estrutura existente:

- clínica, paciente e profissional;
- vínculo opcional e único com um agendamento;
- data/hora de início e término;
- anotações clínicas;
- estados:
  - `IN_PROGRESS`;
  - `COMPLETED`;
  - `CANCELLED`.

Funcionalidades pendentes:

- iniciar, concluir e cancelar atendimento;
- validar participantes e agendamento;
- controlar transições de status;
- proteger dados clínicos;
- criar histórico e auditoria.

---

## 12. Componentes compartilhados

### 12.1. `BaseEntity`

Classe base utilizada pelas entidades para padronizar:

- `id` como UUID;
- `createdAt`;
- `updatedAt`.

### 12.2. Normalização de e-mail

O utilitário:

- remove espaços no início e no fim;
- transforma o e-mail em letras minúsculas.

### 12.3. Normalização de documento

O utilitário:

- remove espaços;
- converte letras para maiúsculas;
- remove caracteres especiais;
- mantém apenas letras e números.

### 12.4. Validação dos dados

Os DTOs utilizam decorators do `class-validator`, incluindo:

- `@IsEmail()`;
- `@IsString()`;
- `@IsBoolean()`;
- `@IsNotEmpty()`;
- `@IsOptional()`;
- `@MinLength()`;
- `@MaxLength()`.

O `ValidationPipe` global executa essas regras antes do controller.

### 12.5. Exceções utilizadas

| Exceção | Uso atual |
| --- | --- |
| `ConflictException` | E-mail ou documento duplicado |
| `NotFoundException` | Registro não encontrado |
| `UnauthorizedException` | Credenciais, token ou senha atual inválidos |

---

## 13. Banco de dados

### 13.1. Configuração

O projeto utiliza PostgreSQL e TypeORM, com variáveis:

- `DB_HOST`;
- `DB_PORT`;
- `DB_USERNAME`;
- `DB_PASSWORD`;
- `DB_NAME`.

### 13.2. Modelo relacional resumido

```text
Clinic ──< ClinicUser >── User ── ProfessionalProfile
   │                                      │
   ├──< Patient                           │
   │      │                               │
   │      ├──< Appointment >──────────────┤
   │      └──< Encounter >────────────────┤
   │
   ├──< Appointment ── 0..1 Encounter
   └──< Encounter
```

### 13.3. Migrations existentes

A migration atual cria:

- `users`;
- `clinics`;
- `clinic_users`;
- `professional_profiles`;
- `patients`;
- `appointments`;
- `encounters`;
- enums de papéis e status;
- índices únicos;
- chaves estrangeiras;
- coluna `is_system_admin`.

A migration de autenticação adiciona:

- `users.token_version`;
- tabela `auth_sessions`, com hash e `jti` do refresh token, expiração e revogação;
- tabela `revoked_tokens`, que funciona como blacklist de access tokens;
- índices e chaves estrangeiras com exclusão em cascata.

O fato de a migration existir no repositório não confirma que foi executada em todos os ambientes.

---

## 14. Autenticação versus autorização

### Autenticação

Responde:

> “Quem é o usuário?”

O projeto já realiza essa etapa com JWT.

### Autorização

Responde:

> “O que esse usuário pode fazer?”

O `AuthorizationGuard` implementa a camada declarativa de autorização e verifica:

- `isSystemAdmin`;
- papel `ADMIN` da clínica;
- papel `OPHTHALMOLOGIST`;
- papel `RECEPTIONIST`;
- vínculo ativo do usuário com a clínica;
- pertencimento da rota à clínica indicada pelo parâmetro configurado.

Administradores do sistema ignoram a exigência de papel da clínica. O isolamento de pacientes, agendamentos e atendimentos deverá ser aplicado quando esses módulos ganharem controllers e services.

---

## 15. Segurança da autenticação após os ajustes

- access token de curta duração e refresh token configurável;
- refresh token armazenado somente como hash e rotacionado a cada uso;
- sessão persistida e revogada no logout;
- blacklist de access tokens por `jti`;
- `JwtStrategy` consulta sessão, blacklist, usuário, vínculos e clínicas em cada requisição;
- e-mail, privilégio administrativo e papéis atuais não dependem de dados antigos do token;
- senha, e-mail, `isSystemAdmin` e status incrementam `tokenVersion` e invalidam tokens anteriores;
- usuário, vínculo ou clínica inativos perdem acesso na requisição seguinte;
- `AuthorizationGuard`, `@SystemAdmin()` e `@ClinicRoles()` aplicam autorização por papéis;
- o fluxo está preparado para receber testes automatizados futuramente.

Antes da produção ainda é necessário usar segredos fortes e distintos, executar a migration, definir limpeza periódica de sessões/blacklist expiradas e criar testes ligados a um PostgreSQL de teste.

---

## 16. Validação técnica atual

### Build

**Resultado em 02/11/2026:** aprovado.

```text
npm run build
→ concluído sem erros
```

### Lint

**Resultado em 02/11/2026:** aprovado sem erros exibidos.

### Testes automatizados

Não existem arquivos permanentes de testes automatizados no estado final do projeto. Durante a execução de 2 de novembro de 2026, quatro suítes temporárias validaram 23 cenários com aprovação total; os arquivos foram removidos depois que os resultados foram registrados em `docs/relatorio-execucao-backend-2026-11-02.md`.

### Validação funcional registrada na auditoria anterior

- aplicação inicializada com sucesso;
- `AuthModule` carregado pelo NestJS;
- rotas de autenticação registradas;
- login com body inválido retorna `400`;
- credenciais inexistentes retornam `401`;
- troca de senha sem token retorna `401`;
- rota de usuários sem token retorna `401`.

Não foi executado login positivo com uma credencial real durante esta documentação.

---

## 17. Próximas etapas recomendadas

### Prioridade 1 — Fundação e bloqueadores

- [x] corrigir a criação de clínica com e-mail ausente;
- [x] impedir alteração de `active` pela atualização cadastral da clínica;
- [x] definir o cadastro manual do primeiro administrador no PostgreSQL, sem endpoint ou automação;
- [x] garantir a extensão de UUID por migration compatível;
- [x] endurecer o `ValidationPipe` e validar UUIDs/filtros;
- [ ] validar as migrations `up/down` em PostgreSQL descartável;
- [ ] configurar uma infraestrutura permanente de testes;
- aplicar `@ClinicRoles()` aos futuros endpoints de pacientes, agendamentos e atendimentos;
- garantir que cada consulta de domínio filtre pelo `clinicId` autorizado;
- criar uma matriz formal de permissões por papel;
- adicionar testes E2E de acesso cruzado entre clínicas.

### Prioridade 2 — Usuários por clínica (concluída)

- [x] criar DTOs, service e controller;
- [x] criar e desativar vínculos;
- [x] alterar papéis;
- [x] listar usuários por clínica;
- [x] listar clínicas por usuário;
- [x] impedir acesso cruzado e proteger o último administrador ativo.

### Prioridade 3 — Cadastros do domínio

- [x] implementar Profissionais;
- [x] implementar Pacientes;
- [x] adicionar paginação e filtros de pacientes;
- [x] criar validação de CPF e registros profissionais.

### Prioridade 4 — Operação clínica

- implementar Agendamentos;
- validar conflitos de agenda;
- implementar Atendimentos;
- controlar transições de status;
- criar trilha de auditoria.

### Prioridade 5 — Qualidade e produção

- manter e ampliar a cobertura do `ValidationPipe` já configurado;
- ampliar testes unitários e criar testes E2E;
- adicionar Swagger/OpenAPI;
- definir CORS e versionamento;
- implementar logs e observabilidade;
- revisar requisitos de LGPD;
- programar limpeza de sessões e entradas de blacklist expiradas.

---

## 18. Estrutura recomendada no Notion

Esta documentação pode ser mantida em uma página principal com as seguintes subpáginas:

1. **Visão geral do projeto**
   - objetivo;
   - arquitetura;
   - stack;
   - status geral.

2. **Catálogo de módulos**
   - responsabilidade;
   - entidade;
   - service;
   - controller;
   - rotas;
   - pendências.

3. **Autenticação e segurança**
   - fluxo JWT;
   - strategy;
   - guard;
   - decorators;
   - variáveis de ambiente;
   - limitações.

4. **Modelo de dados**
   - entidades;
   - relacionamentos;
   - migrations;
   - decisões de modelagem.

5. **Backlog técnico**
   - tarefa;
   - prioridade;
   - módulo;
   - responsável;
   - critério de aceite.

6. **Histórico de validações**
   - data;
   - resultado do build;
   - resultado do lint;
   - testes executados;
   - observações.

### Propriedades sugeridas para um banco de módulos

| Propriedade | Tipo no Notion | Exemplo |
| --- | --- | --- |
| Módulo | Título | Autenticação |
| Estado | Seleção | Funcional / Estrutural / Pendente |
| Camadas prontas | Multi-seleção | DTO, Service, Controller, Guard |
| Prioridade | Seleção | Crítica / Alta / Média / Baixa |
| Responsável | Pessoa | Responsável técnico |
| Última validação | Data | 02/11/2026 |
| Build | Seleção | Aprovado / Reprovado |
| Testes | Texto | Pendente |
| Próxima entrega | Texto | Isolamento dos módulos clínicos |

---

## 19. Checklist para considerar um módulo concluído

- [ ] entidade e migration definidas;
- [ ] DTOs de entrada definidos;
- [ ] service e regras de negócio implementados;
- [ ] controller e rotas implementados;
- [ ] autenticação aplicada;
- [ ] autorização aplicada;
- [ ] isolamento de dados por clínica garantido;
- [ ] erros de negócio tratados;
- [ ] testes unitários criados;
- [ ] testes E2E criados;
- [ ] documentação atualizada;
- [ ] build aprovado;
- [ ] lint aprovado;
- [ ] funcionalidade validada com banco.

---

## 20. Conclusão

O repositório possui uma base consistente de aplicação, persistência, autenticação e autorização. Clínicas, Usuários, Usuários por Clínica, Profissionais e Pacientes são os módulos de negócio disponíveis por HTTP. A autenticação JWT protege globalmente as rotas, mantém sessões persistidas, rotaciona refresh tokens e permite revogação imediata no servidor.

Profissionais e Pacientes agora fornecem as validações de participantes necessárias para a agenda. A próxima evolução mais importante é implementar Agendamentos com escopo por clínica, conflitos de horário e transições explícitas de status.
