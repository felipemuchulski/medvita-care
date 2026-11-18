# Correção A05 — Sincronização de permissões, sessão e cache

## Escopo e situação

Implementação local para revisão, em 18/11/2026. Foram alterados apenas o front-end, sua dependência de testes e este relatório. Não houve alteração da API, RBAC, contratos clínicos, entidades, banco, migrations, credenciais ou arquivos `.env`. Nenhum deploy foi realizado. A01, A06, A07, A02 e A04 permanecem preservadas.

## 1. Diagnóstico do cache anterior

As chaves dos módulos combinavam recursos, clínica, filtros e paginação de formas diferentes; nem todas distinguiam identidade e escopo de autorização. Chaves de profissionais incluíam usuário/clínica, mas não a revisão das permissões. As limpezas existentes eram parciais e não cobriam uniformemente módulos administrativos.

Pacientes utilizavam dados anteriores como placeholder. Escritas diretas com `setQueryData` podiam criar entradas sem o novo escopo. Cancelar consultas isoladamente não impedia um resultado atrasado, uma mutação ou seu callback de atualizar o estado após uma mudança de autorização.

`AuthProvider` mantinha tokens em memória e centralizava refresh, mas precisava distinguir operações de sessões sucessivas. `ClinicProvider` comparava diretamente o papel dos vínculos com o retrato da sessão: uma divergência temporária podia remover uma clínica ainda válida. O cliente HTTP precisava impedir a repetição automática de escritas após 401 e tratar 403 sem confundi-lo com logout.

`ProtectedRoute` continua verificando autenticação. As páginas mantêm suas verificações de papéis, e a API continua responsável pela autorização definitiva. Não foi criado um novo conjunto de permissões no React.

## 2. Problemas tratados

- Reutilização de cache entre identidades, clínicas ou revisões de permissão.
- Respostas e callbacks de operações antigas afetando um contexto novo.
- Corridas entre login, refresh e logout; inclusive logout antigo encerrando login novo.
- Divergência temporária entre papéis da sessão e vínculos recém-consultados.
- Perda silenciosa de formulário durante atualização forçada de autorização.
- Reenvio de operações não idempotentes após renovação do token.
- Falta de cobertura de integração dos providers, cliente HTTP e componentes reais.

## 3. Arquivos modificados

Os caminhos a seguir são relativos à raiz do repositório.

| Arquivos | Responsabilidade |
| --- | --- |
| `web/src/lib/authorization-store.ts` (novo) | Identidade, revisão, clínica, bloqueio, avisos e cancelamento de contexto; sem tokens. |
| `web/src/lib/authorized-query.ts` (novo) | Wrappers de consultas/mutações, chaves com escopo e rejeição de callbacks antigos. |
| `web/src/lib/query-client.ts` | Cancelamento e remoção centralizados de cache. |
| `web/src/api/http-client.ts` | Validação de contexto, abort, refresh, 401/403 e controle de reenvio. |
| `web/src/contexts/AuthProvider.tsx` | Ciclo de sessão e proteção contra resultados de sessões anteriores. |
| `web/src/contexts/ClinicProvider.tsx` | Reconciliação de vínculos, sessão e seleção de clínica. |
| `web/src/contexts/AuthorizationBoundary.tsx` (novo), `web/src/main.tsx` | Bloqueio visual e preservação temporária de edição durante mudança forçada. |
| `web/src/features/auth/api/auth-api.ts` | Identificação das operações de sessão e exceção explícita de logout idempotente. |
| `web/src/features/clinics/api/clinics-api.ts`, `web/src/features/clinics/lib/allowed-memberships.ts` | Consulta cancelável dos próprios vínculos e papéis confirmados pela sessão. |
| `web/src/features/patients/hooks/use-patients.ts` | Consultas/mutações com escopo; remoção de placeholder entre contextos e escritas sem escopo. |
| `web/src/features/appointments/hooks/use-appointments.ts`, `web/src/features/appointments/components/Selectors.tsx` | Agendamentos e seleção de pacientes com escopo. |
| `web/src/features/calendar/hooks/use-calendar-appointments.ts` | Consultas do calendário com escopo. |
| `web/src/features/medical-records/hooks/use-encounters.ts`, `web/src/features/exams/hooks/use-exams.ts`, `web/src/features/professionals/hooks/use-professionals.ts` | Prontuários, exames e profissionais com escopo. |
| `web/src/features/clinics/hooks/use-clinics.ts`, `web/src/features/users/hooks/use-users.ts`, `web/src/features/clinic-users/hooks/use-clinic-user-mutations.ts` | Caches administrativos e revalidação após mudanças no próprio acesso. |
| `web/src/features/users/components/UserForm.tsx`, `web/src/features/users/components/UserDetails.tsx` | Validação de contexto nas operações HTTP diretas, antes de resets/navegação. |
| `web/src/features/medical-records/hooks/use-unsaved-clinical-changes.ts` | Coordenação da confirmação de saída, evitando perguntas duplicadas. |
| `web/src/contexts/authorization.integration.test.tsx` (novo) | Testes com providers, componentes, QueryClient e cliente HTTP reais. |
| `web/package.json`, `web/package-lock.json` | `happy-dom` 21.0.4 como dependência de desenvolvimento para DOM nos testes. Nenhuma nova dependência de produção. |
| `docs/correcao-a05.md` | Este relatório. |

