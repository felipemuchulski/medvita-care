# UX02 — Validações e experiência dos formulários

## Escopo e verificação da UX01

A UX01 foi confirmada no repositório antes desta implementação, pelos commits `f6f6e14` e `cc154a2` e pela leitura dos arquivos efetivamente existentes: `web/src/lib/list-filters.ts`, componentes de filtros, páginas, FullCalendar e `api/src/common/utils/text-search.util.ts`. Há debounce, filtros/validação na URL, busca normalizada antes da paginação e distinção entre a data lógica e o intervalo visível do calendário. Esta etapa preserva esses mecanismos.

Implementação local para revisão. A01, A06, A07, A02, A04, A05 e autogestão foram preservadas. Não houve migration, mudança de entidade, precisão numérica, RBAC, compartilhamento clínico, credenciais, `.env`, dados reais ou deploy. Nenhuma dependência foi adicionada. Por solicitação posterior do usuário, os dois arquivos novos de teste da UX02 e a inclusão da nova suíte no comando da API foram removidos antes dos commits finais. Os testes das correções anteriores foram preservados.

## 1. Auditoria inicial

React Hook Form, Zod e `@hookform/resolvers` já estavam instalados e são utilizados por Pacientes, Prontuários, Exames, Profissionais, Clínicas e Usuários. Agendamentos utilizava estado React e FormData, mantidos nesta correção. A API usa class-validator/class-transformer, ValidationPipe e validações adicionais dos serviços.

| Módulo | Obrigatórios e opcionais existentes | Validação/experiência observada |
| --- | --- | --- |
| Pacientes | Nome/nascimento obrigatórios; CPF, telefone, sexo, contato/endereço opcionais | Schema Zod e DTO/serviço. Nome aceitava 1 caractere; telefone apenas texto até 20. CPF possui máscara/checksum e unicidade por clínica. Erro de servidor era associado ao CPF sem foco/rolagem e sem resumo. |
| Agendamentos | Paciente/profissional na criação, data/hora e duração; motivo/observações opcionais | FormData, validação manual e DTO/serviço. Reagendamento não oferecia retorno próprio com aviso de descarte. Estados, conflito e autoria já protegidos no serviço. |
| Prontuários | Rascunho aceita campos opcionais; conclusão exige queixa, avaliação e plano | RHF/Zod, seções/erros e diálogos existentes. PIO de 0 a 100, até 2 casas, aceita ponto/vírgula; leitura/input não apresentavam uniformemente o padrão brasileiro. Histórico repetia link para a própria página. |
| Exames | Paciente, tipo e lateralidade; atendimento/observações opcionais; resultado exige texto/data | RHF/Zod e DTOs/serviço. Há diálogos, bloqueios e loading. Erros gerais ficavam no rodapé, e helpers podiam exibir texto técnico de validação. |
| Profissionais | Usuário elegível na criação e CRM/UF; RQE opcional; especialidade conforme contrato existente | RHF/Zod, DTOs e validações CRM/UF/RQE. Permissões A04 preservadas. Erros locais sem resumo/rolagem padronizados. |
| Clínicas | Nome/documento na criação; demais campos opcionais | RHF/Zod, DTOs e campos de edição restritos. Avisos de descarte e confirmação existentes. Erros e foco pouco uniformes. |
| Usuários | Nome/e-mail e senha de 8–255 caracteres na criação | RHF/Zod e DTOs. Confirmação de alterações de acesso já existente. Credenciais continuam fora do cache de mutações. |

Foram revistos máscaras, labels, `aria-invalid`/`aria-describedby`, estados desabilitados e de carregamento, mensagens, erros do cliente HTTP, helpers e confirmações existentes. Não se aplicou a regra de telefone de pacientes aos cadastros administrativos, cujos contratos permanecem iguais.

## 2. Problemas e causas

| Problema | Causa |
| --- | --- |
| Nome de paciente com um caractere | Mínimo 1 no Zod; DTO/serviço validavam apenas presença. |
| Telefone inválido aceito | Limite de texto, sem conferir dígitos nacionais. |
| CPF duplicado fora da área visível | `setError` do servidor sem foco/scroll e apenas mensagem junto ao campo. |
| Erros anunciados várias vezes | Múltiplos campos com `role="alert"`, além de mensagens gerais. |
| Sucesso reaparecendo após reload | Flags/textos permaneciam no `location.state`; o histórico do navegador pode conservá-los ao recarregar. |
| “Prefere não informar” exibido como ausência | Mapeamento de `NOT_INFORMED` para “Não informado” na ficha. |
| PIO com ponto e sem unidade | Uso direto do número/string da API na leitura e nos valores iniciais. |
| Retorno do reagendamento sem controle próprio | Formulário sem botão e bloqueio específico de edição não salva. |
| Link de histórico redundante | Cartão renderizava o link independentemente de já estar no histórico. |

