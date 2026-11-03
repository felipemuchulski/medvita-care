# MedVita Care — Auditoria final do PatientsModule

**Data:** 2 de novembro de 2026  
**Escopo:** homologação lógica do `PatientsModule`, sem implementação de novos módulos  
**Resultado:** regras, DTOs, autorização e isolamento aprovados; persistência real não homologada por ausência de banco descartável

## 1. Resumo executivo

O código atual do `PatientsModule` foi revisado integralmente e submetido a testes temporários de utilitários, DTOs, service, controller e autorização HTTP.

Não foi reproduzido defeito funcional que justificasse alteração do código-fonte. Os 34 cenários automatizados executados foram aprovados, assim como build e lint.

O módulo está coerente com as regras documentadas para:

- isolamento obrigatório por `clinicId`;
- CPF opcional e único por clínica;
- validação cadastral;
- paginação, busca e filtro de status;
- atualização cadastral sem transferência de clínica;
- ativação e desativação lógica;
- matriz de permissões;
- bloqueio do administrador global sem vínculo clínico.

A persistência não foi declarada homologada. O único PostgreSQL configurado foi identificado como `medvita`, com usuário sem permissão para criar banco, e o Docker local não possui daemon ativo. Por segurança, nenhuma escrita foi executada nesse banco.

## 2. Componentes auditados

- `PatientsController`;
- `PatientsService`;
- `CreatePatientDto`;
- `UpdatePatientDto`;
- `ListPatientsQueryDto`;
- `UpdatePatientActiveDto`;
- entidade `Patient`;
- `normalizeCpf`, `isValidCpf` e `@IsCpf()`;
- utilitários de data sem horário;
- `PatientsModule`;
- `Clinic`, `Appointment` e `Encounter`;
- migration que criou `patients`;
- `JwtAuthGuard`, `AuthorizationGuard`, `@CurrentUser()` e `@ClinicRoles()`;
- configuração global do `ValidationPipe`.

## 3. Problemas encontrados

### 3.1. Defeitos funcionais reproduzidos

Nenhum.

Não foram encontrados acessos sem `clinicId`, alteração de `clinicId` pelo body, bypass de escrita por papel de leitura, aceitação silenciosa de filtro booleano inválido ou falha comprovada na validação de CPF/data.

### 3.2. Limitações comprovadas do ambiente

1. **Não existe PostgreSQL descartável disponível.** A conexão somente leitura identificou o banco configurado como `medvita` e o papel atual com `rolcreatedb = false`.
2. **Docker indisponível.** O executável existe, mas o daemon não está em execução; não foi possível iniciar um PostgreSQL isolado por contêiner.
3. **Não há suíte permanente de testes.** O `package.json` não possui script `test`; a validação desta auditoria precisou usar arquivos temporários.

### 3.3. Riscos conhecidos, sem falha atual

- o `AuthorizationGuard` permite bypass de `@ClinicRoles()` pelo administrador global. O `PatientsService` compensa corretamente essa política, exigindo um papel explícito no `clinicId` antes de consultar o banco;
- as chaves estrangeiras de `appointments` e `encounters` referenciam paciente e clínica separadamente. Não existe uma restrição composta no banco garantindo que ambos pertençam à mesma clínica. O futuro `AppointmentsModule` e o `EncountersModule` deverão validar essa coerência no service;
- não há índice específico para pesquisa textual por nome. Não foi comprovado problema de desempenho no volume atual;
- a busca `ILIKE` não remove diferenças de acentuação.

## 4. Correções realizadas

Nenhuma correção de código foi necessária.

A orientação da auditoria foi preservar a arquitetura e modificar somente problemas comprovados. Como todos os casos executados foram aprovados, nenhuma refatoração preventiva foi aplicada.

## 5. Arquivos modificados pela auditoria

- `docs/relatorio-auditoria-patients-2026-11-02.md`: criado para registrar a homologação.

Os arquivos temporários de teste e de inspeção do banco foram removidos após o registro dos resultados. Nenhum arquivo do diretório `web` foi modificado.

## 6. Verificação das regras implementadas

### 6.1. Isolamento por clínica

| Operação | Verificação no controller/guard | Verificação no service | Resultado |
| --- | --- | --- | --- |
| Criar | papel no `clinicId` da rota | papel explícito e clínica ativa | Aprovado |
| Listar | papel no `clinicId` da rota | `WHERE patient.clinic_id = :clinicId` | Aprovado |
| Consultar | papel no `clinicId` da rota | `findOneBy({ id, clinicId })` | Aprovado |
| Atualizar | papel de escrita na rota | papel de escrita e `findOneBy({ id, clinicId })` | Aprovado |
| Alterar status | `ADMIN` na rota | `ADMIN` e `findOneBy({ id, clinicId })` | Aprovado |

Quando um paciente não é encontrado no par `id + clinicId`, o service retorna `404`, sem consultar ou revelar um registro de outra clínica.

### 6.2. Matriz validada

| Papel | Criar | Ler | Atualizar cadastro | Alterar status |
| --- | --- | --- | --- | --- |
| `ADMIN` da clínica | Permitido | Permitido | Permitido | Permitido |
| `RECEPTIONIST` da clínica | Permitido | Permitido | Permitido | Negado |
| `OPHTHALMOLOGIST` da clínica | Negado | Permitido | Negado | Negado |
| Usuário de outra clínica | Negado | Negado | Negado | Negado |
| Administrador global sem vínculo | Negado pelo service | Negado pelo service | Negado pelo service | Negado pelo service |

