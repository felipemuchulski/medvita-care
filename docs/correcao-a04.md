# Correção A04 — edição do perfil profissional global

Data: 18/11/2026. Escopo exclusivo A04, preservando A01, A06, A07 e A02. Implementação local para revisão; sem migrations, acesso/alterações ao PostgreSQL, mudanças de entidades, credenciais, `.env` ou deploy.

## 1. Diagnóstico e causa

`ProfessionalProfile` é um registro global: `userId` é único e CRM/UF tem índice único. O perfil não tem `clinicId`. Seu uso em uma clínica depende do ClinicUser ativo de OPHTHALMOLOGIST, do User ativo e da clínica ativa; um User pode ter vínculos em várias clínicas sem duplicar o perfil.

Os campos **CRM, UF do CRM, RQE e especialidade** pertencem ao perfil global. `id` e `userId` representam sua identidade e associação ao User; não são campos editáveis no DTO de atualização. Papel e atividade do vínculo pertencem a ClinicUser, não ao perfil.

Após A02, `ProfessionalsController.update` permitia global ou ADMIN local explicitamente e `ProfessionalsService.update` usava `assertCanManage`, também aceitando ADMIN local. Assim, ADMIN da clínica A podia alterar um perfil que a clínica B utilizava. A checagem por clínica restringia quem era encontrado, mas a gravação atingia um registro compartilhado.

O React usava a mesma capacidade `canManageProfessionals` para cadastrar e editar. Isso oferecia edição a ADMIN local nas listas móvel/desktop, no detalhe e na rota direta de edição.

### Relações e impactos observados antes da restrição

- Agendamentos e atendimentos referenciam `professionalId`; exames referenciam `requestedByProfessionalId`. As leituras unem o perfil atual, não uma cópia dos dados profissionais na data do atendimento.
- Agenda/calendário e prontuários usam identificador/nome do profissional; detalhes de agenda/exame também apresentam CRM/UF. Alterar o perfil global pode mudar a identificação profissional exibida em registros antigos sem mudar seus IDs ou dados clínicos.
- A criação exige User e clínica ativos, vínculo médico elegível, CRM e UF válidos; RQE é opcional e a especialidade assume “Oftalmologia” quando omitida no fluxo atual. Não existe obrigação de criar um perfil com CRM fictício para completar depois.
- Um perfil já criado, mesmo com RQE ainda não informado ou com cadastro incorreto, deve passar por System Admin para complementação/correção após esta mudança. Não foi criada exceção temporária para o autor do cadastro ou administrador da clínica.

## 2. Política aplicada e matriz antes/depois

| Operação | Antes | Depois |
| --- | --- | --- |
| Criar perfil elegível, ainda inexistente | System Admin ou ADMIN local | Igual; validações e unicidade preservadas |
| Consultar perfis autorizados da clínica | System Admin; ADMIN/RECEPTIONIST locais; médico com escopo próprio | Igual |
| Atualizar CRM/UF/RQE/especialidade existentes | System Admin ou ADMIN local | **Somente System Admin** |
| ADMIN A/B editar o perfil compartilhado | Permitido quando encontrava o perfil elegível na sua clínica | 403 no Guard e também no serviço; sem gravação |
| Médico/recepção/usuário sem vínculo editar | Negado | Continua negado |
| System Admin sem vínculo local editar | Permitido para perfil elegível na clínica ativa da URL | Igual; não recebe acesso a perfis fora desse escopo nem privilégios clínicos |
| Editar por clínica inativa | Negado conforme regra existente | Igual: global autorizado recebe 400 pela clínica inativa; não global é negado antes |
| Criar outro perfil do mesmo User em outra clínica | Conflito | Igual: 409; não se usa POST para substituir uma edição negada |
| Alterar/desativar vínculo da clínica | Altera elegibilidade do perfil naquela clínica | Igual; não exclui/duplica o perfil global |