## 4. Estratégia de isolamento do cache

As consultas mantêm seus identificadores, filtros e paginação e acrescentam um segmento centralizado:

```ts
[
  ...chaveOriginal,
  { authorization: [userId, activeClinicId, identity, revision] }
]
```

`identity` muda ao iniciar ou encerrar uma sessão, inclusive em um novo login do mesmo usuário. `revision` muda ao alterar identidade, clínica, permissões ou bloqueio. Renovação apenas do token não muda o escopo. Invalidações existentes por prefixo continuam válidas.

A cada revisão são canceladas e removidas as consultas privadas, incluindo módulos administrativos, e limpo o cache de mutações. A exceção é a consulta dos próprios vínculos, identificada por usuário e identidade da sessão: ela precisa sobreviver à troca de clínica para reconciliar a autorização. Também é removida quando a identidade muda.

Os wrappers validam a revisão antes e depois das requisições e antes/depois dos callbacks de sucesso. O cliente HTTP valida o contexto e combina o sinal da requisição com o sinal de cancelamento da autorização. Dessa forma, mesmo um transporte que entregue uma resposta depois do cancelamento não pode repopular o novo contexto. Operações antigas falham com `REQUEST_ABORTED`.

Dados anteriores não são usados como placeholder de uma consulta diferente. Os pontos com `setQueryData` sem escopo foram substituídos por invalidação e nova leitura autorizada.

## 5. Sincronização de sessão e vínculos

| Evento | Comportamento |
| --- | --- |
| Login/restauração | Instala a sessão confirmada, estabelece identidade e carrega vínculos. Resultados de sessão anterior são ignorados. |
| Refresh apenas do token | Atualiza credenciais em memória, preservando cache e clínica válidos. |
| Refresh com papéis diferentes | Avança a revisão, limpa cache e exige reconhecimento da mudança antes de remontar o conteúdo. |
| Troca voluntária de clínica | Confirma descarte quando necessário; cancela/remove o contexto antigo e monta consultas da clínica escolhida. |
| Vínculos diferentes da sessão | Bloqueia conteúdo e revalida sessão antes de aceitar novos papéis. Divergência persistente mantém o bloqueio. |
| Papel alterado, vínculo ou clínica desativados | Usa somente vínculo ativo em clínica ativa e papel confirmado pela sessão; remove dados anteriores e informa a mudança. |
| Logout/troca de usuário | Limpa cache e conteúdo da identidade anterior; resultado tardio de logout não encerra um login novo. |

