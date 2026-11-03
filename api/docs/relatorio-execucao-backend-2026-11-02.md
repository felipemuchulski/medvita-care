# MedVita Care — Relatório de correção e evolução do back-end

**Data da execução:** 2 de novembro de 2026  
**Escopo:** exclusivamente o diretório `api`  
**Resultado:** correções críticas implementadas, `ClinicUsersModule` concluído, build/lint aprovados e 23 testes temporários aprovados

---

## 1. Resumo executivo

A execução estabilizou os pontos críticos identificados no relatório anterior e transformou o módulo de vínculos entre clínicas e usuários de estrutural em funcional.

Foram entregues:

- criação de clínica sem e-mail corrigida;
- bloqueio da alteração de `active` pela atualização cadastral da clínica;
- processo inicial do administrador global definido como operação manual no PostgreSQL;
- migration compatível para garantir `uuid-ossp` antes da migration inicial;
- validação global com whitelist, rejeição de campos desconhecidos e transformação;
- validação de UUIDs e filtro booleano de usuários;
- tratamento de concorrência para restrições únicas de Usuários e Clínicas;
- entidades adaptadas para relações TypeORM seguras em ESM;
- `ClinicUsersModule` com DTOs, service, controller, autorização e proteção do último administrador;
- testes temporários unitários e E2E, posteriormente removidos conforme solicitado.

O front-end não foi alterado. As mudanças locais já existentes no diretório `web` foram preservadas.

---

## 2. Correções realizadas

### 2.1. Clínica sem e-mail

**Problema:** `CreateClinicDto.email` era opcional, mas `ClinicService.create()` sempre enviava o valor ao normalizador, que exige string.

**Solução:** o e-mail agora só é normalizado quando informado. O cadastro sem e-mail permanece permitido e erros de unicidade do documento são convertidos para `409 Conflict`, inclusive quando resultam de concorrência no banco.

**Contrato HTTP:** não houve quebra. `email` continua opcional em `POST /clinics`.

### 2.2. Alteração indevida do status da clínica

**Problema:** `UpdateClinicDto` aceitava `active`, permitindo que `ADMIN` da clínica contornasse a rota exclusiva de administrador do sistema.

**Solução:** `active` foi removido de `UpdateClinicDto`. Com o `ValidationPipe` global, o campo agora é rejeitado em `PATCH /clinics/:id` com `400 Bad Request`.

O status continua modificável apenas por:

```http
PATCH /clinics/:id/active
```

Essa rota permanece protegida por `@SystemAdmin()`.

### 2.3. Primeiro administrador global

Por decisão do projeto, não existe mecanismo automatizado nem endpoint público para criar o primeiro administrador. O cadastro inicial será realizado manualmente no PostgreSQL por meio do DBeaver.

O registro deve continuar respeitando o modelo da tabela `users`, incluindo e-mail único, usuário ativo, `is_system_admin = true` e senha armazenada exclusivamente como hash bcrypt. Senhas em texto puro não devem ser persistidas.

Depois que o primeiro administrador conseguir autenticar, as regras existentes de `@SystemAdmin()` continuam protegendo a administração global. A API reconhece normalmente qualquer usuário ativo cujo campo `isSystemAdmin` esteja definido como verdadeiro.

### 2.4. Migrations e UUID

A migration histórica utiliza `uuid_generate_v4()`. Para não alterar uma migration possivelmente aplicada, foi adicionada uma migration anterior a ela na ordenação:

```text
1792265281000-EnableUuidOsspExtension.ts
1792265281923-AddIsSystemAdminToUsers.ts
1793210400000-AddAuthSessionsAndTokenRevocation.ts
```

A nova migration executa `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`. Seu rollback não remove a extensão, pois ela pode ser compartilhada e sua remoção seria potencialmente destrutiva.

### 2.5. Validação global e parâmetros

O `ValidationPipe` global passou a utilizar:

```ts
{
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}
```

Também foram implementados:

- `ParseUUIDPipe` nos parâmetros UUID de Usuários, Clínicas e ClinicUsers;
- `FindUsersQueryDto` para aceitar somente `active=true` ou `active=false`;
- validação central das variáveis essenciais de banco, JWT, portas e TTLs;
- exigência de refresh secret independente em produção;
- preservação dos nomes JWT legados usados pelo projeto.

### 2.6. Unicidade e serialização

