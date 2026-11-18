# UX01 — Buscas, filtros e persistência de navegação

## Escopo

Correção local nos módulos Pacientes, Agendamentos, Prontuários e Exames, além dos filtros/data do Calendário. A01, A06, A07, A02, A04, A05 e a autogestão de agendamentos foram preservadas. Não houve migration, alteração de entidades, acesso a dados reais, mudança de permissões, credenciais, `.env` ou deploy.

Por solicitação posterior do usuário, os **dois arquivos novos de teste desta UX01 foram removidos**, junto com seus ajustes exclusivos no fixture e nos comandos de testes. Os testes das correções anteriores foram preservados. Os commits desta etapa não incluem novos arquivos de teste.

## 1. Problemas encontrados e causas

| Problema anterior | Causa |
| --- | --- |
| Busca de pacientes e dos seletores dependia de Buscar/Enter | Texto digitado e pesquisa aplicada eram estados separados, sem debounce. |
| Apagar o texto não restaurava automaticamente os resultados | A consulta só mudava após envio manual. |
| Nomes com acentos ou palavras intermediárias não eram encontrados | SQL usava ILIKE com a expressão inteira, sem remoção de acentos ou combinação por palavras. |
| CPF e termos especiais tinham comportamento diferente entre módulos | Pacientes e Exames possuíam implementações distintas; Exames não buscava CPF. |
| Filtros/página desapareciam ao navegar ou atualizar | Pacientes, Agendamentos e Prontuários mantinham filtros em estado local; links de retorno descartavam a query string. |
| Exames perdia foco durante atualização dos filtros | O componente tinha `key={params.toString()}` e inputs não controlados, sendo remontado quando a URL mudava. |
| Limpar filtros não limpava a busca interna do seletor | A pesquisa e a página do seletor eram estados próprios, não reinicializados pelo botão externo. |
| Períodos inválidos tinham tratamentos inconsistentes | Agendamentos recusava atualizar o campo; Exames validava apenas ao enviar; URLs inválidas podiam gerar chamadas 400. |
| Calendário mensal podia substituir a data por um dia do mês anterior | Na ausência da referência inicial ao FullCalendar, `datesSet` usava o primeiro dia visível da grade como data selecionada. |

## 2. Solução e componentes compartilhados

- **`useUrlFilters` / `sanitizeFilters`:** URL como fonte dos filtros aplicados; validação de UUID v4, enum, data real, texto de até 150 caracteres e página entre 1 e 1.000.000. Parâmetros desconhecidos/inválidos são removidos com replace, sem envio à API.
- **`useDebouncedSearch` / `SearchField`:** campo controlado e rotulado, atualização automática após aproximadamente 300 ms e limpeza imediata. Enter pode antecipar a pesquisa. Mudanças da URL atualizam o texto; a busca não remonta o input.
- **`PeriodFields` / `periodQuery`:** datas preservadas para correção, erro associado aos campos com `aria-invalid`/`aria-describedby` e limites inclusivos do dia em UTC−03:00. Consultas de listagem ficam desabilitadas enquanto o período estiver invertido.
- **`FilterLink`:** conserva a query string em links do mesmo módulo, incluindo detalhes e retorno à listagem. Não transporta payload clínico nem transfere automaticamente filtros para outro módulo.
- **`applyTextSearch`:** normalização SQL compartilhada para Pacientes e Exames, antes da ordenação/paginação.

Alterar um filtro reinicia a página; mudar apenas a página conserva os filtros. Debounce usa replace para evitar uma entrada de histórico por termo digitado; mudanças explícitas de filtros/página mantêm navegação normal. Limpar filtros restaura os padrões e reinicializa os seletores, incluindo pesquisa e página internas. Em Pacientes, o padrão permanece **Ativos**, página 1.

## 3. Busca no servidor e impactos no PostgreSQL

Pacientes pesquisa nome e CPF. Exames pesquisa nome do paciente, nome do tipo de exame e CPF, mantendo o escopo clínico e de autoria existente.

A expressão SQL usa `translate`, `lower`, `coalesce` e `regexp_replace` para normalizar os acentos latinos usados em português, inclusive marcas combinantes. Não depende da extensão `unaccent`. Os termos recebidos são normalizados e separados por espaços: todas as palavras devem corresponder, em qualquer posição, sem exigir que sejam consecutivas. Em Exames, palavras podem corresponder ao nome do paciente e ao tipo de exame.

Exemplos: `tamara` encontra `Tâmara`; `lucas cardoso` encontra `Lucas Pinguela Cardoso`; `optica` encontra `Óptica`. Uma expressão numérica/CPF também pesquisa os dígitos sem máscara. `%`, `_` e barra invertida são tratados literalmente, não como curingas fornecidos pelo usuário.