A verificação dos vínculos ocorre a cada 60 segundos e ao recuperar foco. A diferença de papel, isoladamente, não elimina uma clínica válida: o papel confirmado na sessão é reconciliado com os vínculos sem conceder privilégios a partir de um retrato ainda não confirmado. Uma falha de consulta não apaga automaticamente os últimos vínculos conhecidos; a API permanece responsável por rejeitar acessos revogados.

Durante perda forçada de acesso, `AuthorizationBoundary` oculta e torna inerte a árvore anterior, impede novas operações e foca a mensagem de alteração. O rascunho permanece temporariamente na memória da aba e no DOM oculto/inativo, fora do cache compartilhado e sem ser exibido no novo contexto. A confirmação explícita descarta a edição e remonta a interface. A troca de identidade elimina imediatamente a árvore anterior. Não há persistência de rascunhos ou tokens em armazenamento local.

A interface oferece revalidação e navegação ao início. A mensagem também orienta conferir o resultado de uma gravação em andamento antes de reenviar: cancelar no cliente não desfaz uma escrita que o servidor já confirmou.

## 6. Tratamento de 401 e 403

- **401 em leitura:** refresh compartilhado entre requisições concorrentes e uma única nova tentativa com token atualizado. O contexto é verificado antes da repetição.
- **401 em escrita:** pode renovar a sessão, mas não repete automaticamente a operação não idempotente. Exibe orientação para revisar e tentar novamente. Logout tem exceção explícita por ser idempotente.
- **Falha de refresh no fluxo normal de sessão:** encerra a sessão e remove dados privados, sem loop.
- **403:** bloqueia/oculta o contexto, remove cache e solicita revalidação de permissões; não repete o endpoint negado nem desloga automaticamente.
- **Falha de rede ao revalidar permissões:** mantém autenticação com conteúdo bloqueado e opção de tentar novamente. Um 401 definitivo do refresh ainda encerra a sessão.

As mutações mantêm `retry: false`. Respostas de sessões anteriores não podem expirar uma sessão mais recente.

## 7. Testes executados e resultados

Todos os testes usam dados sintéticos. O transporte HTTP e a persistência da API são simulados; não houve conexão ao PostgreSQL de produção.

| Comando | Resultado |
| --- | --- |
| `npm --prefix web test -- --reporter=dot` | **35 testes aprovados em 4 arquivos**: 18 novos cenários de integração e 17 existentes. |
| `npm --prefix web run build` | TypeScript e build Vite aprovados. |
| `npm --prefix web run lint` | Aprovado. |
| `npm --prefix api run test:professionals` | Build da API e **69 testes aprovados**, cobrindo profissionais globais, permissões globais/locais, guards, políticas de rotas, segurança HTTP e agendamentos. Inclui regressões A01, A06, A07, A02 e A04. |
| `git diff --check` | Aprovado. |
| Comparação dos arquivos da API com `0a1e35d` | Sem alterações versionadas na API. |

Os testes de integração montam React, `AuthProvider`, `ClinicProvider`, `AuthorizationBoundary`, `ProtectedRoute`, QueryClient, hooks e cliente HTTP reais. Apenas as respostas do servidor são simuladas por `fetch`, incluindo respostas pendentes/controladas. A rota direta de criação de paciente usa a página real.

Cobertura adicionada:

1. Restauração em StrictMode sem refresh duplicado; login após falha da restauração e logout com limpeza.
2. Troca de usuário e clínica, incluindo resposta atrasada da identidade anterior.
3. ADMIN → RECEPTIONIST e ADMIN → OPHTHALMOLOGIST, preservando clínica válida, bloqueando gravações e mantendo rascunho oculto até confirmação.
4. Vínculo desativado e clínica desativada.
5. Mudança de papel durante consulta pendente; resposta antiga sem repopular cache.
6. 401 concorrentes com único refresh e novas leituras com bearer atualizado; falha do refresh sem loop.
7. 403 sem logout ou repetição do recurso; falha de rede na revalidação mantém sessão bloqueada e autenticada.
8. 401 em mutação sem reenvio automático após refresh bem-sucedido.
9. URL direta de criação de paciente negada ao oftalmologista, com navegação finita para página permitida.
10. Resposta de mutação antiga sem callback de sucesso/escrita de cache após mudança de permissão.
11. Logout atrasado sem encerrar novo login.
12. Cancelamento voluntário da troca de clínica preservando edição.

