# Clínicas — contratos auditados em 08/11/2026

Escopo desta implementação: somente `/web`. API e banco não são alterados.

| Endpoint real | Permissão do guard | Resposta |
| --- | --- | --- |
| GET /clinics | System Admin | Clinic[] sem paginação/filtros |
| POST /clinics | System Admin | Clinic criada |
| GET /clinics/document/:document | System Admin | Clinic por documento normalizado |
| GET /clinics/:id | ADMIN/OPHTHALMOLOGIST/RECEPTIONIST vinculados ou System Admin | Clinic |
| PATCH /clinics/:id | ADMIN vinculado ou System Admin | Clinic atualizada |
| PATCH /clinics/:id/active | System Admin | Clinic atualizada, corpo {active:boolean} |
| GET /users/:userId/clinics | Próprio usuário ou System Admin | Vínculos com resumo da clínica |
| GET /clinics/:clinicId/users | Papéis vinculados ou System Admin | Equipe com id, nome, email, ativo, papel e vínculo |

ClinicUsers também possui criação de vínculo e alteração de papel/status, mas não há interface completa de Usuários neste momento. Nesta etapa, equipe somente para consulta; sem convites, atribuição de papéis ou busca global de usuários.

CreateClinicDto: name (obrigatório, até 150), document (obrigatório, até 14), phone (20), email (150, válido), zipCode (8), number (20), neighborhood (100), city (100), state (2), street (150), complement (100). O cadastro não recebe active.

UpdateClinicDto: somente name, phone, email, street, number, complement, neighborhood e state. Documento, CEP e cidade são somente leitura na edição. Remoção de email não é explicitamente suportada pelo contrato string do DTO; a interface não envia null ou email vazio para apagar endereço existente.

A API normaliza o documento com trim/uppercase e remoção de caracteres não alfanuméricos. Não valida comprimento exato, dígitos verificadores ou autenticidade de CNPJ. O frontend não apresenta essa validação como existente: normaliza antes do envio e respeita obrigatoriedade/limite de 14. Email é normalizado para minúsculas. Duplicidade de documento no cadastro retorna 409. Não há campos de razão social, nome fantasia, timezone ou duração de consultas.

A busca, o filtro de status e a paginação visual são locais sobre a lista global já autorizada, pois a API retorna um array completo. Usuários locais nunca consultam GET /clinics para filtrar permissões na interface.

## Implementação entregue

- `/clinicas`: administração global para System Admin; para usuários locais, abre os dados da clínica ativa e recebe o rótulo Minha clínica.
- `/clinicas/nova`: cadastro exclusivo de System Admin.
- `/clinicas/:clinicId` e `/clinicas/:clinicId/editar`: detalhes e edição conforme vínculo autorizado; usuários locais não conseguem consultar outra clínica por URL sem vínculo ativo.
- `/minha-clinica`: visão da clínica ativa, inclusive para System Admin que possua vínculo. Um administrador global sem vínculo não recebe acesso clínico automático.
- Listagem com cards no mobile e tabela em desktop, busca por nome/documento/email, filtro ativo/inativo e páginas locais de 20 registros. Somente System Admin monta a consulta global.
- Formulário compartilhado de criação/edição, seções Identificação/Contato/Endereço, validações junto ao campo, foco no primeiro erro, bloqueio de envio duplicado, preservação de valores em falhas e proteção ao sair/recarregar/trocar clínica/logout com alterações não salvas.
- A edição envia somente os campos modificados e admitidos pelo UpdateClinicDto. Documento/CEP/cidade são somente leitura. Campo opcional de email vazio é omitido na criação; tentativa de apagar email existente na edição recebe orientação, sem payload null inventado.
- Detalhes incluem dados cadastrais, endereço, status e ações autorizadas. Ativação/desativação exige confirmação identificando a clínica. Não há exclusão ou contadores fictícios.
- Consulta de equipe autorizada via ClinicUsers: nome/email/papel/status do usuário e do vínculo; sem duplicar CRUD de vínculos ou criar fluxo de convite inexistente. A interface completa de gerenciamento de usuários permanece uma etapa separada.

## Cache e clínica ativa

Chaves administrativas são isoladas por usuário (`clinic-management`, usuário, global/detalhe/equipe). Consultas de detalhe/equipe conferem o ID da clínica retornada. Sessão encerrada continua limpando o QueryClient existente.

Após mutações, o registro confirmado pela API atualiza o cache de detalhes e o resumo compartilhado da clínica nos vínculos, seguido de revalidação das consultas administrativas e dos vínculos. Assim, o nome editado aparece também no menu lateral, sem uma segunda cópia persistente da clínica.

ClinicProvider revalida vínculos ao focar a janela e a cada 60 segundos em primeiro plano. Um erro de revalidação deixa o contexto sem vínculo autorizado, em vez de manter clínica potencialmente inválida. A desativação confirmada remove imediatamente a clínica das opções elegíveis. Seleção explícita que perdeu validade não é substituída silenciosamente pela outra clínica: o usuário precisa selecioná-la no menu.