O endpoint continua `PATCH /clinics/:clinicId/professionals/:id`, com `/api` no modo unificado. A autorização global não elimina a necessidade de localizar um perfil de médico ativo/elegível na clínica ativa da URL. Se o recurso não estiver nesse escopo, a resposta continua 404. Não foi criado endpoint global alternativo para ignorar elegibilidade ou clínica inativa.

## 3. Implementação no backend

`ProfessionalsController.update` agora declara `@SystemAdmin()`, em vez de `@SystemAdminOrClinicRoles("clinicId", ADMIN)`. A criação e as quatro consultas mantêm seus decorators e papéis.

`ProfessionalsService.update` chama `assertSystemAdmin(currentUser)` **antes** de consultar clínica/perfil ou atribuir campos. Essa função, já criada em A02, usa a mesma mensagem do Guard: `Acesso restrito a administradores do sistema.` Assim, chamar o serviço diretamente como ADMIN local também falha com 403 antes de qualquer save.

Após autorizar o ator, o fluxo mantém a validação de clínica ativa, query de elegibilidade, normalização de CRM/UF/RQE, regras existentes de especialidade, checagem de CRM/UF duplicado e tratamento de violação de unicidade. Não houve alteração nos DTOs, índices, entidades ou rotinas clínicas.

Foi removida somente a exceção `ProfessionalsController.update` da allowlist de cobertura A02. Restam **11 exceções administrativas mistas**, com os mesmos comportamentos nos demais handlers. O inventário segue com 54 endpoints: 10 SystemAdmin, 11 administrativos mistos, 27 locais, 4 Authenticated e 2 públicos.

## 4. Ajustes no React

Foram separadas as capacidades:

- `canCreateProfessionals(role, isSystemAdmin)`: mantém System Admin ou ADMIN local.
- `canEditProfessionals(isSystemAdmin)`: permite somente a flag global.

`ProfessionalsPage` e `ProfessionalsList` recebem as duas decisões separadamente. ADMIN local conserva o botão e formulário de cadastro; o link de edição desaparece dos cards móveis, tabela desktop e detalhe. Acesso direto a `/profissionais/:id/editar` mostra alerta, orientação para solicitar correção ao administrador do sistema e link de volta, sem renderizar formulário de edição.

O formulário agora informa a todos os responsáveis pelo cadastro que o perfil é único e compartilhado; na criação, avisa que correções posteriores exigem System Admin. O detalhe também orienta usuários sem edição. Erros 403 retornados pela API são exibidos com a mensagem do backend, preservando a mensagem padronizada para edição global; 401 e os demais tratamentos existentes permanecem.

Foram mantidos coluna única como base, expansão por breakpoints, controles existentes, labels, alertas acessíveis e links navegáveis por teclado. Não houve criação de modal, alteração do calendário ou mudança na navegação clínica.

## 5. Arquivos modificados

| Arquivo | Alteração |
| --- | --- |
| `api/src/professionals/professionals.controller.ts` | PATCH exige SystemAdmin. |
| `api/src/professionals/professionals.service.ts` | Atualização exige ator global também no serviço. |
| `api/test/route-policy-coverage.test.cjs` | Remove a edição de perfil da allowlist administrativa mista. |
| `api/test/support/system-admin-fixture.cjs` | Extrai a fixture existente de A02 para reutilização e adiciona contador de gravações do perfil. Apenas código de testes, persistência em memória. |
| `api/test/system-admin-permissions.test.cjs` | Reutiliza a fixture extraída; conserva os 13 cenários de A02. |
| `api/test/professional-global-permissions.test.cjs` | Oito cenários de integração HTTP/serviço para A04 e perfil compartilhado A/B. |
| `api/package.json` | Comando `test:professionals`, incluindo build e regressões A01/A06/A07/A02. |
| `web/src/features/professionals/lib/professional.ts` | Separa criação/edição, mensagem de negação e apresentação de 403. |
| `web/src/features/professionals/pages/ProfessionalsPage.tsx` | Autoriza edição separadamente, bloqueia rota direta e orienta correções. |
| `web/src/features/professionals/components/ProfessionalsList.tsx` | Mantém cadastro e restringe links de edição nas duas apresentações. |
| `web/src/features/professionals/components/ProfessionalForm.tsx` | Explica compartilhamento global e restrição de correções antes de cadastrar. |
| `web/src/features/professionals/pages/ProfessionalsPage.test.tsx` | Dez testes de capacidades e renderização real da página/listas/formulários. |
| `docs/correcao-a04.md` | Este relatório; relatórios anteriores mantidos como registros históricos. |