As verificações incluem chaves e conteúdo do cache, ausência de dados anteriores na interface visível, chamadas HTTP, identidade/papel, foco do alerta e continuidade do estado do formulário. Não se limitam a funções auxiliares ou ao desaparecimento de botões.

## 8. Possíveis impactos

- A limpeza conservadora gera novas leituras e estados de carregamento após mudanças reais de contexto. A remoção do placeholder de pacientes torna esse carregamento explícito também na paginação.
- Mudanças confirmadas de autorização e respostas 403 interrompem o conteúdo até reconhecimento/revalidação. Não concedem permissões adicionais.
- Após 401 em escrita, o usuário precisa revisar o resultado antes de reenviar; o cliente não consegue desfazer uma gravação já processada no servidor.
- A confirmação genérica de saída é conservadora: um formulário que já foi salvo pode ainda pedir confirmação até a próxima mudança de contexto. Os bloqueios clínicos existentes continuam ativos.
- Rascunhos ocultos permanecem somente na aba atual até descarte explícito. Recarregar, sair pelo link ao início ou encerrar a sessão pode eliminá-los; não existe recuperação persistente.
- Os contratos e as regras de pacientes, agendamentos, atendimentos, exames e profissionais não foram modificados.

## 9. Mobile-first e acessibilidade

O aviso usa largura fluida, espaçamento para telas pequenas, quebra de texto, botões com altura mínima de 44 px e ações em coluna antes do breakpoint `sm`. O conteúdo bloqueado fica `hidden` e `inert`; o aviso tem `role="alert"`, nome acessível e foco programático. Avisos não bloqueantes usam `role="status"`. Não foram alterados os layouts dos módulos.

Os testes DOM verificam foco e bloqueio, mas **não equivalem a E2E em navegador**, medição de layout ou testes com leitor de tela. A validação visual em 320, 360, 390 px e desktop permanece pendente, assim como ausência de overflow, ordem completa de tabulação, zoom e anúncio por leitores de tela em navegadores reais.

## 10. Limitações e pendências para homologação

- Não há canal push de revogação. Alterações externas são detectadas na próxima revalidação, foco, polling ou resposta 401/403. Antes dessa detecção, vale o retrato conhecido no cliente; a API continua impondo autorização a cada chamada.
- AbortController impede consumo tardio no cliente, mas não garante cancelamento de processamento já iniciado na API.
- Validar em navegador real, com contas sintéticas de duas clínicas: login/restauração, calendário, pacientes, prontuários, exames, profissionais e módulos administrativos.
- Alterar papel/vínculo em outra sessão durante consulta e edição; confirmar bloqueio, aviso, descarte explícito e ausência de reaparecimento dos dados ao voltar/avançar no navegador.
- Homologar expiração de token durante leitura e escrita, 403 persistente, perda de rede, logout com requisição pendente e troca rápida de contas/clínicas.
- Validar os tamanhos de tela e tecnologias assistivas indicados acima, incluindo teclado e foco após confirmação do aviso.
- Conferir login, refresh e logout na hospedagem com o proxy e os cookies atuais, sem alterar as políticas A06.

Para publicação futura, usar o processo de revisão e deploy existente, gerando o bundle do front-end a partir da revisão aprovada e mantendo API/contratos atuais. Esta etapa não exige migration nem mudança de ambiente. A publicação deve aguardar revisão e homologação; não foi executada automaticamente.