Consultas do contexto clínico anterior são canceladas/removidas ao perder ou trocar a clínica. O efeito restringe a limpeza ao ID anterior para não cancelar consultas recém-criadas da nova clínica. Dados administrativos permanecem isolados em suas chaves e não são removidos pela troca de clínica, permitindo administrar/reativar uma clínica inativa quando autorizado. Foi validado também que Pacientes continua carregando após trocar de clínica.

A revalidação periódica não equivale a atualização em tempo real entre navegadores. A autorização definitiva de novas operações continua sendo feita pelos guards/strategy do NestJS.

## Arquivos

Criados nesta feature:

- `components/ClinicStatusBadge.tsx`, `ClinicFormFields.tsx`, `ClinicForm.tsx`, `ClinicList.tsx`, `ClinicDetails.tsx`, `ClinicTeam.tsx`.
- `hooks/use-clinics.ts`, `lib/clinic.ts`, `schemas/clinic.ts`, `pages/ClinicsPage.tsx`, `README.md`.

Ampliados: `api/clinics-api.ts` e `types/clinic.ts`.

Fora da feature, somente em `/web`: `App.tsx` (rotas lazy), `ClinicProvider.tsx` (revalidação/limpeza), `Sidebar.tsx` e `Header.tsx` (Minha clínica e seleção após invalidação), `use-unsaved-clinical-changes.ts` (mensagem opcional sem mudar o padrão clínico) e `FRONTEND_PROGRESS.md`.

Reutilizados: layout, cliente HTTP, autenticação/contexto, TanStack Query, React Hook Form, Zod, React Router, Tailwind, inputClass/buttonClass, ClinicalDialog e proteção de alterações não salvas. Paleta safira, Montserrat/Roboto, bordas/seções e espaçamento label/campo de 4px preservados. Nenhuma dependência nova, alteração em API ou migration.

## Validações executadas

- ESLint: aprovado.
- TypeScript e build Vite: aprovados (`npm run build` executa `tsc -b`).
- Vitest: executado com `--passWithNoTests`; nenhuma suíte encontrada. Não representa aprovação de testes unitários inexistentes.
- Script temporário de automação Chromium, fora do repositório, com respostas simuladas dos contratos reais: listagem global, busca/status/paginação, criação, documento vazio após normalização, documento duplicado (409), email inválido, detalhes/equipe, edição global e local, campos somente leitura, envio exclusivo de campos alterados, falha 503 com preservação dos valores e recuperação.
- Perfis e rotas: System Admin, ADMIN local, RECEPTIONIST, OPHTHALMOLOGIST, usuário sem vínculo, consulta negada 403 e sessão expirada 401. Usuários locais não disparam GET /clinics nem consultas de clínicas não autorizadas por URL.
- Contexto: nome compartilhado após edição; desativação da clínica selecionada; invalidação do contexto e remoção de cache clínico fictício; nova seleção; reativação; carregamento de Pacientes após troca de clínica.
- Layout: 320, 375, 390, 768, 1024 e 1440 px para lista, formulário, detalhes e confirmação; sem overflow horizontal indevido. Navegação Tab/Shift+Tab, foco visível, modal nativo e zoom CSS 200%. Revisão de capturas mobile e desktop.
- Nenhum teste fez alterações reais na API ou no banco. Scripts/capturas em `/tmp`; sem arquivos de teste adicionados ao projeto.

## Limitações e pendências

- Integração com persistência real não foi homologada nesta tarefa: testes de navegador utilizaram API simulada, respeitando a regra de não alterar o banco. Os endpoints implementados no frontend são reais, mas o cadastro/edição/status precisam de validação no ambiente autorizado do projeto.
- Validação de dígitos verificadores de CNPJ não existe no backend; isso não foi corrigido nem apresentado como validação existente. O frontend só valida obrigatoriedade e tamanho do documento normalizado, conforme o contrato auditado.
- Busca/paginação permanecem locais porque GET /clinics retorna o array completo. Uma evolução para grandes volumes exige contrato paginado no backend.
- Remoção de email e edição de documento/CEP/cidade exigem decisão de contrato no backend para expansão da interface.
- CRUD completo de equipe/usuários e configurações de timezone/agenda não foram adicionados.
- Zoom nativo, dispositivos físicos, Safari e Firefox permanecem pendentes. Os alvos de toque dos controles novos seguem o mínimo de 44px.


## Integração posterior com Usuários

A consulta de equipe agora reutiliza ClinicMemberList e oferece acesso a /clinicas/:clinicId/usuarios, implementado em features/clinic-users. A seção histórica acima descreve a etapa anterior, em que a equipe era apenas consultável. O gerenciamento atual respeita a clínica ativa para usuários locais; System Admin pode escolher escopo administrativo por rota. Contratos e limitações atuais em ../users/README.md.