## 3. Correções implementadas

### Pacientes: nome, telefone e sexo

Nome passa a remover espaços nas extremidades e reduzir sequências de espaços a um, exigindo **3 a 150 caracteres**. Não exige duas palavras, não remove acentos nem modifica caixa. A regra está no Zod, DTO de criação/atualização herdado via PartialType e serviço. Nomes como `Ísis` são aceitos.

Telefone continua opcional. Vazio/null são aceitos; quando informado, exige **10 ou 11 dígitos**, com pontuação nacional comum, conservando o limite de 20 caracteres. Exemplos aceitos: `1133334444`, `11999998888`, `(11) 99999-8888`. Não foi adicionada máscara de telefone. A persistência continua como texto aparado, inclusive com pontuação quando fornecida; não há conversão em massa para somente dígitos. Prefixo internacional `+55` não foi introduzido nesta regra nacional.

Cadastros antigos não são reescritos. Na API, atualizações que omitem nome/telefone deixam os valores anteriores intactos. No formulário completo, um dado antigo que não atenda à regra deve ser corrigido antes do envio, pois os campos fazem parte do payload.

O campo sexo fica explicitamente controlado pelo RHF, conservando a seleção. A ficha passa a mostrar `NOT_INFORMED` como **“Prefere não informar”**; `null` continua como **“Não informado”**. O modelo já distingue esses estados; nenhum valor persistido foi alterado.

### Erros, foco e acessibilidade

Foram criados componentes/helper pequenos:

- `FieldError`: texto associado ao campo, sem uma região assertiva por erro.
- `FormErrorSummary`: resumo único anunciado, com mensagens legíveis e foco programático para erros sem campo identificável.
- `useFormErrorFocus` / `focusFormError`: após renderizar os erros, foca o primeiro input/select/textarea inválido na ordem visual e rola até ele; se não houver campo, foca o resumo. Não move foco para formulário desmontado, oculto ou inerte.
- `formApiError`: mensagens de erro por situação, sem detalhes técnicos do servidor, com orientação para preservar/revisar os dados.

Pacientes mapeia somente erros com identificação conhecida de campo. CPF duplicado produz mensagem junto ao CPF e no resumo, sem dados do paciente existente. Nome, telefone e identificadores conhecidos de validação também podem receber erro de campo; mensagens desconhecidas usam o resumo genérico, sem inferir associação insegura. Nenhum erro de envio executa reset dos valores.

Exames e formulários administrativos passam a usar resumo, foco/rolagem e erro geral padronizados. Textos locais continuam associados por `aria-describedby`; não possuem `role="alert"` adicional quando o resumo já anuncia os erros. Prontuários conserva seu resumo clínico por seções e ganha o mesmo foco/scroll ao validar ou falhar no salvamento. O indicador clínico de estado deixa de anunciar um segundo sucesso/erro junto da mensagem principal.

### Mensagens de sucesso

`useNavigationNotice` lê uma vez a mensagem/flag de operação e remove **somente essa chave** do histórico usando replace. A mensagem fica em memória na tela atual, mas não é restaurada em F5 ou reutilizada em outro recurso. Não usa localStorage/sessionStorage. Query string, filtros UX01 e metadados como `calendarReturn` são preservados.

O mecanismo cobre pacientes, agendamentos, profissionais, usuários, clínicas e criação de exames. Mensagens de operações locais — salvar rascunho, cancelar, editar resultado etc. — continuam em estado local do componente, desaparecendo ao remontar/recarregar a tela. Não foi adicionado um segundo sistema de notificações.

A05 continua validando revisões de autorização antes/depois de mutações e callbacks. Resultados antigos não podem chamar o sucesso/reset do novo contexto; o helper de foco também respeita o bloqueio da árvore anterior.

### Reagendamento

O formulário agora tem **Voltar aos detalhes**, conserva os parâmetros de navegação e não envia alterações ao voltar. Se houve edição, utiliza o diálogo existente para confirmar descarte; durante salvamento, a navegação é bloqueada. A navegação após sucesso só é liberada após a resposta autorizada da mutação. O hook de mudanças não salvas recebeu um bypass restrito a essa conclusão confirmada, sem mudar os chamadores clínicos/administrativos existentes.

