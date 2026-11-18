# UX03 — Dashboard funcional e agendamentos passados pendentes

## 1. Diagnóstico e verificação das correções anteriores

O Dashboard atual tinha atalhos e a mensagem “Agenda ainda não integrada”, sem consultar agendamentos. Não havia classificação visual compartilhada para consultas cujo horário previsto terminou sem início de atendimento.

Foram confirmadas implementações reais no código e no histórico:

- A01: `AppointmentsService.responseQuery` seleciona somente ID/status do atendimento; `toAppointmentResponse` explicita o contrato seguro.
- A06: configuração HTTP com `nosniff`, remoção de `X-Powered-By` e `no-store`.
- A07/A02: política explícita no AuthorizationGuard e separação entre acesso global administrativo e vínculo clínico local.
- A04: alteração do perfil profissional existente exige System Admin no serviço.
- A05: `useAuthorizedQuery`, `useAuthorizedMutation`, revisão de autorização, cancelamento e remoção de cache por contexto.
- Autogestão: decorators e serviço permitem alterações da própria agenda sem ampliar permissões administrativas.
- UX01: commits `f6f6e14` e `cc154a2`, filtros na URL, busca normalizada, carregamento completo do calendário e data lógica preservada.
- UX02: commits `b76f298` e `a9cce17`, validação de pacientes, feedback compartilhado, avisos transitórios, PIO e retorno do reagendamento.

O endpoint existente de agendamentos aceita intervalo, paginação, status, paciente e profissional. Seu serviço aplica o escopo por clínica e, para OPHTHALMOLOGIST, por `professional.user_id = currentUser.sub`. ADMIN/RECEPTIONIST conservam o acesso operacional da clínica. As respostas contêm os metadados necessários para esta etapa.

**Não foi necessário criar endpoint de Dashboard nem modificar a API.** A carga foi limitada a um período explícito e máximo de registros, com leitura completa das páginas e rejeição de resultados parciais. Não houve migration, alteração de entidades, dados reais, permissões, credenciais, `.env`, dependências ou deploy. Por solicitação posterior do usuário, o arquivo novo de testes da UX03 foi removido antes do commit; os testes das correções anteriores foram preservados.

## 2. Funcionalidades implementadas

O Dashboard passa a apresentar dados reais da API, com:

- Indicadores de agendamentos do dia, próximos agendamentos, cancelados do dia e pendências de revisão.
- Para oftalmologistas, indicador e lista de seus atendimentos em andamento no período, inclusive marcados em dias anteriores.
- Listas de agenda do dia, próximos agendamentos, pendências e cancelados, com cinco cartões por página de interface.
- Links para detalhes autorizados dos agendamentos e, quando aplicável, para o próprio atendimento em andamento.
- Atualização manual, automática e pelas invalidações das mutações existentes.
- Estados de carregamento, atualização, vazio, erro, falta de permissão, clínica não selecionada e dados indisponíveis.

Não há números operacionais simulados ou fixos. Constantes de intervalo, limite e tamanho de página delimitam a consulta; os valores dos indicadores são calculados dos dados recebidos.

## 3. Dados e endpoints utilizados

O Dashboard executa somente:

```text
GET /clinics/:clinicId/appointments
  ?from=<início do período em UTC−03:00>
  &to=<fim do período em UTC−03:00>
  &page=<página>
  &limit=100
```

No modo unificado, o prefixo `/api` continua sendo aplicado pelo cliente/configuração existentes. O Dashboard não consulta prontuários, exames, resultados ou endpoints clínicos de leitura. O link de atendimento navega para a tela existente, cujo endpoint clínico continua sujeito à autorização e auditoria próprias.

`loadAppointmentPeriod` foi extraído do carregamento de período do calendário e passou a ser compartilhado. Lê sequencialmente todas as páginas, com AbortSignal, até completar o total informado. Valida página/limite/totalPages, estabilidade do total entre páginas, clínica e IDs duplicados; exige que a quantidade final corresponda ao total. O limite é **100 páginas de 100 registros, no máximo 10.000 registros**. Um período acima desse limite ou inconsistente gera indisponibilidade, sem contagem parcial.

O Dashboard ainda aplica uma projeção explícita: ID/clínica, início/término previsto, status, ID/nome do paciente, usuário/nome do profissional e ID/status do atendimento. Observações, motivo, entidades completas e quaisquer campos clínicos extras não entram no cache específico do Dashboard nem na apresentação. A API A01 continua sendo a proteção definitiva da resposta HTTP.

## 4. Regras por perfil