- violações PostgreSQL `23505` de e-mail/documento agora são traduzidas para `409 Conflict` nos fluxos revisados;
- `passwordHash` continua protegido por `@Exclude()`;
- listagens do `ClinicUsersModule` retornam projeções explícitas de usuário/clínica, sem hash de senha;
- relações das entidades passaram a usar `Relation<T>`, evitando ciclos de metadados no ambiente ESM do NestJS 12 sem alterar o schema.

---

## 3. ClinicUsersModule

### 3.1. Funcionalidades implementadas

- vincular usuário a uma clínica;
- listar usuários vinculados a uma clínica;
- listar clínicas vinculadas ao próprio usuário;
- permitir ao administrador do sistema consultar vínculos de outro usuário;
- alterar papel;
- ativar ou desativar vínculo;
- impedir vínculo duplicado;
- validar existência e situação de usuário e clínica;
- exigir `ADMIN` como primeiro vínculo ativo;
- impedir remoção, desativação ou rebaixamento do último administrador ativo;
- negar administração de vínculos de outra clínica.

As alterações que podem retirar um administrador bloqueiam, dentro de transação, o conjunto de administradores ativos da clínica. Isso evita que duas requisições concorrentes deixem a clínica sem administrador.

### 3.2. Endpoints para integração com React

Todos os endpoints exigem:

```http
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

#### Criar vínculo

```http
POST /clinics/:clinicId/users
```

Permissão: `ADMIN` da própria clínica ou administrador do sistema.

```json
{
  "userId": "UUID_V4",
  "role": "RECEPTIONIST"
}
```

Resposta `201`:

```json
{
  "id": "UUID",
  "clinicId": "UUID",
  "userId": "UUID",
  "role": "RECEPTIONIST",
  "active": true,
  "createdAt": "2026-11-02T12:00:00.000Z",
  "updatedAt": "2026-11-02T12:00:00.000Z"
}
```

#### Listar usuários da clínica

```http
GET /clinics/:clinicId/users
```

Permissão: qualquer vínculo ativo da própria clínica ou administrador do sistema.

A resposta é uma lista de vínculos com uma projeção segura de `user` contendo `id`, `name`, `email` e `active`.

#### Listar clínicas do usuário

```http
GET /users/:userId/clinics
```

Permissão: o próprio usuário ou administrador do sistema.

A resposta é uma lista de vínculos com uma projeção de `clinic` contendo `id`, `name`, `document` e `active`.

#### Alterar papel

```http
PATCH /clinics/:clinicId/users/:userId/role
```

Permissão: `ADMIN` da própria clínica ou administrador do sistema.

```json
{
  "role": "OPHTHALMOLOGIST"
}
```

#### Ativar ou desativar vínculo

```http
PATCH /clinics/:clinicId/users/:userId/active
```

Permissão: `ADMIN` da própria clínica ou administrador do sistema.

```json
{
  "active": false
}
```

### 3.3. Papéis aceitos

```text
ADMIN
OPHTHALMOLOGIST
RECEPTIONIST
```

### 3.4. Erros esperados pelo frontend

| Status | Situação |
| --- | --- |
| `400` | DTO inválido, UUID inválido, clínica/usuário inativo ou tentativa de remover o último administrador |
| `401` | Access token ausente, inválido, expirado ou sessão revogada |
| `403` | Papel insuficiente, acesso a outra clínica ou consulta aos vínculos de outro usuário |
| `404` | Clínica, usuário ou vínculo inexistente |
| `409` | Vínculo já existente |

Campos desconhecidos nos bodies são rejeitados com `400`.

---

## 4. Estado dos módulos

| Módulo | Estado após a execução | Observação |
| --- | --- | --- |
| Aplicação/configuração | Funcional com hardening básico | Pipe e ambiente validados |
| Banco/migrations | Implementado; homologação isolada pendente | Migration UUID adicionada |
| Autenticação | Implementada e coberta por testes unitários temporários | Falta E2E real com PostgreSQL |
| Autorização | Implementada e coberta por testes temporários | Isolamento HTTP do novo módulo validado |
| Usuários | Funcional parcial | Ainda sem paginação |
| Clínicas | Funcional parcial | Correções P0 concluídas; ainda sem paginação |
| Usuários por clínica | Funcional | DTOs, service, controller e regras entregues |
| Profissionais | Funcional | Cadastro, atualização e consultas por clínica entregues |
| Pacientes | Funcional | CRUD lógico, CPF, paginação, filtros e isolamento entregues |
| Agendamentos | Estrutural | Depende de Profissionais e Pacientes |
| Atendimentos | Estrutural | Depende de Agendamentos e modelagem clínica incremental |
| Auditoria clínica | Ausente | Necessária antes de produção |

---

## 5. Testes e validações

### 5.1. Resultado final dos testes temporários

```text
Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
Snapshots:   0 total
```

### 5.2. Cenários avaliados

**Autenticação:**

- login válido com emissão de access/refresh token e criação de sessão;
- credenciais/e-mail inexistente retornando erro genérico;
- usuário inativo;
- rotação de refresh token;
- logout com revogação de sessão e access token;
- troca de senha e revogação das sessões.

**Autorização:**

- administrador do sistema;
- `ADMIN`, `OPHTHALMOLOGIST` e `RECEPTIONIST` na própria clínica;
- papel insuficiente;
- acesso cruzado entre clínicas.

**Clínicas e vínculos:**

- clínica sem e-mail;
- violação única de documento;
- rejeição de `active` na atualização cadastral;
- primeiro vínculo obrigatoriamente `ADMIN`;
- vínculo duplicado;
- proteção do último administrador ativo.

**HTTP/E2E aplicável:**

- criação de vínculo pelo administrador da própria clínica;
- bloqueio da administração de outra clínica;
- UUID inválido;
- campo não permitido no DTO;
- consulta indevida aos vínculos de outro usuário.

### 5.3. Problemas encontrados durante os testes

1. A combinação Jest 30, ts-jest 29 e NestJS 12 exigiu execução temporária em ESM.
2. O ESM revelou ciclos de metadados nas entidades; as propriedades de relacionamento foram corrigidas para `Relation<T>`.
3. Um cenário esperava validação UUID antes da autorização, mas guards são executados antes dos pipes. O teste foi ajustado para usar administrador do sistema e alcançar o pipe; o comportamento de negar primeiro um usuário sem contexto válido foi preservado.

### 5.4. Build e lint

Antes da limpeza dos testes temporários:

```text
npm.cmd run build → aprovado
npm.cmd run lint  → aprovado
```

Após a limpeza, ambos foram executados novamente; o resultado final está na seção 9.

---

## 6. Banco de dados

### 6.1. Migrations analisadas

| Migration | Função |
| --- | --- |
| `EnableUuidOsspExtension1792265281000` | Garante `uuid-ossp` antes da criação das tabelas |
| `AddIsSystemAdminToUsers1792265281923` | Cria o schema inicial do domínio |
| `AddAuthSessionsAndTokenRevocation1793210400000` | Adiciona versão do token, sessões e blacklist |

### 6.2. Estado do banco configurado

O comando somente leitura `migration:show` retornou:

```text
[ ] EnableUuidOsspExtension1792265281000
[X] AddIsSystemAdminToUsers1792265281923
[ ] AddAuthSessionsAndTokenRevocation1793210400000
```

Portanto, a migration de autenticação está pendente nesse ambiente. A API de autenticação depende de `users.token_version`, `auth_sessions` e `revoked_tokens`; o ambiente deve executar as migrations pendentes por um procedimento controlado antes da homologação.

Nenhuma migration foi executada no banco configurado durante esta tarefa.

### 6.3. Tentativa de validação isolada

Foi criado um verificador temporário para:

- criar banco com nome aleatório;
- executar todas as migrations `up`;
- conferir extensão e tabelas;
- executar todos os `down`;
- excluir o banco temporário.

O PostgreSQL recusou `CREATE DATABASE` para o usuário configurado. O banco temporário não chegou a ser criado. Também não havia daemon Docker disponível para uma alternativa isolada.

Assim, a validação completa `up/down` permanece pendente. Para concluí-la, deve-se usar CI ou ambiente local com PostgreSQL descartável e permissão para criar banco.

---

## 7. Preparação dos módulos seguintes

### 7.1. ProfessionalsModule

**Dependências:** Usuários e ClinicUsers.

O perfil profissional é global por usuário, enquanto a atuação na clínica é determinada pelo vínculo `OPHTHALMOLOGIST`. Isso permite que o mesmo profissional atue em várias clínicas sem duplicar CRM.

Entregas concluídas:

- DTOs de criação e atualização;
- consultas por ID, usuário, CRM/UF e clínica;
- normalização de CRM, UF e RQE;
- validação de usuário, clínica e vínculo de oftalmologista ativos;
- escrita por administradores e leitura conforme papel;
- isolamento entre clínicas e escopo próprio do oftalmologista.

Os contratos e a validação estão registrados em `docs/relatorio-professionals-2026-11-02.md`.

Migration futura possível: índices de pesquisa ou campos profissionais adicionais. Não é necessário adicionar `clinicId` ao perfil enquanto os dados profissionais forem globais.

### 7.2. PatientsModule

**Dependências:** autorização por clínica.

Entregas concluídas:

- CRUD lógico com `clinicId` vindo da rota, não do body;
- CPF opcional, normalizado, validado e único por clínica;
- paginação e filtros por nome, CPF e status;
- ativação/desativação lógica;
- autorização por papel e isolamento entre clínicas;
- método de validação de paciente ativo preparado para Agendamentos.

Os contratos e resultados estão registrados em `docs/relatorio-patients-2026-11-02.md`.

Migrations futuras possíveis: índices para buscas e regras adicionais de integridade. A unicidade parcial de CPF por clínica já existe.

### 7.3. AppointmentsModule

**Dependências:** Professionals e Patients.

Regras obrigatórias:

- paciente deve pertencer à clínica;
- profissional deve possuir vínculo ativo `OPHTHALMOLOGIST` na clínica;
- duração deve ser positiva;
- transições de status devem ser explícitas;
- conflito deve considerar início e término, não apenas igualdade de horário;
- reagendamento e cancelamento precisam de política de concorrência.

Migrations futuras recomendadas: checks de duração, índices por clínica/profissional/data/status e, após decisão de produto, mecanismo de exclusão ou bloqueio para conflitos de agenda.

### 7.4. EncountersModule

**Dependências:** Appointments.

O service deve garantir que clínica, paciente e profissional coincidem com o agendamento dentro da mesma transação.

A coluna `clinical_notes` pode permanecer como observação geral no MVP, mas não deve concentrar toda a modelagem oftalmológica. A evolução recomendada é criar registros clínicos versionados para:

- anamnese;
- acuidade visual;
- pressão intraocular;
- lateralidade `OD`, `OS` ou ambos;
- diagnóstico, conduta e histórico;
- autoria e trilha de alterações.

Essa modelagem deve ser definida em migration própria depois de validar os requisitos clínicos. Não foi implementada nesta etapa.

### 7.5. Ordem recomendada

```text
Professionals
    ↓