A validação manual existente passa a apontar campos inválidos e resumo, com foco/rolagem e associação acessível. Permanecem duração 5–480, data futura, conflito, status, vínculo clínico e autoria. Reagendamento continua sem editar paciente/profissional. Os testes anteriores de autogestão permanecem aprovados.

### PIO e histórico

Foram separados representação de entrada (`pressureInput`), formatação de leitura (`formatPressure`) e payload (`toClinicalPayload`). O input continua aceitando ponto ou vírgula; após blur válido e ao carregar o registro, apresenta padrão brasileiro. Na leitura, `15.50`/`15.5` aparece como **15,5 mmHg**, e zero como **0 mmHg**; vazio permanece sem informação. Na edição, o blur somente formata entradas que já passam na validação; entradas inválidas permanecem disponíveis para correção.

O payload continua numérico, OD/OS e acuidade permanecem separados, e o intervalo 0–100/com até duas casas e a precisão do banco não foram alterados. Queixa, anamnese, avaliação, conduta, rascunho, conclusão e bloqueio de finalizados foram preservados.

O cartão não mostra “Histórico do paciente” quando já está nessa página. “Abrir atendimento” permanece para autoria permitida, assim como os controles de leitura compartilhada existentes.

## 4. Arquivos modificados

| Área | Arquivos |
| --- | --- |
| Validação da API | `api/src/patients/dto/create-patient.dto.ts`, `patients.service.ts`, `utils/patient-input.util.ts` (novo). O UpdatePatientDto herda as validações sem alteração de arquivo. |
| Componentes/helpers compartilhados | `web/src/components/forms/FormFeedback.tsx`, `web/src/lib/form-feedback.ts`, `web/src/hooks/use-navigation-notice.ts` (novos). |
| Pacientes | `components/PatientForm.tsx`, `lib/patient-schema.ts`, `pages/PatientsPage.tsx`, `pages/PatientDetailsPage.tsx`. |
| Agendamentos | `components/AppointmentForm.tsx`, `components/Selectors.tsx`, `pages/AppointmentsPage.tsx`. |
| Prontuários | `lib/encounter.ts`, `hooks/use-unsaved-clinical-changes.ts`, `components/EncounterForm.tsx`, `ClinicalReadOnly.tsx`, `ClinicalTextFields.tsx`, `OcularMeasurements.tsx`, `EncounterList.tsx`. |
| Exames | `pages/ExamsPage.tsx`, `lib/exam.ts`, `components/ExamForm.tsx`, `ExamEditForm.tsx`, `ExamResultForm.tsx`, `ExamField.tsx`, `ExamDetails.tsx`. |
| Profissionais | `components/ProfessionalForm.tsx`, `lib/professional.ts`, `pages/ProfessionalsPage.tsx`. |
| Clínicas | `components/ClinicForm.tsx`, `ClinicFormFields.tsx`, `lib/clinic.ts`, `pages/ClinicsPage.tsx`. |
| Usuários | `components/UserForm.tsx`, `lib/user.ts`, `pages/UsersPage.tsx`. |
| Testes novos removidos | `api/test/patient-form-validation-http.test.cjs` e `web/src/features/patients/components/ux02-forms.integration.test.tsx` foram removidos a pedido; `api/package.json` foi restaurado. Não fazem parte dos commits finais. |
| Relatório | `docs/correcao-ux02-formularios.md`. |

Os caminhos de cada módulo React na tabela partem de `web/src/features/<módulo>/`.

## 5. Antes/depois

| Situação | Depois |
| --- | --- |
| Nome `A` | Negado no React e na API; nome acentuado de uma palavra com 3+ caracteres permitido. |
| Telefone `123` | Negado; vazio permitido, número nacional de 10/11 dígitos validado. |
| CPF duplicado | Erro seguro no CPF e resumo; foco/rolagem e valores preservados. |
| Erro técnico da API | Mensagem compreensível, sem detalhes internos. |
| Sucesso seguido de F5 | Flag já consumida; aviso antigo não reaparece. |
| `NOT_INFORMED` na ficha | “Prefere não informar”, distinto de `null`. |
| Voltar do reagendamento | Retorno sem PATCH; edição não salva exige confirmação. |
| PIO `15.50` | Input brasileiro e leitura `15,5 mmHg`; payload continua numérico. |
| Histórico clínico | Sem link redundante para a própria página. |

## 6. Testes e resultados

Todos os testes usam dados sintéticos. Não houve conexão com PostgreSQL real. Os testes HTTP passam por Nest/Express, JWT, autorização, DTOs, transformação e serviços reais com repositórios em memória. Os testes React usam Happy DOM, componentes, RHF/Zod, roteador, cliente HTTP e QueryClient reais, com servidor/contextos sintéticos.

