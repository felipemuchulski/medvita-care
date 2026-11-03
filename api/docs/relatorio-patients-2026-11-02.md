# MedVita Care — Relatório de implementação do PatientsModule

**Data da execução:** 2 de novembro de 2026  
**Escopo:** diretório `api`, exclusivamente o gerenciamento de pacientes e as integrações mínimas necessárias  
**Resultado:** módulo implementado e validado localmente, sem homologação em PostgreSQL real

## 1. Resumo executivo

O `PatientsModule` passou de estrutural para funcional. A API agora permite cadastrar, listar, pesquisar, consultar, atualizar, ativar e desativar pacientes dentro do contexto obrigatório de uma clínica.

O modelo de banco existente foi preservado:

```text
Clinic 1 ──< Patient 1 ──< Appointment
                   └─────< Encounter
```

Não foi necessária migration. A tabela `patients` já possui a chave estrangeira `clinic_id`, CPF anulável, índice único parcial para `clinic_id + cpf`, controle de status e relações sem exclusão em cascata com agendamentos e atendimentos.

O CPF é armazenado com 11 dígitos, validado pelos dígitos verificadores e pode se repetir em clínicas diferentes. Datas de nascimento permanecem como texto `YYYY-MM-DD` compatível com a coluna PostgreSQL `date`, evitando conversões de fuso horário.

## 2. Arquivos criados

- `src/patients/dto/create-patient.dto.ts`;
- `src/patients/dto/update-patient.dto.ts`;
- `src/patients/dto/list-patients-query.dto.ts`;
- `src/patients/dto/update-patient-active.dto.ts`;
- `src/patients/utils/cpf.util.ts`;
- `src/patients/utils/is-cpf.validator.ts`;
- `src/patients/utils/date-only.util.ts`;
- `src/patients/patients.controller.ts`;
- `src/patients/patients.service.ts`;
- `docs/relatorio-patients-2026-11-02.md`.

## 3. Arquivos modificados

- `src/patients/patients.module.ts`: registro de controller, service, repositório e dependência de Clínicas; exportação do service;
- `src/patients/entities/patient.entity.ts`: tipagem dos campos anuláveis alinhada ao esquema já existente, sem mudança estrutural;
- `docs/relatorio-status-api.md`: PatientsModule marcado como funcional e backlog atualizado;
- `docs/relatorio-execucao-backend-2026-11-02.md`: planejamento atualizado para indicar Agendamentos como próxima etapa.

Nenhum arquivo do diretório `web` foi modificado nesta execução.

## 4. Regras de negócio implementadas

- `clinicId` é obtido exclusivamente da rota;
- toda consulta e alteração filtra simultaneamente por paciente e clínica;
- a clínica precisa existir e estar ativa;
- pacientes não são transferidos entre clínicas por atualização cadastral;
- nome e data de nascimento são obrigatórios;
- data de nascimento deve existir no calendário, usar `YYYY-MM-DD` e não pode ser futura;
- CPF é opcional, normalizado e validado;
- sequências repetidas e dígitos verificadores inválidos são rejeitados;
- CPF é único dentro da clínica e pode se repetir em clínicas diferentes;
- e-mail é validado e armazenado em letras minúsculas;
- CEP é armazenado somente com oito dígitos;
- UF é normalizada e validada contra as unidades federativas brasileiras;
- campos opcionais podem ser removidos com `null`;
- `id`, `clinicId`, `active`, `createdAt` e `updatedAt` não são aceitos no DTO de atualização cadastral;
- status é alterado apenas pela rota específica;
- desativação é lógica e não remove relações históricas;
- erros de unicidade do PostgreSQL são convertidos para `409 Conflict`.

## 5. Matriz de autorização

| Operação | `ADMIN` | `RECEPTIONIST` | `OPHTHALMOLOGIST` | Administrador global sem vínculo |
| --- | --- | --- | --- | --- |
| Cadastrar paciente | Sim | Sim | Não | Não |
| Listar/pesquisar | Sim | Sim | Sim | Não |
| Consultar por ID | Sim | Sim | Sim | Não |
| Atualizar cadastro | Sim | Sim | Não | Não |
| Ativar/desativar | Sim | Não | Não | Não |

O administrador global pode acessar pacientes somente quando também possui vínculo ativo com a clínica; nesse caso, recebe as permissões do papel do vínculo.

Essa regra foi aplicada no service porque o `AuthorizationGuard` compartilhado atualmente libera administradores globais nas rotas com `@ClinicRoles()`. O guard não foi alterado para evitar impacto nos módulos concluídos. A decisão de Pacientes segue acesso mínimo e impede acesso global automático a dados pessoais.

## 6. Contrato de paciente