Os valores são parâmetros do QueryBuilder, e os nomes de colunas são constantes do código. Os grupos de busca ficam subordinados ao escopo de clínica/autor e aos demais filtros. A busca abrange os registros autorizados no servidor antes de `skip`/`take`, sem filtrar somente a página recebida no React. Contratos de resposta e auditoria de leituras continuam iguais.

**Nenhuma mudança estrutural no PostgreSQL é necessária.** A normalização por expressão pode aumentar o custo das pesquisas em bases maiores e não cria índices funcionais nesta etapa. Medir desempenho com volume representativo em homologação; índices ou outra estratégia devem ser avaliados separadamente se houver evidência de necessidade. A expressão não promete equivalências linguísticas arbitrárias fora da normalização implementada.

## 4. Navegação e calendário

Os módulos preservam filtros válidos ao atualizar a página, abrir detalhes e retornar. Em Pacientes, a edição também conserva os parâmetros de retorno. Em Agendamentos, o retorno após criação/reagendamento conserva a query string, sem mudar payloads, permissões ou regras dessas operações.

O calendário distingue **intervalo visível** de **data lógica selecionada**. O intervalo continua sendo usado para carregar todos os eventos do período; a URL usa a data do calendário ou, enquanto a referência não estiver disponível, a data lógica já conhecida. O início da grade mensal deixa de ser o fallback da seleção.

`date` e `view` são mantidos na URL. Mudanças desses parâmetros também sincronizam a instância existente ao navegar no histórico. Limpar filtros do calendário remove profissional/status e conserva data/visualização. Ao abrir um evento, há caminho de retorno ao calendário com seus parâmetros; esse retorno também é preservado no reagendamento.

FullCalendar continua sem arrastar/redimensionar eventos. Formulários e operações de criação, reagendamento, cancelamento e atendimento mantêm seus fluxos e validações.

## 5. Arquivos modificados

| Arquivos | Responsabilidade |
| --- | --- |
| `api/src/common/utils/text-search.util.ts` (novo) | Normalização e grupos parametrizados de busca. |
| `api/src/patients/patients.service.ts` | Busca de nome/CPF com a função compartilhada. |
| `api/src/exams/exams.service.ts` | Busca de paciente/tipo/CPF com a função compartilhada. |
| `web/src/lib/list-filters.ts` (novo) | URL, validação, debounce, reset e períodos. |
| `web/src/components/filters/SearchField.tsx`, `PeriodFields.tsx`, `FilterLink.tsx` (novos) | Campos e links compartilhados. |
| `web/src/features/patients/pages/PatientsPage.tsx` | Busca automática e filtros/página persistentes. |
| `web/src/features/patients/pages/PatientDetailsPage.tsx`, `EditPatientPage.tsx` | Preservação de parâmetros na navegação. |
| `web/src/features/patients/api/patients-api.ts`, `hooks/use-patients.ts` | Propagação do AbortSignal da listagem. |
| `web/src/features/appointments/components/Selectors.tsx` | Busca automática, cancelável e opcionalmente controlada pelo filtro da página. |
| `web/src/features/appointments/hooks/use-appointments.ts` | Permite desabilitar a listagem para período inválido. |
| `web/src/features/appointments/pages/AppointmentsPage.tsx` | Filtros na URL, período, reset do seletor e retorno de navegação. |
| `web/src/features/medical-records/pages/MedicalRecordsPage.tsx` | Filtros/página na URL, período e reset do seletor. |
| `web/src/features/medical-records/pages/EncounterPage.tsx`, `components/EncounterList.tsx` | Links preservam parâmetros dentro do módulo. |
| `web/src/features/exams/pages/ExamsPage.tsx`, `components/ExamFilters.tsx` | Filtros automáticos/controlados, parâmetros válidos e foco estável. |
| `web/src/features/exams/components/ExamList.tsx`, `ExamDetails.tsx` | Links preservam filtros da listagem. |
| `web/src/features/exams/components/ExamDesignPreview.tsx` | Adapta a prévia de desenvolvimento à interface do componente compartilhado, sem requisições reais. |
| `web/src/features/calendar/pages/CalendarPage.tsx`, `components/FullCalendarView.tsx` | Validação de filtros, persistência de data/view e retorno do detalhe. |
| `docs/correcao-ux01-buscas-filtros.md` | Este relatório. |

## 6. Comportamento antes/depois