| Comando | Resultado |
| --- | --- |
| `npm --prefix api run test:professionals` | Build da API e **112 testes existentes aprovados**, após remover a nova suíte. |
| `npm --prefix api run lint` | Aprovado. |
| `npm --prefix web test -- --reporter=dot` | **48 testes existentes aprovados em 5 arquivos**, após remover os novos cenários. |
| `npm --prefix web run build` | TypeScript e Vite aprovados. |
| `npm --prefix web run lint` | Aprovado. |
| `git diff --check` | Aprovado. |

Antes da remoção solicitada, também foram aprovados **114 testes da API e 74 do React**, incluindo 2 novos grupos HTTP e 26 novos cenários DOM. Os casos específicos descritos abaixo foram executados nessa fase, mas **não estão disponíveis para execução no repositório final**. As suítes existentes preservadas não substituem toda a cobertura específica da UX02.

Cobertura exercitada antes da remoção:

1. Nome de um/dois caracteres rejeitado; nome válido acentuado e normalização de espaços.
2. Telefone inválido rejeitado, opcional vazio aceito e máscara preservada.
3. CPF duplicado, mensagem segura, resumo único, foco, scroll e dados preservados.
4. Mapeamento seguro de erro de API para telefone e ocultação de detalhe técnico em Exames.
5. Sexo explícito versus ausente na ficha.
6. Sucesso de criação no componente de pacientes real; consumo das demais flags; reload simulado sem aviso e troca de recurso sem reutilização.
7. Voltar do reagendamento sem escrita e confirmação de descarte; duração/data inválidas com foco, descrição e sem PATCH.
8. PIO numérica/string decimal em pt-BR, zero/null, blur e preservação de OD/OS/acuidade/payload; limite clínico original mantido.
9. Histórico sem link redundante e com acesso ao próprio atendimento.
10. Erro de exame preserva texto, foca resumo e não expõe detalhes internos; validação administrativa foca o primeiro campo.
11. Resposta atrasada após mudança de autorização não executa sucesso/reset. As integrações A05 e os cenários de autogestão anteriores também passam.
12. API cria/edita com validações equivalentes, rejeita chamadas diretas inválidas, mantém CPF único e conserva dados legados quando omitidos do PATCH.

As regressões incluem A01, A06, A07, A02, A04, A05 e autogestão. A UX01 foi verificada no código; sua cobertura específica previamente removida a pedido não foi recriada nesta etapa.

## 7. Mobile-first, riscos e homologação

Os componentes mantêm layouts fluidos com `min-w-0`, quebra de texto, grids responsivos e ações em coluna nas telas menores. Os controles de ação usam área mínima de toque existente de 44 px. Não foram adicionados calendários, campos clínicos ou dependências.

**Não foram executados testes E2E em navegador real**, leitor de tela ou medições de layout/zoom. Foco e rolagem foram verificados em DOM simulado; o teste de F5 remonta a tela com o estado de histórico já consumido, sem afirmar execução de um reload real de navegador.

Pendências antes de publicar:

- Validar **320, 360, 390 px, desktop e zoom 200%**: ausência de overflow, teclado virtual, foco, scroll e campos longos.
- Validar tabulação, Escape, foco inicial/retorno dos diálogos e anúncios com leitores de tela; confirmar ausência de anúncios redundantes.
- Testar F5 real, voltar/avançar, múltiplas operações sucessivas e preservação de filtros UX01/retorno ao calendário.
- Testar salvar/cancelar/concluir nas telas reais de cada papel, inclusive falha de rede, 401/403 e perda de vínculo durante edição, com dados sintéticos.
- Homologar nome/telefone novos em base isolada; cadastros legados curtos ou com telefone fora do padrão podem exigir correção ao salvar o formulário completo. Não há atualização automática desses dados.
- Conferir PIO OD/OS ao abrir, editar, salvar rascunho e concluir, inclusive valores zero, inteiros e duas casas. A nova formatação não modifica regra/precisão clínica.
- Mapeamento de campo por mensagem usa padrões conhecidos e é conservador: mensagens novas/desconhecidas aparecem no resumo genérico até que haja identificação segura.
- Os testes novos da UX02 foram removidos a pedido; sua cobertura específica dependerá de homologação manual ou de autorização futura para reinclusão.
- O aviso transitório é consumido do histórico ao montar a tela; ele não é persistido para recuperação após fechamento/reload. Não foi adicionado armazenamento de dados sensíveis.

Alterações prontas para revisão local. **Sem deploy, migrations ou alterações em dados reais.**
