# MedVita Care — Relatório de implementação do ProfessionalsModule

**Data da execução:** 2 de novembro de 2026  
**Escopo:** diretório `api`, exclusivamente o módulo de profissionais e sua integração mínima com vínculos por clínica  
**Resultado:** implementação concluída e validada localmente

## 1. Resumo executivo

O `ProfessionalsModule` passou de estrutural para funcional. A API agora permite cadastrar, atualizar e consultar perfis profissionais globais associados a usuários existentes, sempre validando o contexto da clínica e o vínculo ativo com papel `OPHTHALMOLOGIST`.

O modelo existente foi preservado:

```text
User 1 ── 0..1 ProfessionalProfile
  │
  └──< ClinicUser >── Clinic
```

O perfil profissional não é duplicado por clínica. O mesmo perfil pode ser utilizado em várias clínicas, desde que o usuário possua um vínculo ativo de oftalmologista em cada uma delas. Criar um perfil não cria usuário, vínculo nem permissão automaticamente.

Não foi necessária migration: a tabela existente já possui chave estrangeira para `users`, unicidade de `user_id` e índice único para `crm + crm_state`.

## 2. Arquivos criados

- `src/professionals/constants/brazilian-states.constant.ts`;
- `src/professionals/dto/create-professional.dto.ts`;
- `src/professionals/dto/update-professional.dto.ts`;
- `src/professionals/professional-registration.util.ts`;
- `src/professionals/professionals.controller.ts`;
- `src/professionals/professionals.service.ts`;
- `docs/relatorio-professionals-2026-11-02.md`.

## 3. Arquivos modificados

- `src/professionals/professionals.module.ts`: registro do controller, service e dependências; exportação do service;
- `src/professionals/entities/professional-profile.entity.ts`: tipagem de `rqe` ajustada para refletir a nulabilidade já existente no banco, sem alteração estrutural;
- `src/clinic-users/clinic-users.service.ts`: consulta reutilizável de vínculo ativo por clínica, usuário e papel;
- `docs/relatorio-status-api.md`: estado do módulo e backlog atualizados;
- `docs/relatorio-execucao-backend-2026-11-02.md`: planejamento atualizado para registrar Profissionais como concluído.

Nenhum arquivo do diretório `web` foi modificado nesta execução.

## 4. Regras de negócio implementadas

- o usuário precisa existir e estar ativo;
- a clínica precisa existir e estar ativa;
- o usuário precisa possuir vínculo ativo com a clínica e papel `OPHTHALMOLOGIST`;
- um usuário possui no máximo um perfil profissional global;
- a combinação CRM + UF é única;
- CRM e RQE são normalizados para letras maiúsculas e caracteres alfanuméricos;
- a UF do CRM aceita apenas as 27 unidades federativas brasileiras;
- a especialidade padrão é `Oftalmologia`;
- `userId` não pode ser trocado na atualização;
- `rqe` pode ser removido com `null` ou string vazia;
- não existe exclusão física de perfil;
- violações de unicidade do PostgreSQL são convertidas para `409 Conflict`, sem exposição de detalhes internos;
- consultas retornam somente usuários ativos, clínicas ativas e vínculos ativos de oftalmologista.

### 4.1. Matriz de autorização

| Operação | Administrador global | `ADMIN` da clínica | `RECEPTIONIST` da clínica | `OPHTHALMOLOGIST` da clínica |
| --- | --- | --- | --- | --- |
| Cadastrar perfil | Sim | Sim | Não | Não |
| Atualizar perfil | Sim | Sim | Não | Não |
| Listar profissionais | Todos da clínica | Todos da clínica | Todos da clínica | Apenas o próprio perfil |
| Consultar por ID/CRM | Todos da clínica | Todos da clínica | Todos da clínica | Apenas o próprio perfil |
| Consultar por usuário | Todos da clínica | Todos da clínica | Todos da clínica | Apenas o próprio usuário |

O `AuthorizationGuard` valida o papel e o `clinicId` da rota. O service repete as verificações administrativas e aplica o escopo de leitura, além de filtrar o profissional pelo vínculo ativo da clínica. Essa combinação bloqueia acesso cruzado mesmo quando um identificador válido de outra clínica é informado.

## 5. Contrato comum de resposta

Os endpoints que retornam um perfil usam este formato:

```json
{
  "id": "0ea6206c-a4f4-4dc8-843f-ec9861db74be",
  "userId": "dd387259-ec0a-48ea-943f-55b958bde539",
  "crm": "123456",
  "crmState": "SP",
  "rqe": "9987",
  "specialty": "Oftalmologia",
  "createdAt": "2026-11-02T13:00:00.000Z",
  "updatedAt": "2026-11-02T13:00:00.000Z",
  "user": {
    "id": "dd387259-ec0a-48ea-943f-55b958bde539",
    "name": "Dra. Ana Silva",
    "email": "ana@medvita.com.br",
    "active": true
  }
}
```

Todos os endpoints exigem:

```http
Authorization: Bearer ACCESS_TOKEN
```

## 6. Endpoints para integração com React

### 6.1. Cadastrar perfil profissional

```http
POST /clinics/:clinicId/professionals
```

**Permissão:** administrador global ou `ADMIN` ativo da clínica.  
**Parâmetros:** `clinicId` deve ser UUID v4.  
**DTO:** `CreateProfessionalDto`.

```json
{
  "userId": "dd387259-ec0a-48ea-943f-55b958bde539",
  "crm": "123.456-7",
  "crmState": "sp",
  "rqe": "9.987",
  "specialty": "Oftalmologia Pediátrica"
}
```

`rqe` e `specialty` são opcionais. A resposta é o contrato comum, com status `201 Created`.

**Possíveis erros:**

- `400`: DTO inválido, UF inválida, clínica/usuário inativo ou ausência de vínculo oftalmologista ativo;
- `401`: token ausente, inválido ou expirado;
- `403`: usuário sem permissão administrativa na clínica;
- `404`: clínica ou usuário inexistente;
- `409`: usuário já possui perfil ou CRM/UF já está em uso.

### 6.2. Listar profissionais da clínica

```http
GET /clinics/:clinicId/professionals
```

**Permissão:** administrador global ou qualquer papel ativo na clínica. Recepção e administradores recebem o diretório; oftalmologistas recebem somente o próprio perfil.  
**DTO:** não possui body ou query string. `clinicId` é validado por `ParseUUIDPipe`.

Resposta `200 OK`:

```json
[
  {
    "id": "0ea6206c-a4f4-4dc8-843f-ec9861db74be",
    "userId": "dd387259-ec0a-48ea-943f-55b958bde539",
    "crm": "1234567",
    "crmState": "SP",
    "rqe": "9987",
    "specialty": "Oftalmologia Pediátrica",
    "createdAt": "2026-11-02T13:00:00.000Z",
    "updatedAt": "2026-11-02T13:00:00.000Z",
    "user": {
      "id": "dd387259-ec0a-48ea-943f-55b958bde539",
      "name": "Dra. Ana Silva",
      "email": "ana@medvita.com.br",
      "active": true
    }
  }
]
```

**Possíveis erros:** `400` para UUID/clínica inativa, `401`, `403` ou `404` para clínica inexistente.

### 6.3. Consultar perfil pelo ID

```http
GET /clinics/:clinicId/professionals/:id
```

**Permissão:** administrador global, `ADMIN` e `RECEPTIONIST` da clínica; `OPHTHALMOLOGIST` somente para o próprio perfil.  
**Parâmetros:** `clinicId` e `id` são UUID v4.  
**DTO:** não possui body. Os parâmetros são validados por `ParseUUIDPipe`.  
**Resposta:** contrato comum com status `200 OK`.

**Possíveis erros:** `400`, `401`, `403` e `404` quando o perfil não existe ou não está autorizado na clínica.

### 6.4. Consultar perfil pelo usuário

```http
GET /clinics/:clinicId/professionals/user/:userId
```

Exemplo:

```http
GET /clinics/8d30fbf4-a5a1-4c3d-8c86-8be9182d0946/professionals/user/dd387259-ec0a-48ea-943f-55b958bde539
```

**Permissão:** administrador global, `ADMIN` e `RECEPTIONIST` da clínica; `OPHTHALMOLOGIST` apenas quando `userId` é o próprio `sub` autenticado.  
**DTO:** não possui body. `clinicId` e `userId` são validados por `ParseUUIDPipe`.  
**Resposta:** contrato comum com status `200 OK`.