## 6. Validação de isolamento entre clínicas

O cenário sintético estabelece um único perfil de um médico vinculado como OPHTHALMOLOGIST a A e B, com administradores locais distintos. Cada administrador tenta atualizar separadamente os quatro atributos globais via HTTP; ambos recebem 403. A mesma tentativa direta ao serviço é negada. O snapshot de todos os perfis e o contador de saves permanecem inalterados.

O System Admin sem vínculo local atualiza o mesmo ID com sucesso. Consultas por ID, User, CRM/UF e listagem feitas pelos administradores A/B retornam os novos valores e o mesmo ID; o número de perfis não aumenta. Isso demonstra que o compartilhamento persiste e sua manutenção foi centralizada, em vez de duplicar dados por clínica.

Os registros sintéticos de agendamentos, atendimentos e exames mantêm seus conteúdos e referências após a atualização global. A leitura da agenda passa a exibir o CRM global corrigido, preservando apenas ID/status do atendimento conforme A01. O médico continua consultando seu atendimento autorizado. Desativar vínculo em A e trocar papel em B altera apenas a visibilidade do perfil, sem excluí-lo ou duplicá-lo.

## 7. Testes e resultados

Comando reprodutível completo:

```sh
npm --prefix api run test:professionals
```

| Verificação executada | Resultado |
| --- | --- |
| `npm --prefix api run build` | Aprovado. |
| `npm --prefix api run lint` | Aprovado. |
| Execução dos oito arquivos da suíte `test:professionals`, após build | **69/69 aprovados:** 8 testes novos A04 e 61 regressões A01/A06/A07/A02/permissões. |
| Cobertura das políticas | **54 endpoints em 10 controllers**, sem política ausente ou exceção global fora da allowlist. |
| `npm --prefix web test -- --reporter=dot` | **17/17 aprovados:** 10 novos e 7 existentes. |
| `npm --prefix web run build` | Aprovado, com TypeScript e Vite/FullCalendar. |
| `npm --prefix web run lint` | Aprovado. |
| `git diff --check` | Aprovado. |

### Cenários de API/serviço

- Perfil compartilhado e ADMIN A/B tentando cada campo; 403 padronizado e **zero gravações** em HTTP e em chamadas diretas ao serviço.
- System Admin atualiza campos com normalização e consultas A/B permanecem consistentes; identidades e registros clínicos preservados.
- OPHTHALMOLOGIST, RECEPTIONIST e usuário sem vínculo não editam; ausência de JWT continua 401.
- ADMIN local cria um perfil elegível sem RQE, com especialidade padrão; segundo cadastro do mesmo User, inclusive por B, retorna 409 e não cria cópia. Criar sem vínculo elegível continua negado.
- CRM/UF duplicado retorna 409; CRM/RQE inválidos, UF inválida, especialidade vazia/excessiva e tentativa de alterar userId retornam 400, sem save.
- Vínculo de ator inativo, clínica inativa, perfil inexistente/fora da clínica e User profissional inativo mantêm os bloqueios existentes.
- Alterações de vínculos não apagam/duplicam perfil. O global pode corrigir pelo contexto B ativo quando A está inativa, mantendo o escopo de elegibilidade.
- Regressões mantêm A01, headers/cache/sessão A06, negação por padrão A07 e separação global/clínica A02.