```json
{
  "id": "97a70826-4a4f-4ad2-9c41-a41cb44947e7",
  "clinicId": "8d30fbf4-a5a1-4c3d-8c86-8be9182d0946",
  "name": "Maria da Silva",
  "cpf": "52998224725",
  "birthDate": "1990-05-20",
  "sex": "FEMALE",
  "phone": "(11) 99999-9999",
  "email": "maria@example.com",
  "zipCode": "12345678",
  "street": "Rua das Flores",
  "number": "100",
  "complement": "Sala 2",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "active": true,
  "createdAt": "2026-11-02T13:00:00.000Z",
  "updatedAt": "2026-11-02T13:00:00.000Z"
}
```

Campos opcionais podem aparecer como `null`. Os valores aceitos para `sex` são `MALE`, `FEMALE` e `NOT_INFORMED`.

Todos os endpoints exigem:

```http
Authorization: Bearer ACCESS_TOKEN
```

## 7. Endpoints para integração com React

### 7.1. Cadastrar paciente

```http
POST /clinics/:clinicId/patients
```

**Finalidade:** criar um paciente na clínica selecionada.  
**Permissão:** `ADMIN` ou `RECEPTIONIST` da clínica.  
**DTO:** `CreatePatientDto`.  
**Status de sucesso:** `201 Created`.

```json
{
  "name": "Maria da Silva",
  "cpf": "529.982.247-25",
  "birthDate": "1990-05-20",
  "sex": "FEMALE",
  "phone": "(11) 99999-9999",
  "email": "maria@example.com",
  "zipCode": "12345-678",
  "street": "Rua das Flores",
  "number": "100",
  "complement": "Sala 2",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP"
}
```

Somente `name` e `birthDate` são obrigatórios. `clinicId` e `active` não devem ser enviados no body. A resposta utiliza o contrato de paciente.

**Possíveis erros:**

- `400`: DTO, CPF, data, CEP ou UF inválidos; clínica inativa; campo não permitido;
- `401`: token ausente, inválido ou expirado;
- `403`: papel insuficiente ou vínculo em outra clínica;
- `404`: clínica inexistente;
- `409`: CPF já cadastrado na mesma clínica.

### 7.2. Listar e pesquisar pacientes

```http
GET /clinics/:clinicId/patients?page=1&limit=20&search=Maria&active=true
```

**Finalidade:** listar pacientes da clínica com paginação e filtros.  
**Permissão:** `ADMIN`, `RECEPTIONIST` ou `OPHTHALMOLOGIST`.  
**DTO:** `ListPatientsQueryDto`.  
**Status de sucesso:** `200 OK`.

| Parâmetro | Padrão | Regra |
| --- | --- | --- |
| `page` | `1` | inteiro entre 1 e 1.000.000 |
| `limit` | `20` | inteiro entre 1 e 100 |
| `search` | ausente | pesquisa parcial por nome ou CPF normalizado |
| `active` | ausente | aceita somente `true` ou `false`; ausente retorna ambos os status |

Resposta:

```json
{
  "data": [
    {
      "id": "97a70826-4a4f-4ad2-9c41-a41cb44947e7",
      "clinicId": "8d30fbf4-a5a1-4c3d-8c86-8be9182d0946",
      "name": "Maria da Silva",
      "cpf": "52998224725",
      "birthDate": "1990-05-20",
      "sex": "FEMALE",
      "phone": "(11) 99999-9999",
      "email": "maria@example.com",
      "zipCode": "12345678",
      "street": "Rua das Flores",
      "number": "100",
      "complement": null,
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "active": true,
      "createdAt": "2026-11-02T13:00:00.000Z",
      "updatedAt": "2026-11-02T13:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Possíveis erros:** `400` para filtros/UUID/clínica inativa, `401`, `403` ou `404` para clínica inexistente.

### 7.3. Consultar paciente por ID

```http
GET /clinics/:clinicId/patients/:id
```

**Finalidade:** carregar um paciente pertencente à clínica.  
**Permissão:** `ADMIN`, `RECEPTIONIST` ou `OPHTHALMOLOGIST`.  
**DTO:** sem body; ambos os IDs usam `ParseUUIDPipe` v4.  
**Status de sucesso:** `200 OK`.  
**Resposta:** contrato de paciente.

**Possíveis erros:** `400`, `401`, `403` e `404`. Um ID válido pertencente a outra clínica também retorna `404`, sem revelar a existência do registro.

### 7.4. Atualizar dados cadastrais

```http
PATCH /clinics/:clinicId/patients/:id
```

**Finalidade:** alterar os campos cadastrais permitidos.  
**Permissão:** `ADMIN` ou `RECEPTIONIST`.  
**DTO:** `UpdatePatientDto`, com os mesmos campos de criação, todos opcionais.  
**Status de sucesso:** `200 OK`.

```json
{
  "phone": "(11) 98888-7777",
  "email": "novo-email@example.com",
  "complement": null
}
```

A resposta utiliza o contrato atualizado. Para remover CPF ou outro campo opcional, envie `null`. O campo `active` é rejeitado nesta rota.

**Possíveis erros:** `400`, `401`, `403`, `404` e `409` quando o novo CPF já existe na clínica.

### 7.5. Ativar ou desativar paciente

```http
PATCH /clinics/:clinicId/patients/:id/active
```

**Finalidade:** realizar desativação ou reativação lógica.  
**Permissão:** somente `ADMIN` da clínica.  
**DTO:** `UpdatePatientActiveDto`.  
**Status de sucesso:** `200 OK`.

```json
{
  "active": false
}
```

A resposta utiliza o contrato atualizado. O valor precisa ser booleano JSON; strings no body não são convertidas.

**Possíveis erros:** `400`, `401`, `403` e `404`.

## 8. Orientação para o front-end React

- obtenha `clinicId` da clínica ativa selecionada entre os vínculos do usuário;
- inclua `clinicId` no caminho de todas as requisições, nunca no body;
- envie o access token no header `Authorization`;
- mantenha `page`, `limit`, `search` e `active` no estado da tela de listagem;
- ao alterar busca ou status, volte para `page=1`;
- use `meta.totalPages` para paginação e `meta.total` para o total exibido;
- aceite máscara de CPF no formulário; a API normaliza antes de persistir;
- envie datas de nascimento como `YYYY-MM-DD`, sem criar um objeto `Date` ou converter para UTC;
- trate `409` como CPF já utilizado na clínica;
- apresente mensagens de validação de `400` por campo;
- use a rota `/active` exclusivamente para ativar/desativar;
- remova ou desabilite ações de edição conforme o papel do usuário.

## 9. Relacionamentos e preparação para módulos seguintes

O paciente pertence a uma clínica e já possui relações `OneToMany` com `Appointment` e `Encounter`. A desativação apenas altera `patients.active`; nenhum agendamento ou atendimento existente é removido.

O `PatientsService` é exportado e oferece `findActiveForClinic(clinicId, patientId)`. O futuro `AppointmentsModule` poderá usar esse método para rejeitar paciente inexistente, inativo ou pertencente a outra clínica antes de criar um agendamento.

O `AppointmentsModule` deverá continuar validando o mesmo `clinicId` para paciente, profissional e agendamento. Essa integração ainda não foi implementada.

## 10. Validações executadas

| Verificação | Resultado |
| --- | --- |
| `npm.cmd run build` | Aprovado |
| `npm.cmd run lint` | Aprovado após formatação dos arquivos implementados |
| Testes temporários de service/utilitários | Aprovados |
| Testes temporários de endpoints e RBAC | Aprovados |
| Total | 21 testes em 2 suítes, todos aprovados |
| Teste em PostgreSQL real | Não executado |
| Migration nova | Não necessária |

Os testes cobriram CPF válido, máscara, dígitos inválidos, sequência repetida, normalizações, CPF duplicado, repetição entre clínicas, datas inválidas/futuras, clínica inativa, paginação, busca, filtro `active=false`, consulta isolada, permissões de cada papel, alteração de status, acesso cruzado, administrador global sem vínculo, campos proibidos, limite máximo e violação concorrente de unicidade.

Os testes temporários utilizaram Jest em modo ESM por compatibilidade com NestJS 12. Após esta documentação, somente os arquivos temporários criados nesta execução foram removidos.

## 11. Limitações e pendências

- os fluxos não foram executados contra uma instância descartável de PostgreSQL e, portanto, ainda não estão homologados com persistência real;
- o projeto continua sem uma suíte permanente de testes e script `test` no `package.json`;
- busca por nome é case-insensitive pelo PostgreSQL, mas não possui normalização de acentos;
- a listagem ainda não possui índices específicos para pesquisa textual; isso pode ser avaliado quando houver volume real;
- trilha de auditoria, política de retenção, anonimização e demais decisões LGPD permanecem para a etapa de auditoria;
- Swagger/OpenAPI ainda não está configurado;
- a política que restringe administrador global sem vínculo está no service de Pacientes porque o guard compartilhado mantém o bypass global usado por outros módulos.

## 12. Próxima etapa

Com Profissionais e Pacientes funcionais, a próxima entrega do caminho crítico é o `AppointmentsModule`, incluindo validação de paciente/profissional na mesma clínica, conflitos de horário e transições de status.