### 6.3. CPF

Foram confirmados:

- remoção de máscara e espaços;
- armazenamento esperado com 11 dígitos;
- cálculo dos dois dígitos verificadores;
- rejeição de sequências repetidas;
- rejeição de letras e caracteres fora do formato aceito pelo DTO/service;
- aceitação de CPF ausente ou `null`;
- conflito para CPF repetido dentro da clínica;
- consulta de duplicidade restrita à clínica, permitindo o mesmo CPF em outra clínica;
- conversão de erro PostgreSQL `23505` em `409 Conflict`.

### 6.4. Datas

Foram confirmados:

- formato exclusivo `YYYY-MM-DD`;
- validação de dias reais do calendário;
- tratamento correto de ano bissexto;
- rejeição de data futura;
- rejeição de timestamp com horário;
- ausência de conversão para UTC antes da persistência.

### 6.5. Outros dados

- nome é obrigatório, aparado e limitado pelo DTO;
- e-mail é validado e normalizado para minúsculas;
- CEP aceita formato com ou sem hífen e é persistido com oito dígitos;
- UF é normalizada e validada no service contra as unidades federativas;
- campos opcionais aceitam `null` na atualização;
- `clinicId`, `active` e demais campos fora do DTO são rejeitados pelo `ValidationPipe`;
- `active=false` na query permanece booleano falso;
- valores ambíguos como `active=0` são rejeitados;
- `page` e `limit` respeitam os intervalos definidos, com limite máximo de 100 registros.

## 7. Cenários realmente executados

Foram executados 34 testes em 2 suítes temporárias:

- três CPFs válidos com e sem máscara;
- CPFs com dígito incorreto, sequência repetida e tamanho inválido;
- normalização de CPF;
- datas válidas, ano bissexto, datas inexistentes, timestamp e data futura;
- DTO de criação com campos opcionais nulos;
- rejeição de CPF com letras, CEP inválido e UF inválida;
- transformação de paginação e `active=false`;
- rejeição de paginação e booleano fora do contrato;
- limpeza de campos opcionais por `null`;
- criação com normalização e `clinicId` controlado pelo service;
- CPF duplicado na mesma clínica e consulta em clínica diferente;
- rejeição de nome nulo na atualização;
- filtros, paginação e escopo da query;
- leitura por `ADMIN`, `RECEPTIONIST` e `OPHTHALMOLOGIST`;
- restrição de escrita e alteração de status;
- acesso cruzado entre clínicas;
- administrador global sem vínculo;
- `404` para paciente ausente no contexto da clínica;
- corrida de unicidade convertida em conflito;
- endpoints HTTP com guard, pipes, controller e service reais e repositório simulado;
- rejeição de campos protegidos e status em rota incorreta.

## 8. Resultados

| Verificação | Resultado |
| --- | --- |
| Testes temporários | 34 aprovados, 0 falhas |
| Suítes | 2 aprovadas |
| `npm.cmd run build` | Aprovado |
| `npm.cmd run lint` | Aprovado |
| `git diff --check` | Sem erros de whitespace; apenas avisos de conversão LF/CRLF |
| PostgreSQL real | Somente identificação não destrutiva do ambiente |
| Escritas no PostgreSQL | Não executadas |
| Diretório `web` | Não modificado |

## 9. Validação de persistência

**Status: não homologada.**

Não foram executados criação, atualização, paginação, duplicidade ou status contra PostgreSQL real porque o banco configurado não foi comprovado como descartável. Executar esses cenários em `medvita` poderia alterar dados do ambiente do usuário, contrariando o escopo seguro da auditoria.

Para concluir a homologação de persistência, ainda é necessário disponibilizar uma das opções:

- banco PostgreSQL exclusivo de teste, com nome e credenciais separados;
- permissão para criar e remover um banco temporário;
- Docker/Podman ativo para subir um PostgreSQL efêmero;
- pipeline de CI com banco descartável.

Nesse ambiente, deverão ser executadas as migrations e os fluxos reais de criação, atualização, busca, CPF duplicado intra/interclínica e alteração de status, com rollback ou descarte integral ao final.

## 10. Pendências restantes

- homologar migrations e persistência em PostgreSQL descartável;
- transformar os cenários temporários aprovados em suíte permanente;
- adicionar script `test` e execução no CI;
- avaliar índices de busca quando existir volume representativo;
- manter a validação de paciente, profissional e clínica no futuro `AppointmentsModule`;
- implementar auditoria e decisões LGPD antes de produção.

## 11. Conclusão de prontidão

O `PatientsModule` está **aprovado em nível de código, regras de negócio, DTOs, isolamento e autorização**. Nenhuma falha crítica foi encontrada nos cenários executados.

O módulo está pronto para revisão e commit e fornece as validações necessárias para iniciar o desenvolvimento do `AppointmentsModule`.

Entretanto, o módulo **não deve ser chamado de totalmente homologado para produção ou persistência** até que os mesmos fluxos sejam executados em PostgreSQL descartável e exista uma suíte permanente de regressão.
