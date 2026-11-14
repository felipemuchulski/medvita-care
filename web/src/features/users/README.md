# Usuários e vínculos — auditoria de contratos (08/11/2026)

Escopo: somente frontend; API, banco e regras de autenticação não são alterados.

| Endpoint | Permissão / contrato real |
| --- | --- |
| GET /users | System Admin; array sem paginação; filtros email exato e active boolean |
| POST /users | System Admin; name/email até 150 e password de 8 a 255; sem flag administrativa na criação |
| GET /users/:id | System Admin; usuário global |
| PATCH /users/:id | System Admin; name/email opcionais até 150 e isSystemAdmin boolean opcional |
| PATCH /users/:id/active | System Admin; {active:boolean}; incrementa tokenVersion |
| PATCH /users/:id/password | Próprio usuário ou System Admin, mas exige currentPassword do alvo e newPassword >=8; não é reset sem senha atual |
| PATCH /auth/change-password | Fluxo existente de própria senha; currentPassword + newPassword 8..255; revoga sessões |
| GET /users/:userId/clinics | Próprio usuário ou System Admin; vínculos e resumo das clínicas |
| GET /clinics/:clinicId/users | System Admin ou papel vinculado ADMIN/RECEPTIONIST/OPHTHALMOLOGIST; lista membros e dados públicos do usuário |
| POST /clinics/:clinicId/users | System Admin ou ADMIN local; {userId UUID v4, role}; não há busca local de candidatos nem convite |
| PATCH /clinics/:clinicId/users/:userId/role | System Admin ou ADMIN local; role ADMIN/RECEPTIONIST/OPHTHALMOLOGIST |
| PATCH /clinics/:clinicId/users/:userId/active | System Admin ou ADMIN local; {active:boolean} |

O usuário é global e pode ter vários vínculos; perfil profissional é independente e único por usuário. Não é criado automaticamente por estas operações. Sem exclusão física de usuários/vínculos.

UsersService incrementa tokenVersion ao alterar email, isSystemAdmin, status ou senha; alterar nome não incrementa. Na mesma sessão, alterações próprias exigem revalidação ou novo login. ClinicUsersService protege o último ADMIN ativo, exige ADMIN como primeiro vínculo ativo, recusa vínculo duplicado e recusa ativação de vínculo com usuário/clínica inativos. Mudanças de papel/vínculo não incrementam tokenVersion: a interface deve renovar o retrato autenticado e os vínculos do próprio ator para refletir permissões.

A API retorna dados sem passwordHash via ClassSerializerInterceptor. O frontend também aplica allowlist antes do cache e não armazena password/tokenVersion. Senha inicial será enviada diretamente pelo cliente HTTP, fora de useMutation/TanStack Query, e descartada após sucesso. Não há convite, recuperação por email ou reset administrativo sem senha atual.

Busca de nome e paginação serão locais sobre os resultados globais autorizados. Email exato e status utilizam os filtros reais de GET /users. ADMIN local não chama GET /users ou GET /users/:id para buscar candidatos; criação de novos vínculos por seleção de usuário global fica exclusiva de System Admin até existir busca local autorizada.

## Entrega implementada

- Rotas globais `/usuarios`, `/usuarios/novo`, `/usuarios/:userId` e `/usuarios/:userId/editar`, protegidas por isSystemAdmin antes de montar consultas globais.
- Listagem com cards no mobile, tabela no desktop, filtro de email exato/status no servidor, busca local de nome e paginação visual local de 20 itens sobre a resposta autorizada.
- Cadastro RHF/Zod, nome/email/senha inicial, mostrar/ocultar senha e ausência de privilégio global no payload de criação. Senha só no formulário e no POST; sem useMutation para credenciais.
- Edição compartilhada de nome/email e flag administrativa autorizada pelo DTO. Apenas campos alterados são enviados; senha existente nunca é carregada. Mudança de privilégio e mudança do próprio email têm confirmação explícita.
- Detalhes, vínculos do usuário, status de conta com confirmação e acesso ao fluxo existente de troca da própria senha. Sem recuperação por email ou redefinição administrativa fictícia.
- Rotas de equipe `/usuarios-clinica` (clínica ativa) e `/clinicas/:clinicId/usuarios` (escopo administrativo explícito para System Admin; usuário local precisa estar na clínica ativa autorizada).
- Listagem de membros em cards/tabela, papéis e status separados da conta. ADMIN local altera papéis/status de vínculos existentes, sem acesso global. Recepcionista/oftalmologista têm consulta somente. System Admin pode pesquisar conta ativa por email exato e criar vínculo.
- API protege o último ADMIN ativo e o primeiro vínculo. Respostas de erro/duplicidade são apresentadas sem sucesso antecipado; ativação fica indisponível quando conta ou clínica está inativa.
- Alterações no próprio vínculo/papel renovam o retrato de sessão pela operação de refresh existente, revalidam vínculos e removem dados do escopo clínico anterior. Mudanças próprias que revogam tokenVersion levam ao login. Não houve mudança de JWT, TTL, cookies ou regras da API.
- Integração com Clínicas reutiliza a mesma consulta e a mesma apresentação de equipe. Profissionais recebe invalidação para refletir elegibilidade de usuários; um vínculo OPHTHALMOLOGIST não cria nem comprova um perfil profissional.