| Perfil | Dados e ações de navegação |
| --- | --- |
| ADMIN local | Agenda operacional da clínica; indicadores/listas de dia, próximos, cancelados e pendências. Sem dados clínicos completos ou links de atendimento. |
| RECEPTIONIST local | Mesmo escopo operacional já autorizado da clínica, sem acesso adicional a prontuários. |
| OPHTHALMOLOGIST local | Exclusivamente a própria agenda, seus indicadores e seus atendimentos vinculados em andamento. |
| System Admin sem vínculo local autorizado | Estado informativo e atalhos administrativos para Clínicas/Usuários, sem requisição de agendamentos. |
| Sem clínica selecionada | Orientação para selecionar uma clínica, sem consulta de agenda. |
| Papel/contexto sem autorização | Mensagem de acesso indisponível, sem consulta de agenda. |

A tela exige um papel local suportado e consistente com o retrato da sessão. A flag global não substitui esse papel. A consulta de oftalmologista também rejeita uma resposta que inclua outro profissional, em vez de incorporar esses dados aos indicadores. A API continua responsável por impor clínica/autoria a cada chamada.

O Dashboard não cria ações de escrita. Criar, reagendar, cancelar, iniciar e concluir continuam nas telas/serviços existentes, com as regras de status, autoria, vínculo, conflito e auditoria anteriores.

## 5. Cálculo dos indicadores e períodos

O fuso operacional permanece **UTC−03:00**, o mesmo adotado por Agendamentos e Calendário. A API não expõe configuração de fuso por clínica; esta etapa não introduz uma nova política de timezone.

Período consultado: início do dia de **30 dias antes de hoje** até o fim do dia de **7 dias depois de hoje**, incluindo hoje. São até 38 datas de calendário. Os limites são enviados com offset explícito; não dependem do timezone configurado no navegador. O cabeçalho informa as datas concretas.

| Indicador | Significado |
| --- | --- |
| Agendamentos do dia | Todos os registros do conjunto completo cujo **início previsto** pertence à data operacional de hoje, em qualquer status. |
| Próximos agendamentos | SCHEDULED/CONFIRMED, sem atendimento vinculado, início igual/posterior ao instante atual e até o fim do sétimo dia seguinte. |
| Cancelados do dia | Status CANCELLED e início previsto hoje. **Não representa cancelamentos efetuados hoje** nem usa a data do evento de cancelamento. |
| Pendentes de revisão | Agendamentos abertos sem atendimento cujo término previsto passou, dentro do período de 30 dias anteriores e hoje. |
| Atendimentos em andamento | Somente para o oftalmologista: status do agendamento IN_PROGRESS e metadado do atendimento IN_PROGRESS, com início agendado no período consultado. Não se limita a hoje. |

Totais usam o conjunto completo validado, nunca o tamanho da primeira página. A paginação dos cartões ocorre depois disso, sem alterar o total. Agenda/próximos são ordenados por horário; pendências mostram as mais recentes primeiro.

Consultas que cruzam meia-noite são contadas no dia de início previsto. O calendário pode exibi-las também no dia seguinte por sobreposição visual; isso não significa um segundo agendamento nem aumenta o indicador do Dashboard.

## 6. Agendamentos passados: indicação derivada

A função compartilhada `isPastPendingAppointment` retorna verdadeiro somente quando:

1. `endsAt` é válido e menor/igual ao instante atual;
2. status é SCHEDULED ou CONFIRMED;
3. não existe atendimento vinculado, independentemente do status desse atendimento.

O texto é **“Agendamento passado — pendente de revisão”**. A regra usa o término previsto para não classificar como passado um horário que ainda esteja em curso. COMPLETED, CANCELLED, NO_SHOW, IN_PROGRESS e registros com qualquer atendimento vinculado não recebem essa indicação.

Essa é uma classificação de interface: não executa PATCH, não altera o status, não infere falta/comparecimento e não permite concluir atendimento pelo relógio. As ações existentes continuam verificando as mesmas regras no back-end.

A indicação aparece no Dashboard, na lista/detalhe de Agendamentos e nos eventos do Calendário. Há texto visível, além de cor, e nomes acessíveis dos eventos incluem a indicação completa. O relógio da interface é reavaliado a cada minuto e ao recuperar foco. As labels acessíveis de eventos montados também são atualizadas quando os dados/horário mudam.

## 7. Cache, atualizações e consistência

A consulta usa o prefixo existente `['appointments', clinicId]`, acrescentando Dashboard, usuário, papel e período. O wrapper A05 acrescenta identidade, clínica e revisão da autorização. As requisições carregam sinal de cancelamento e não usam placeholder de contexto anterior.