### Cenários React

Os testes usam `react-dom/server` e MemoryRouter para renderizar os componentes reais, inclusive listas e formulários; hooks de sessão/consulta/mutação recebem fixtures. Confirmam as duas capacidades, ausência dos links de edição nas apresentações móvel/desktop e no detalhe para ADMIN local, bloqueio de URL direta para os três papéis locais, ausência de novas permissões para médico/recepção, aviso na criação e formulário de edição disponível ao global. Mantêm o bloqueio de contexto de clínica ausente.

As verificações não dependem apenas de um helper booleano: inspecionam o HTML realmente produzido pelo React e a presença/ausência do formulário. Ainda não simulam cliques, foco, viewport ou rede em navegador.

## 8. Impactos operacionais e limitações

- ADMIN local deve conferir CRM/UF e demais atributos antes do cadastro. RQE pode continuar pendente conforme a regra atual, mas complementação posterior exige System Admin. Não foi criado um papel novo, janela de edição pós-cadastro ou processo automático de aprovação.
- Para corrigir cadastros existentes, a clínica deve solicitar a alteração ao administrador do sistema pelo processo operacional disponível. Não foi adicionado ticket/mensagem a serviços externos nem workflow de solicitação dentro do aplicativo.
- Um perfil existente em outra clínica não deve ser cadastrado novamente. Ao existir vínculo médico ativo na clínica atual, ele pode ser consultado com o mesmo ID; duplicação continua retornando conflito.
- A edição global autorizada afeta todas as clínicas que usam o perfil, inclusive a identificação profissional exibida por registros históricos. Não há snapshots históricos de CRM/RQE/especialidade; esta correção restringe quem altera, sem remodelar esse comportamento.
- **Limitação de UI preexistente:** a página Profissionais ainda exige contexto de clínica ativa do provider. A API permite System Admin sem vínculo local operar no contexto explícito de uma clínica elegível, mas não foi criado seletor global de clínicas nesse módulo para administradores sem contexto na interface. Nenhum privilégio foi concedido para contornar essa limitação; a ampliação do fluxo visual exige revisão própria.
- As permissões de criação e consultas do profissional são as anteriores. Nenhuma regra clínica, histórica, de agenda ou exame foi alterada.
- HTTP/serviços reais foram exercitados com JWT e fixtures sintéticas em memória. PostgreSQL real, hidratação SQL, constraints em banco, concorrência/rollback e dados de produção não foram acessados. O bloqueio de `DataSource.initialize` permanece nas fixtures.
- A dependência de contexto de clínica ativa/elegibilidade para editar via API permanece: se todas as clínicas do profissional estiverem inativas ou não houver mais vínculo médico elegível, o fluxo atual não o encontra para atualização. Não foi criado endpoint global sem escopo para esse caso.

## 9. Pendências para homologação

1. Homologar o fluxo de correção de cadastro pelo System Admin e definir o canal operacional para pedidos das clínicas, incluindo RQE pendente e erro de digitação no cadastro inicial.
2. Em QA aprovado e isolado, validar um User/perfil com vínculos A/B persistidos, unicidade de User e CRM/UF e ausência de escrita após 403, sem fixtures em produção.
3. No navegador, conferir listas móvel/desktop, detalhe, cadastro local, URL direta de edição, edição global e comportamento ao perder permissão. Validar telas de 320/360/390 px, teclado/foco, zoom e leitor de tela.
4. Conferir agenda, prontuários e exames após correção global, preservando IDs, dados clínicos e proteção A01; observar que a identificação profissional exibida usa o cadastro global atual.
5. Reexecutar as suítes, reconstruir e validar o artefato apropriado após revisão, preservando os cuidados de Hostinger de A06. O `deploy/` existente não foi atualizado/publicado automaticamente.

Status: **A04 implementado e validado localmente; aguardando revisão e homologação antes de qualquer deploy.**