## Arquivos e reutilização

Criados: diretórios `features/users/{api,components,hooks,lib,pages,schemas,types}` e `features/clinic-users/{api,components,hooks,pages}`. A documentação de contratos fica neste README.

Alterados fora das features: App.tsx, Header.tsx, Sidebar.tsx, AuthProvider.tsx/auth-context.ts, ClinicProvider.tsx e ClinicTeam.tsx. Relatório consolidado em `web/FRONTEND_FINAL_REPORT.md` e histórico em `web/FRONTEND_PROGRESS.md`.

Reutilizados cliente HTTP, QueryClient, contextos, ClinicTeam/consultas de Clínicas, estilos inputClass/buttonClass, ClinicalDialog e aviso de alterações não salvas. Nenhuma dependência nova. O contexto expõe revalidateSession para reutilizar refresh existente, sem novo endpoint/autenticação paralela.

Cache global por ator (`user-management`); equipe por ator/clínica nas chaves existentes (`clinic-management`). Dados pessoais não são persistidos no navegador. A allowlist remove propriedades internas antes do cache; logout continua limpando QueryClient. A troca de clínica preserva somente o cache administrativo autorizado e limpa o escopo clínico anterior.

## Validações desta etapa

- ESLint, TypeScript/build aprovados. Vitest executado com --passWithNoTests: nenhuma suíte encontrada; não representa testes unitários aprovados.
- Chromium com respostas simuladas e dados fictícios: CRUD de usuários, nome/email/status, paginação, duplicidade 409, email/senha inválidos, mostrar/ocultar senha, falha 503 preservando campos, campos permitidos no payload e confirmação de privilégio.
- Cache inspecionado no navegador: senha inicial, passwordHash e tokenVersion não ficaram nas queries/mutações da administração. Nenhum segredo foi registrado em console ou arquivo de testes.
- Vínculos: criar, duplicidade, alterar papel, ativar/desativar, proteção do último administrador apresentada a partir da resposta 400, seleção de clínica e bloqueio de outra clínica não autorizada.
- Papéis: System Admin, ADMIN local, RECEPTIONIST, OPHTHALMOLOGIST e usuário sem vínculo. ADMIN local não faz GET /users, não vê criação por busca global e perde ações administrativas imediatamente após alterar o próprio papel para recepcionista.
- Próprio email com revogação simulada e troca da própria senha levaram ao login; sessão expirada 401, acesso negado 403 e logout com limpeza do cache verificados.
- 320/375/390/768/1024/1440 px para listagem, formulário/detalhes, equipe/vínculo e confirmação; sem overflow horizontal indevido. Zoom CSS 200%, Tab/Shift+Tab, foco visível e capturas desktop/mobile revisados.
- Smoke de navegação e estados vazios: Pacientes, Profissionais, Agendamentos, Calendário, Prontuários, Exames, Clínicas e Equipe, sem erros de execução detectados. Não equivale à execução completa do fluxo clínico.
- Scripts temporários fora do repositório: `/tmp/medvita-browser/users.cjs`, `users-smoke.cjs` e capturas de validação. Nenhum arquivo de teste unitário foi adicionado ao projeto.

## Pendências e limites

- Persistência/API real e fluxo clínico completo precisam de homologação em ambiente autorizado; não foram alterados API ou banco nesta tarefa.
- ADMIN local continua sem pesquisa segura de candidatos a novo vínculo: depende de endpoint autorizado futuro ou atuação do System Admin. Não há convite por email.
- Não há reset administrativo sem conhecimento da senha atual do alvo; reutilizou-se somente o fluxo próprio existente.
- GET /users não tem paginação e não pesquisa nome no servidor. Grandes volumes exigem evolução do contrato.
- Usuário global não inclui perfil profissional na consulta; a interface não presume sua existência. O módulo Profissionais mantém suas próprias regras e consultas.
- Mudanças feitas em outro navegador são percebidas nas requisições/revalidações existentes; não há atualização por push. Revogação de tokenVersion é imposta pelo servidor.
- Dispositivos físicos, zoom nativo, Safari e Firefox permanecem pendentes. Não há avaliação de conformidade integral com LGPD nesta entrega.