| Ação | Depois |
| --- | --- |
| Digitar pesquisa | Consulta após 300 ms; Enter opcional. |
| Apagar pesquisa | Restaura resultados automaticamente, sem Enter. |
| Alterar status, paciente, profissional, tipo ou data | Atualiza URL/consulta e reinicia paginação. |
| Limpar filtros | Volta aos padrões; limpa busca/seleção/página do seletor. |
| Informar período invertido | Conserva os valores, informa o erro e suspende a consulta. |
| Abrir detalhe e retornar | Mantém parâmetros do módulo. |
| Recarregar com URL válida | Reconstitui os filtros e a página. |
| URL inválida | Usa padrões/remove parâmetros inválidos sem quebrar a página. |
| Buscar em Exames | Mantém o mesmo input e foco durante a atualização. |
| Retornar ao calendário mensal | Usa a data lógica, separada do início visível da grade. |

## 7. Cache, segurança e cancelamento

Permanecem os wrappers e as chaves da A05: identidade, clínica e revisão da autorização continuam compondo o escopo, além de filtros, IDs e página. Não houve introdução de cache global sem contexto, armazenamento de tokens ou persistência de dados clínicos em storage.

A listagem de pacientes e os seletores agora consomem o AbortSignal do TanStack Query. Os demais hooks mantêm os sinais existentes. Consultas obsoletas não substituem o resultado observado para o novo filtro; as proteções A05 continuam impedindo consumo de resultados de uma autorização anterior. A URL não concede acesso: clínica, autoria e RBAC continuam sendo impostos pela API.

## 8. Validação e resultados

Validação final **após remover os testes novos**, usando somente as suítes existentes e dados sintéticos:

| Comando | Resultado |
| --- | --- |
| `npm --prefix api run test:professionals` | Build da API e **112 testes aprovados**, incluindo as correções anteriores e autogestão. |
| `npm --prefix api run lint` | Aprovado. |
| `npm --prefix web test -- --reporter=dot` | **48 testes aprovados em 5 arquivos**, incluindo as integrações A05 e autogestão. |
| `npm --prefix web run build` | TypeScript e Vite aprovados. |
| `npm --prefix web run lint` | Aprovado. |
| `git diff --check` | Aprovado. |

Antes da remoção solicitada, também passaram 12 cenários DOM novos e 4 cenários da API, totalizando naquela execução 60 testes React e 116 da API. Eles exercitaram debounce, limpeza, URL, navegação, paginação, datas invertidas, foco, resposta atrasada, troca de contexto e busca parametrizada antes da paginação. **Esses casos não estão mais disponíveis para execução no repositório final**, e os testes existentes não substituem toda essa cobertura específica.

Os testes HTTP usaram Nest/JWT/validações e serviços reais, com repositórios e interpretação de filtros em memória. A geração SQL foi verificada a partir de metadados TypeORM sem inicializar DataSource. Isso não equivale à execução da expressão em PostgreSQL real. Não foi acessado banco de produção.

## 9. Pendências de homologação e riscos de regressão

- Verificar buscas e desempenho em PostgreSQL isolado: acentos compostos/decompostos, caixa, nomes compostos, CPF mascarado, termos literais e paginação de toda a clínica.
- Validar calendário real: mês cuja grade inicia no mês anterior, seleção de data, mudança de visualização, abertura de evento, retorno e voltar/avançar do navegador, em desktop e celular.
- Validar **320, 360 e 390 px e desktop**, sem overflow; os campos usam largura fluida/min-width zero, botões com área mínima de 44 px e grids adaptativos.
- Validar teclado, foco e leitor de tela. Inputs possuem labels, erros de período são associados aos campos e mantêm mensagens acessíveis. Não foram executados E2E de navegador nem medições reais de layout.
- Conferir todos os filtros em conjunto, limpeza após digitação ainda dentro do debounce, paginação, reload e ida/volta dos detalhes.
- Conferir troca de identidade/clínica e perda de permissão com consultas pendentes. Os filtros são parâmetros de consulta e não substituem o isolamento A05 ou a autorização da API.
- A busca automática pode aumentar chamadas e eventos de auditoria; debounce e cancelamento reduzem esse efeito. A ausência de índices de normalização pode afetar grandes volumes.
- A validação de URL descarta parâmetros desconhecidos; novos filtros futuros devem ser incluídos explicitamente nas regras do módulo.
- Como os novos arquivos de teste foram removidos a pedido, a cobertura específica da UX01 dependerá de homologação e de eventual autorização futura para reincluir testes.

Nenhuma publicação automática foi realizada. A alteração está preparada para revisão e commits locais, sem push ou deploy.
