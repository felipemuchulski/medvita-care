# Exames oftalmológicos — implementação integrada

Atualização: 08/11/2026. Substitui a tela de indisponibilidade entregue após a auditoria inicial, que não havia encontrado endpoints. Nesta etapa foi autorizado e implementado o ExamsModule no backend.

## Entrega

- `/exames`: listagem real com cards em smartphones/tablets e tabela a partir de xl; busca por paciente/tipo, tipo, status e período de solicitação. Filtros de paciente/atendimento podem vir dos links de Prontuários. Paginação aparece somente quando há mais de uma página.
- `/exames/novo`: paciente pesquisável/paginado, atendimento opcional do mesmo paciente e profissional, tipo do catálogo real, lateralidade OD/OS/AO e observações.
- `/exames/:examId`: identificação, paciente, solicitante, datas, lateralidade, status, vínculo com atendimento, observações e resultado. Edição da solicitação enquanto REQUESTED, resultado em estados abertos, conclusão e cancelamento com confirmação.
- Resultado descritivo com data/horário UTC−03:00 explícitos, seguindo a convenção existente. A interface não interpreta resultados nem gera diagnóstico.
- Histórico do paciente e atendimento têm links para exames filtrados; os detalhes permitem retornar ao histórico/atendimento. O acesso permanece limitado aos exames solicitados pelo usuário.
- Sem upload, laudos estruturados de equipamentos, CRUD de catálogo ou exclusão.

## Contratos e permissões

Os oito endpoints de `/clinics/:clinicId/exams` estão documentados em [`api/docs/EXAMS.md`](../../../../api/docs/EXAMS.md). Somente OPHTHALMOLOGIST com perfil e vínculo ativo pode usar a feature; ADMIN, RECEPTIONIST e System Admin não recebem acesso clínico automático. Menu e página respeitam essa regra; o service faz a autorização definitiva.

Paciente, tipo, atendimento, clínica, solicitante e status são validados no servidor. Tipos vêm de `/types`. Não há enum de catálogo fictício no frontend. O profissional e a data de solicitação são definidos pela API.

## Arquitetura e arquivos

Feature-based: `api/exams-api.ts`, `hooks/use-exams.ts`, `types/exam.ts`, `schemas/exam.ts`, `lib/exam.ts`, `pages/ExamsPage.tsx` e componentes:

- ExamForm, ExamRequestFields, ExamEncounterSelect e ExamField.
- ExamFilters, ExamList e ExamStatusBadge.
- ExamDetails, ExamEditForm e ExamResultForm.
- ExamLeavePrompt.

ExamList concentra apenas a apresentação responsiva cards/tabela; não carrega dados. ExamsPage organiza os estados e as três rotas. Formulários têm responsabilidades separadas. Não foi mantido o antigo componente de indisponibilidade.

Reutilizados: AppLayout, Sidebar, Header, AuthProvider/ClinicProvider, cliente HTTP, QueryClient, PatientSelector, useEncounters, ClinicalDialog, useUnsavedClinicalChanges, estilos compartilhados inputClass/buttonClass, cores, Roboto/Montserrat e gap de 4px entre labels e controles.

Bibliotecas existentes: React, React Router, TanStack Query, React Hook Form, Zod e Tailwind. Nenhuma dependência adicionada, nenhum segundo cliente HTTP ou armazenamento de dados criado.

Alterações fora da feature: rotas em App.tsx, permissão do item de menu, links mínimos nas páginas de Prontuários e props opcionais de acessibilidade/ref no PatientSelector. Na API, as duas ordenações paginadas de Encounters passaram de `encounter.started_at` para a propriedade `encounter.startedAt`, necessária ao TypeORM com joins e ao seletor de atendimento. Não houve refatoração ampla de Prontuários.

## Cache e segurança

- Chaves por clínica, usuário, filtros/página ou ID de exame.
- Clínica e solicitante retornados pela API são conferidos antes de exibir os registros; filtros de paciente/atendimento também são verificados.
- `gcTime:0`, sem persistência de resultados no navegador; mutações invalidam o escopo de exames. O contexto existente limpa queries na troca de clínica e a autenticação limpa o cache no logout.
- Formulários preservam conteúdo em falhas, bloqueiam envios duplicados e não mostram sucesso antes da resposta. Payloads de mutação são resetados ao terminar.
- Alterações não salvas usam os avisos de navegação, reload, troca de clínica e logout existentes. Modais nativos compartilham o comportamento de foco dos Prontuários.
- Resultados são texto React, sem HTML arbitrário, arquivos base64 ou URLs clínicas públicas.

## Validações executadas

- Lint, TypeScript e build das duas aplicações.
- Backend: testes unitários e integração real com autenticação HTTP/PostgreSQL, migrations up/down/up, escopo clínico, estados e auditoria.
- Chromium contra a API real e PostgreSQL temporário, com dados fictícios: login, solicitação com atendimento, edição, resultado, conclusão, reload persistido, histórico, busca/estado vazio, cancelamento, validação, descarte de alterações e troca de clínica.
- Uma falha 503 de salvamento foi simulada no navegador para confirmar preservação do texto e recuperação ao tentar novamente; demais operações desse fluxo utilizaram a API real.
- Listagem, formulário de solicitação, formulário de resultado e modal de conclusão: 320, 375, 390, 768, 1024 e 1440 px, sem overflow horizontal indevido. Cards no mobile, tabela em desktop. Área mínima de toque de 44px nos botões da feature, inclusive seletor reutilizado.
- Tab/Shift+Tab, foco visível, erros associados e aria-invalid do seletor de paciente, confirmação nativa e zoom CSS a 200%. Capturas mobile e desktop revisadas.
- Scripts/capturas de navegador em `/tmp`; sem arquivos de testes unitários no frontend. Os testes backend foram executados e posteriormente removidos a pedido do responsável pelo projeto, junto dos comandos npm correspondentes.

Limitações: zoom nativo/dispositivos físicos e Safari/Firefox não foram homologados. O banco atual e produção não receberam migrations. É necessário aplicar a migration em desenvolvimento e reiniciar a API para disponibilizar a feature no ambiente habitual. A implantação em produção exige autorização própria.

Próximas etapas: anexos privados com regras de acesso/tamanho/retenção, política de compartilhamento entre profissionais se necessária, e administração de catálogo apenas quando houver demanda. Essas operações não são apresentadas como disponíveis no MVP.