Patients
    ↓
Appointments
    ↓
Encounters
    ↓
Modelo oftalmológico versionado e auditoria clínica
```

---

## 8. Arquivos permanentes principais

### Novos

- `src/config/env.validation.ts`;
- `src/common/utils/database-error.util.ts`;
- `src/database/migrations/1792265281000-EnableUuidOsspExtension.ts`;
- `src/users/dto/find-users-query.dto.ts`;
- `src/clinic-users/clinic-users.controller.ts`;
- `src/clinic-users/clinic-users.service.ts`;
- `src/clinic-users/dto/create-clinic-user.dto.ts`;
- `src/clinic-users/dto/update-clinic-user-role.dto.ts`;
- `src/clinic-users/dto/update-clinic-user-active.dto.ts`.

### Alterados

- configuração global e exemplo de ambiente;
- controllers/services/DTOs de Usuários e Clínicas;
- `ClinicUsersModule`;
- entidades relacionais do domínio e autenticação;
- `tsconfig.json` para limitar o build de produção a `src`;
- documentação de status.

---

## 9. Limpeza dos testes temporários e resultado final

Após salvar este relatório, foram removidos:

- quatro arquivos temporários de testes unitários/E2E;
- verificador temporário de migrations;
- `jest.temp.config.cjs`;
- `tsconfig.temp.json`;
- script `test:temp` do `package.json`.

Nenhuma dependência foi adicionada para os testes; portanto, não houve dependência nova a remover. Os services, controllers, DTOs, entidades, migrations e scripts necessários à API foram preservados.

Resultado final após a limpeza:

```text
npm.cmd run build → aprovado
npm.cmd run lint  → aprovado, sem erros exibidos
```

---

## 10. Pendências prioritárias

1. Executar as migrations pendentes em ambiente controlado e validar login real.
2. Criar uma suíte permanente de testes ligada a PostgreSQL descartável no CI.
3. Implementar AppointmentsModule com proteção contra conflitos concorrentes.
4. Implementar EncountersModule e a modelagem clínica incremental.
5. Adicionar auditoria clínica, OpenAPI, health checks, logs estruturados e limpeza de sessões expiradas.