**Possíveis erros:** `400`, `401`, `403` e `404` quando não há perfil autorizado para o usuário na clínica.

### 6.5. Consultar por CRM e UF

```http
GET /clinics/:clinicId/professionals/crm/:crm/:crmState
```

Exemplo:

```http
GET /clinics/8d30fbf4-a5a1-4c3d-8c86-8be9182d0946/professionals/crm/123.456-7/SP
```

**Permissão:** administrador global, `ADMIN` e `RECEPTIONIST` da clínica; `OPHTHALMOLOGIST` somente quando o resultado é seu próprio perfil.  
**Parâmetros:** `clinicId` UUID v4, CRM normalizável e UF brasileira válida.  
**DTO:** não possui body; CRM e UF são normalizados e validados pelo service.  
**Resposta:** contrato comum com status `200 OK`.

**Possíveis erros:**

- `400`: UUID, CRM ou UF inválidos, ou clínica inativa;
- `401`: token inválido ou ausente;
- `403`: ausência de papel na clínica;
- `404`: perfil não encontrado ou não autorizado no contexto informado.

### 6.6. Atualizar perfil profissional

```http
PATCH /clinics/:clinicId/professionals/:id
```

**Permissão:** administrador global ou `ADMIN` ativo da clínica.  
**DTO:** `UpdateProfessionalDto`; todos os campos são opcionais e `userId` não é aceito.

```json
{
  "crm": "765.432-1",
  "crmState": "RJ",
  "rqe": null,
  "specialty": "Retina e Vítreo"
}
```

A resposta é o contrato comum atualizado, com status `200 OK`. Como o perfil é global, a atualização é refletida em todas as clínicas nas quais o usuário atua como oftalmologista.

**Possíveis erros:** `400` para DTO/UF/clínica inválidos, `401`, `403`, `404` e `409` para CRM/UF já utilizado.

## 7. Validações executadas

| Verificação | Resultado |
| --- | --- |
| `npm.cmd run build` | Aprovado |
| `npm.cmd run lint` | Aprovado após formatação automática dos arquivos implementados |
| Testes temporários do service | Aprovados |
| Testes temporários de autorização HTTP | Aprovados |
| Total dos testes temporários | 17 testes em 2 suítes, todos aprovados |
| Teste com PostgreSQL real | Não executado |
| Migration nova | Não necessária |

Os testes temporários cobriram normalização, criação válida, usuário/clínica inativos, vínculo oftalmologista ausente, duplicidade de perfil e CRM/UF, escopo próprio do oftalmologista, leitura pela recepção, bloqueio de escrita sem papel administrativo, administrador global, acesso cruzado entre clínicas, UF inválida e UUID inválido.

O primeiro disparo do Jest não executou os casos por incompatibilidade entre a configuração CommonJS temporária e os pacotes ESM do NestJS 12. A configuração temporária foi corrigida para ESM; na execução válida, as duas suítes e os 17 testes foram aprovados. Os arquivos temporários foram removidos após o registro deste resultado e não passam a integrar o projeto.

## 8. Pendências e melhorias futuras

- validar os mesmos fluxos contra uma instância descartável de PostgreSQL;
- incorporar uma suíte permanente de testes unitários e E2E ao projeto e ao CI;
- adicionar paginação à listagem quando o volume de profissionais justificar;
- documentar os contratos em Swagger/OpenAPI quando essa infraestrutura for implementada;
- definir, como decisão de produto separada, eventual integração para verificar regularidade profissional no conselho. A API atual valida apenas formato, vínculo e unicidade;
- considerar uma trilha de auditoria para alterações de dados profissionais na etapa de auditoria do produto.

## 9. Preparação para o AppointmentsModule

O `ProfessionalsModule` está preparado para integração com o futuro `AppointmentsModule` porque:

- o `ProfessionalsService` está exportado;
- existe consulta por usuário dentro do contexto da clínica;
- as consultas exigem usuário, clínica e vínculo oftalmologista ativos;
- a listagem fornece profissionais válidos para seleção em agenda;
- o modelo global evita perfis duplicados quando o médico atua em várias clínicas.

O `AppointmentsModule` deverá importar `ProfessionalsModule` e continuar validando o profissional no mesmo `clinicId` do agendamento. Essa integração não foi implementada nesta execução.