Criação, reagendamento e cancelamento já invalidam esse prefixo. Os hooks de início/salvamento/conclusão/cancelamento de atendimento também o invalidam. Assim, Dashboard, listas e calendário recebem nova leitura autorizada sem manter cópias independentes em estado React. Os cenários novos executados antes da remoção acionaram os hooks reais para comprovar essas invalidações.

A consulta atualiza a cada 60 segundos, ao recuperar foco e por botão. Durante nova leitura, os valores anteriores são identificados como a última consulta confirmada, com horário. Falha de atualização remove os indicadores da apresentação e mostra indisponibilidade; não substitui falha por zero. Mudança de clínica/identidade/papel mantém a limpeza e rejeição de respostas antigas da A05.

## 8. Arquivos modificados

| Arquivo | Alteração |
| --- | --- |
| `web/src/pages/DashboardPage.tsx` | Substitui placeholder por visão operacional real, estados e controle por perfil. |
| `web/src/features/dashboard/lib/dashboard.ts` (novo) | Período, projeção segura, escopo e indicadores. |
| `web/src/features/dashboard/hooks/use-dashboard.ts` (novo) | Consulta autorizada, paginação completa e atualização. |
| `web/src/features/dashboard/components/DashboardAppointmentList.tsx` (novo) | Cartões paginados e links permitidos. |
| `web/src/features/appointments/lib/appointment-period.ts` (novo) | Carregamento completo e limitado de período, compartilhado com calendário. |
| `web/src/features/appointments/lib/pending-appointment.ts` (novo) | Classificação derivada e texto compartilhados. |
| `web/src/hooks/use-operational-clock.ts` (novo) | Reavaliação temporal e ao recuperar foco. |
| `web/src/features/appointments/components/AppointmentStatusBadge.tsx` | Mostra status persistido e indicação adicional, sem confundi-los. |
| `web/src/features/appointments/pages/AppointmentsPage.tsx` | Passa o relógio/dados às indicações na lista e no detalhe. |
| `web/src/features/calendar/hooks/use-calendar-appointments.ts` | Reutiliza o carregamento compartilhado. |
| `web/src/features/calendar/utils/appointmentToEvent.ts` | Metadado derivado de revisão e helper de nome acessível. |
| `web/src/features/calendar/components/CalendarEventContent.tsx` | Texto de pendência nos eventos. |
| `web/src/features/calendar/components/FullCalendarView.tsx` | Reavalia eventos/labels com o relógio, preservando a data lógica UX01 e os controles existentes. |
| Teste novo removido | `web/src/features/dashboard/dashboard.integration.test.tsx` foi executado durante a implementação e removido a pedido. Não faz parte do commit final. |
| `docs/correcao-ux03-dashboard.md` | Este relatório. |

Não há alterações versionadas na API, entidades, banco, ambiente ou dependências.

## 9. Testes e resultados

| Comando/verificação | Resultado |
| --- | --- |
| `npm --prefix web test -- --reporter=dot` | **48 testes existentes aprovados em 5 arquivos**, após remover os novos cenários a pedido. |
| `npm --prefix web run build` | TypeScript e Vite aprovados. |
| `npm --prefix web run lint` | Aprovado. |
| `npm --prefix api run test:professionals` | Build da API e **112 regressões aprovadas**, incluindo autorização, segurança HTTP, A01, A02, A04 e autogestão. |
| `git diff --check` | Aprovado. |
| `git diff --exit-code -- api` | Sem mudanças na API. |

Antes da remoção solicitada, passaram **74 testes React em 6 arquivos**, incluindo os 26 cenários novos descritos abaixo. Esses cenários não estão disponíveis para execução no repositório final; os testes existentes preservados não substituem toda a cobertura específica da UX03.

As integrações novas executadas antes da remoção montavam Dashboard, listas, QueryClient, cliente HTTP e hooks de mutação reais em Happy DOM. O servidor/contextos de sessão são sintéticos; a autorização real da API continua coberta pelas regressões HTTP existentes. Não houve acesso ao PostgreSQL de produção.

Cobertura exercitada antes da remoção dos novos testes:

- ADMIN/RECEPTIONIST com agenda da clínica e sem conteúdo clínico/links de prontuário; extras clínicos inesperados não entram na projeção/cache do Dashboard.
- OPHTHALMOLOGIST com agenda própria, rejeição de resposta de outro profissional e link para próprio atendimento.
- System Admin sem vínculo, clínica não selecionada e carregamento dos vínculos sem chamadas clínicas.
- Agenda vazia com zeros confirmados, carregamento inicial sem zeros, falhas HTTP/rede, falha ao atualizar e nova tentativa.
- **105 registros em duas páginas HTTP**: nenhum indicador antes de concluir a segunda página, total correto e cartões paginados separadamente.
- Rejeição de limite excedido, IDs duplicados, total alterado durante paginação e clínica divergente.
- Próximas consultas e navegação autorizada; criação, reagendamento, cancelamento e início/conclusão pelos hooks reais atualizam os indicadores.
- Mudança de clínica, usuário/papel, sinal abortado e resposta tardia sem repopular dados do contexto anterior; as integrações A05 anteriores também passam.
- Pendência após término, exclusão de concluídos/cancelados/NO_SHOW/em andamento e qualquer atendimento vinculado; relógio não modifica os registros sintéticos.
- Atendimento ainda em andamento de dia anterior incluído, separado da pendência sem atendimento.
- Fuso UTC−03:00 na virada de data, limites do período, metadado do calendário e nome acessível da indicação.
- Cancelamento da paginação antes de iniciar requisições adicionais.

**Não foram executados testes em navegador real.** Happy DOM não comprova layout, comportamento completo do FullCalendar, leitores de tela ou zoom.

## 10. Impactos e limitações

- Os testes específicos da UX03 foram removidos a pedido; sua cobertura futura dependerá de homologação ou autorização para reinclusão.
- O Dashboard pode fazer de 1 a 100 chamadas por leitura completa. Limite e período impedem expansão ilimitada; volumes grandes precisam de medição antes da publicação.
- O calendário reutiliza agora a validação mais rigorosa de paginação. Respostas incompletas/inconsistentes ficam indisponíveis em vez de apresentarem eventos ou totais parciais.
- Não é uma transação/snapshot único do banco entre páginas. Detectam-se variação do total, duplicações e contagem final divergente, mas alterações concorrentes com o mesmo total podem não ser detectáveis. O painel é operacional e eventualmente consistente; a API continua validando cada ação sobre o estado atual.
- Pendências anteriores aos 30 dias e atendimentos agendados fora do período não são contabilizados. O intervalo está explicitado e a navegação aos módulos completos continua disponível.
- O relógio do dispositivo influencia a classificação; deve estar correto. Intervalos em abas de fundo podem ser limitados pelo navegador; foco e nova leitura atualizam a visão.
- O fuso é o operacional já existente, não uma configuração nova por clínica.
- Se o volume real tornar esse carregamento inadequado ou exigir consistência de snapshot, avaliar uma agregação autorizada na API com contrato operacional explícito e os mesmos escopos. Não foi necessário introduzi-la para este MVP delimitado.

## 11. Mobile-first e pendências de homologação

Os componentes usam largura fluida, `min-w-0`, quebra de texto, uma coluna em telas pequenas, grids progressivos e ações com altura mínima de 44 px. As listas têm títulos associados, links com nomes acessíveis, paginação rotulada e mensagens de loading/erro. A indicação de pendência tem texto e não depende somente de cores.

Validar antes de publicar:

1. **320, 360, 390 px, desktop e zoom de 200%**: cartões, nomes longos, botões, paginação e ausência de rolagem horizontal.
2. Teclado/leitor de tela: ordem de foco, links de detalhes, anúncios de loading/erro e indicação de pendência no calendário/lista.
3. Clínica com mais de 100 registros no período: total completo, paginação de cartões, latência e tráfego das atualizações.
4. Duas clínicas e dois oftalmologistas: agenda própria, visão administrativa operacional, troca rápida de conta/clinica/papel e respostas atrasadas.
5. Criar, reagendar, cancelar, iniciar e concluir pelas telas existentes; voltar ao Dashboard e comparar agenda/calendário, respeitando as definições de cada indicador.
6. Virada do dia em UTC−03:00, consulta atravessando meia-noite e término durante a permanência na tela, com relógio correto.
7. Calendário mensal: data selecionada e view preservadas ao sair/voltar, texto visível e atualização do nome acessível de eventos já montados.
8. Rede indisponível, 401/403, perda de vínculo e período excedendo o limite: sem zeros enganadores, dados de contexto anterior ou acesso clínico global.

## 12. Orientações antes do deploy

Revisar a implementação e os resultados, homologar com dados sintéticos em ambiente isolado, medir o custo do período escolhido e executar o processo de build/publicação já adotado. Não há migration ou configuração de ambiente nova. Conferir na hospedagem o contrato A01 e os headers/cache A06 sem ampliar permissões.

Implementação local concluída para revisão. **Sem publicação automática, alterações de dados reais ou transições de status novas.**
