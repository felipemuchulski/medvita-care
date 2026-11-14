# Relatório da estrutura do front-end — Medvita Care

Análise do código presente em `web/`, em 6 de novembro de 2026.

Este documento explica as pastas, os arquivos, suas responsabilidades e os principais fluxos internos. A descrição se baseia na leitura do código; não representa homologação das telas com o back-end em execução. Dependências instaladas em `node_modules/` são tratadas como bibliotecas externas, sem inventário de seus arquivos internos.

## 1. Visão geral

O front-end é uma aplicação React com TypeScript, executada no navegador. O Vite inicia o ambiente de desenvolvimento e gera a versão de produção. O React Router escolhe a tela conforme a URL, sem exigir um novo documento HTML a cada navegação interna.

A organização combina infraestrutura compartilhada com módulos por funcionalidade:

- **Infraestrutura:** comunicação HTTP, tratamento de erros, cache, sessão, clínica ativa e layout.
- **Módulos de negócio:** autenticação (`auth`), vínculos com clínicas (`clinics`) e pacientes (`patients`).
- **Páginas gerais:** dashboard e tela genérica de módulos em desenvolvimento.

O módulo de pacientes é o mais completo: possui listagem, busca, filtros, paginação, cadastro, edição, detalhes e alteração de status. Autenticação e seleção de clínica também possuem chamadas à API. Agenda, profissionais, prontuários, exames, gestão de clínicas e gestão de usuários ainda usam uma tela de aviso.

### Tecnologias e funções

| Tecnologia        | Uso no projeto                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| React e React DOM | Componentes visuais e montagem da aplicação no navegador.                         |
| TypeScript        | Tipos para dados, propriedades de componentes e contratos de funções.             |
| Vite              | Servidor de desenvolvimento, proxy da API e build de produção.                    |
| React Router      | Rotas, redirecionamentos, parâmetros de URL e layouts com rotas filhas.           |
| TanStack Query    | Consulta à API, cache em memória, estados de carregamento e atualização de dados. |
| React Hook Form   | Estado, submissão e erros do formulário de pacientes.                             |
| Zod e resolvers   | Validação dos campos de pacientes e ligação com React Hook Form.                  |
| Tailwind CSS      | Estilos por classes e tema de cores.                                              |
| Lucide React      | Ícones usados nas telas e na navegação.                                           |
| Vitest            | Testes unitários das regras e dos contratos de chamadas HTTP.                     |
| ESLint            | Análise estática do código e regras de React Hooks.                               |

As versões e faixas de versões declaradas estão em `package.json`; as resoluções das dependências estão em `package-lock.json`.

## 2. Mapa das pastas e dos arquivos

```text
web/
├── .env.example
├── .gitignore
├── FRONTEND_PROGRESS.md
├── README.md
├── RELATORIO_FRONTEND.md
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── node_modules/                   # Dependências instaladas
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── vite-env.d.ts
    ├── api/
    │   ├── api-error.ts
    │   ├── http-client.ts
    │   └── http-client.test.ts
    ├── app/
    │   └── navigation.ts
    ├── assets/
    │   ├── hero.png
    │   ├── react.svg
    │   └── vite.svg
    ├── components/layout/
    │   ├── AppLayout.tsx
    │   ├── Header.tsx
    │   └── Sidebar.tsx
    ├── contexts/
    │   ├── auth-context.ts
    │   ├── AuthProvider.tsx
    │   ├── clinic-context.ts
    │   └── ClinicProvider.tsx
    ├── hooks/
    │   ├── use-auth.ts
    │   └── use-clinic.ts
    ├── lib/
    │   └── query-client.ts
    ├── pages/
    │   ├── DashboardPage.tsx
    │   └── ModulePage.tsx
    └── features/
        ├── auth/
        │   ├── api/
        │   │   ├── auth-api.ts
        │   │   └── auth-api.test.ts
        │   ├── pages/
        │   │   ├── LoginPage.tsx
        │   │   └── ChangePasswordPage.tsx
        │   ├── routes/
        │   │   ├── ProtectedRoute.tsx
        │   │   └── PublicOnlyRoute.tsx
        │   └── types/auth.ts
        ├── clinics/
        │   ├── api/clinics-api.ts
        │   ├── lib/
        │   │   ├── allowed-memberships.ts
        │   │   └── allowed-memberships.test.ts
        │   └── types/clinic.ts
        └── patients/
            ├── api/
            │   ├── patients-api.ts
            │   └── patients-api.test.ts
            ├── components/
            │   ├── PatientForm.tsx
            │   ├── PatientStatusBadge.tsx
            │   └── PatientsUnavailable.tsx
            ├── hooks/use-patients.ts
            ├── lib/
            │   ├── patient-format.ts
            │   ├── patient-format.test.ts
            │   ├── patient-permissions.ts
            │   ├── patient-permissions.test.ts
            │   ├── patient-schema.ts
            │   └── patient-schema.test.ts
            ├── pages/
            │   ├── PatientsPage.tsx
            │   ├── CreatePatientPage.tsx
            │   ├── EditPatientPage.tsx
            │   └── PatientDetailsPage.tsx
            └── types/patient.ts
```

### Como interpretar os nomes

| Nome         | Responsabilidade                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `pages`      | Telas associadas a rotas. Coordenam componentes, consultas e navegação.                                              |
| `components` | Partes visuais reutilizáveis, como formulário e menu.                                                                |
| `hooks`      | Funções React que encapsulam acesso a contexto ou operações com dados.                                               |
| `contexts`   | Contratos e providers de estado compartilhado pela aplicação.                                                        |
| `api`        | Comunicação com o servidor. Na raiz de `src`, infraestrutura HTTP; dentro de uma feature, endpoints daquele domínio. |
| `lib`        | Funções auxiliares, regras e configurações.                                                                          |
| `types`      | Contratos TypeScript dos dados. Não fazem chamadas nem validam respostas em tempo de execução.                       |
| `features`   | Agrupamento de arquivos relacionados a uma funcionalidade.                                                           |
| `.tsx`       | TypeScript que pode conter JSX, a sintaxe de componentes visuais.                                                    |
| `.ts`        | TypeScript usado para funções, contratos e configurações.                                                            |
| `.test.ts`   | Testes automatizados próximos do código que verificam.                                                               |

## 3. Arquivos da raiz de `web/`

| Arquivo ou pasta        | O que faz e como está organizado                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`          | Identifica o pacote como privado e ES Modules. Divide bibliotecas entre dependências de uso e ferramentas de desenvolvimento. Define os comandos `dev`, `build`, `lint`, `test`, `test:watch` e `preview`.                                                      |
| `package-lock.json`     | Registra a árvore e as versões resolvidas pelo npm para reproduzir instalações. É gerado e atualizado pelo gerenciador de pacotes. Não contém lógica das telas.                                                                                                 |
| `vite.config.ts`        | Habilita os plugins de React e Tailwind. Lê variáveis de ambiente e configura um proxy de desenvolvimento: requisições com `/api` vão para `VITE_API_PROXY_TARGET`, cujo padrão é `http://localhost:3000`. O prefixo `/api` é removido antes do encaminhamento. |
| `.env.example`          | Exemplo de configuração: `VITE_API_URL=/api` e `VITE_API_PROXY_TARGET=http://localhost:3000`. Serve de referência; não é carregado automaticamente como um arquivo `.env`.                                                                                      |
| `index.html`            | Documento inicial. Cria `<div id="root">`, referencia o favicon e carrega `/src/main.tsx`. Atualmente mantém `lang="en"` e título `web`, apesar da interface em português.                                                                                      |
| `tsconfig.json`         | Liga os dois projetos TypeScript: aplicação e configuração de ferramentas.                                                                                                                                                                                      |
| `tsconfig.app.json`     | Configura o código em `src`: recursos ES2023, APIs do navegador, JSX de React e resolução de módulos para o bundler. Não emite JavaScript diretamente e verifica itens como variáveis e parâmetros não utilizados.                                              |
| `tsconfig.node.json`    | Configura a análise de `vite.config.ts`, com tipos de Node e resolução `nodenext`.                                                                                                                                                                              |
| `eslint.config.js`      | Aplica regras recomendadas de JavaScript, TypeScript, React Hooks e React Refresh aos arquivos `.ts` e `.tsx`. Ignora `dist`.                                                                                                                                   |
| `.gitignore`            | Exclui do versionamento dependências, builds, logs e arquivos locais de ferramentas e editores.                                                                                                                                                                 |
| `README.md`             | Ainda apresenta a documentação genérica do template React + TypeScript + Vite, incluindo sugestões de configuração do ESLint. Não é um guia específico do Medvita Care.                                                                                         |
| `FRONTEND_PROGRESS.md`  | Histórico cumulativo das etapas de desenvolvimento, decisões, endpoints, validações anteriores e pendências. Seus resultados de testes são registros históricos, não uma execução atual.                                                                        |
| `RELATORIO_FRONTEND.md` | Este relatório: inventário e explicação da estrutura atual.                                                                                                                                                                                                     |
| `node_modules/`         | Código de bibliotecas instalado pelo npm. Não é código autoral do sistema e não deve ser usado como local para implementar funcionalidades.                                                                                                                     |

O comando `build` executa `tsc -b` e depois `vite build`. O resultado padrão do Vite fica em `dist/`, uma pasta gerada e ignorada pelo Git. O proxy descrito acima pertence ao servidor de desenvolvimento; a publicação precisa ter seu próprio endereço de API ou encaminhamento configurado.

## 4. Inicialização e rotas

### `src/main.tsx`

É o ponto de entrada do React. Localiza `#root`, cria a raiz de renderização e monta os providers nesta ordem:

```text
StrictMode
└── QueryClientProvider
    └── AuthProvider
        └── ClinicProvider
            └── BrowserRouter
                └── App
```

`StrictMode` habilita verificações adicionais de desenvolvimento. `QueryClientProvider` disponibiliza o cache e as consultas. `AuthProvider` controla a sessão. `ClinicProvider` depende do usuário autenticado para consultar seus vínculos. `BrowserRouter` disponibiliza a navegação por URL. O arquivo também importa `index.css`.

### `src/App.tsx`

Declara as rotas. Organiza a tela pública de login sob `PublicOnlyRoute` e as telas autenticadas sob `ProtectedRoute`. Dentro da área autenticada, `AppLayout` fornece menu e cabeçalho comuns. URLs desconhecidas redirecionam para `/`.

| Rota                           | Componente           | Comportamento atual                      |
| ------------------------------ | -------------------- | ---------------------------------------- |
| `/login`                       | `LoginPage`          | Login; acessível quando não autenticado. |
| `/`                            | `DashboardPage`      | Atalhos e área informativa de agenda.    |
| `/pacientes`                   | `PatientsPage`       | Lista da clínica ativa.                  |
| `/pacientes/novo`              | `CreatePatientPage`  | Cadastro, sujeito ao papel na clínica.   |
| `/pacientes/:patientId`        | `PatientDetailsPage` | Dados e ações do paciente.               |
| `/pacientes/:patientId/editar` | `EditPatientPage`    | Edição, sujeita ao papel na clínica.     |
| `/agendamentos`                | `ModulePage`         | Aviso de desenvolvimento.                |
| `/calendario`                  | `ModulePage`         | Aviso de desenvolvimento.                |
| `/profissionais`               | `ModulePage`         | Aviso de desenvolvimento.                |
| `/prontuarios`                 | `ModulePage`         | Aviso de desenvolvimento.                |
| `/exames`                      | `ModulePage`         | Aviso de desenvolvimento.                |
| `/clinicas`                    | `ModulePage`         | Aviso de desenvolvimento.                |
| `/usuarios`                    | `ModulePage`         | Aviso de desenvolvimento.                |
| `/alterar-senha`               | `ChangePasswordPage` | Troca de senha do usuário autenticado.   |

Estar em uma rota protegida comprova apenas que há uma sessão no estado do front-end. As regras por clínica e papel são aplicadas nas partes específicas do módulo de pacientes; a validação efetiva das operações também depende da API.

### `src/app/navigation.ts`

Exporta `navigationItems`, uma lista de objetos com `label`, `path` e `icon`. Essa lista alimenta os links da sidebar e a identificação da página no header. Ela não registra rotas: isso continua sendo responsabilidade de `App.tsx`. Atualmente os itens do menu não são filtrados por papel.

## 5. Comunicação HTTP e erros

### `src/api/api-error.ts`

Padroniza os erros para que as telas não precisem interpretar cada resposta do servidor individualmente.

Sua estrutura interna contém:

1. **`ApiErrorCode`:** conjunto de códigos como `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `SERVER_ERROR`, `NETWORK_ERROR` e `REQUEST_ABORTED`.
2. **`statusMessages`:** mensagens em português associadas a status HTTP comuns.
3. **`codeForStatus(status)`:** converte status HTTP em um código interno. Por exemplo, `401` vira `UNAUTHORIZED`; status a partir de `500` viram `SERVER_ERROR`.
4. **`safeMessages(payload)`:** lê a propriedade `message` de um objeto, aceita string ou lista, mantém somente strings, remove espaços nas pontas, limita cada mensagem a 300 caracteres e a lista a 10 mensagens.
5. **`readErrorPayload(response)`:** tenta ler JSON somente quando o `Content-Type` indica `application/json`. Se a leitura falhar, retorna `undefined`.
6. **Classe `ApiError`:** estende `Error` e adiciona `status`, `code`, `messages` e a causa opcional `cause`.
7. **`ApiError.fromResponse(response)`:** constrói o erro a partir de uma resposta HTTP. Para status abaixo de `500`, pode usar as mensagens da API. Para erros de servidor, usa mensagens genéricas. A primeira mensagem também fica em `error.message`.
8. **`ApiError.network(cause)` e `ApiError.aborted(cause)`:** criam erros de conexão e cancelamento, com status `0` porque não representam uma resposta HTTP recebida.
9. **`isApiError(error)`:** verifica `instanceof ApiError` e permite acessar os campos específicos com tipagem TypeScript.

Exemplo de fluxo: a API devolve `403` → `fromResponse` cria um erro com código `FORBIDDEN` → a tela reconhece `isApiError(error)` → apresenta `error.message`.

O nome `safeMessages` descreve filtragem e limites de conteúdo; a função não traduz nem revisa semanticamente mensagens do servidor. A proteção explícita contra repassar detalhes internos consiste em descartar as mensagens de respostas `5xx`.

### `src/api/http-client.ts`

É a implementação compartilhada de acesso à API, baseada em `fetch`.

| Parte interna                    | Responsabilidade                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QueryParams`                    | Define parâmetros de consulta: textos, números, booleanos e listas desses valores.                                                                 |
| `RequestOptions`                 | Combina opções do `fetch` com `body`, `headers`, `query` e controle de autenticação.                                                               |
| `AuthHandlers`                   | Contrato dos callbacks para obter token, renová-lo e encerrar sessão.                                                                              |
| `HttpClientOptions`              | Recebe a URL base e, opcionalmente, uma implementação de `fetch`, útil nos testes.                                                                 |
| `normalizeBaseUrl`               | Remove espaços e barras finais; usa `/api` se a configuração ficar vazia.                                                                          |
| `appendQuery`                    | Monta a query string com `URLSearchParams`. Ignora valores vazios, nulos e indefinidos; preserva `false` e `0`. Listas viram parâmetros repetidos. |
| `isAbortError`                   | Reconhece cancelamento representado por `DOMException` com nome `AbortError`.                                                                      |
| `toRequestInit`                  | Retira opções próprias do cliente antes de repassar as demais ao `fetch`.                                                                          |
| `configureAuth`                  | Conecta ou remove callbacks de autenticação, sem importar componentes React.                                                                       |
| `get`, `post`, `patch`, `delete` | Atalhos tipados para os métodos HTTP disponíveis.                                                                                                  |
| `request` e `execute`            | Executam a requisição, montam headers e corpo, tratam falhas e controlam a repetição após `401`.                                                   |
| `refreshAccessToken`             | Compartilha uma promessa de renovação entre requisições simultâneas, evitando vários refreshes concorrentes enquanto ela estiver pendente.         |
| `parseResponse`                  | Trata `204` como ausência de conteúdo, lê JSON quando indicado e texto nos demais casos.                                                           |
| `httpClient`                     | Instância única exportada, com `VITE_API_URL` ou `/api` como base.                                                                                 |

Uma requisição normalmente segue estes passos:

1. Monta URL e parâmetros.
2. Define `Accept: application/json` e, quando existe corpo, `Content-Type: application/json`.
3. Obtém o access token e adiciona `Authorization: Bearer ...`, salvo em chamadas com `authenticated: false`.
4. Serializa o corpo como JSON e chama `fetch`.
5. Converte falhas de conexão ou cancelamento em `ApiError`.
6. Se receber `401` numa chamada autenticada, tenta renovar a sessão e repetir a chamada original uma única vez, quando o callback está configurado.
7. Em resposta sem sucesso, lança `ApiError`; em sucesso, devolve o conteúdo interpretado.

Os tipos genéricos descrevem o formato esperado pelo código. O cliente não executa uma validação Zod das respostas recebidas.

### `src/lib/query-client.ts`

Cria a instância compartilhada de `QueryClient` com estas regras:

- Dados são considerados atualizados por 30 segundos (`staleTime`).
- Consultas inativas podem permanecer no cache por 5 minutos (`gcTime`).
- Consultas podem ter uma tentativa adicional em erro de rede ou HTTP `5xx` reconhecido como `ApiError`.
- Outros erros não são repetidos por essa política.
- Focar novamente a janela não dispara atualização automática.
- Mutations, como cadastro e edição, não recebem tentativas extras pelo TanStack Query.

A renovação após `401` é uma regra independente do cliente HTTP; por isso também pode ocorrer em uma mutation. O cache configurado fica em memória.

## 6. Estado compartilhado e hooks globais

### `src/contexts/auth-context.ts`

Define o contrato `AuthContextValue`, com `status`, `user`, `login`, `logout` e `changePassword`. O status pode ser `authenticated` ou `unauthenticated`. Cria o contexto com valor inicial `null`; a implementação do estado está no provider separado.

### `src/contexts/AuthProvider.tsx`

Controla a sessão em memória. Usa `useState` para provocar renderizações e `sessionRef` para permitir que o cliente HTTP consulte a sessão atual sem depender de um fechamento antigo de função.

- **`clearSession`:** apaga a sessão das duas representações e limpa o cache com `queryClient.clear()`.
- **`refreshSession`:** lê o refresh token atual, chama `authApi.refresh`, atualiza a sessão e devolve o novo access token. Se falhar, limpa a sessão e retorna `null`.
- **Effects e refs auxiliares:** mantêm os callbacks atuais e configuram a ponte de autenticação no `httpClient`. O cleanup remove essa configuração.
- **`login`:** chama a API e guarda a resposta de autenticação.
- **`logout`:** tenta avisar o servidor e sempre limpa o estado local, mesmo se a chamada falhar.
- **`changePassword`:** envia a troca à API e limpa a sessão após sucesso.
- **`useMemo`:** monta o objeto público do contexto com usuário, status e operações.

Access token, refresh token e usuário não são persistidos em armazenamento do navegador. Ao recarregar a página, a sessão local se perde. O refresh é reativo a uma resposta `401`; não há temporizador baseado em `expiresIn` neste provider.

### `src/contexts/clinic-context.ts`

Define o contrato do contexto clínico: vínculos autorizados, vínculo ativo, ID da clínica, papel, carregamento, erro e função de seleção.

### `src/contexts/ClinicProvider.tsx`

Coordena os vínculos do usuário e a clínica escolhida:

1. Obtém o usuário com `useAuth`.
2. Consulta `/users/:userId/clinics` somente quando existe usuário. A chave de cache inclui o ID desse usuário.
3. Filtra a resposta por `getAllowedMemberships`.
4. Mantém uma seleção em memória associada a `userId` e `clinicId`, evitando aplicar a seleção de outro usuário.
5. Se há exatamente um vínculo permitido, usa-o automaticamente. Com vários, aguarda seleção.
6. `selectClinic` rejeita IDs fora dos vínculos permitidos e ignora selecionar novamente a clínica já ativa.
7. Ao trocar, remove as consultas cujo primeiro item da chave não é `clinic-memberships` e atualiza a seleção.
8. Disponibiliza os dados e uma mensagem de erro pelo contexto.

A remoção de cache usa uma regra ampla: preserva as consultas de vínculos e remove as demais consultas, não apenas as de pacientes.

### `src/hooks/use-auth.ts`

Encapsula `useContext(AuthContext)`. Retorna o contrato de autenticação e lança um erro de programação se chamado fora de `AuthProvider`.

### `src/hooks/use-clinic.ts`

Faz o equivalente para `ClinicContext`, exigindo que o componente esteja dentro de `ClinicProvider`.

## 7. Layout compartilhado

### `src/components/layout/AppLayout.tsx`

Monta a estrutura das telas autenticadas: sidebar, header e área principal. Mantém `isSidebarOpen` para o menu mobile. Registra um listener para fechar o menu com Escape e o remove no cleanup. Renderiza a página atual com `Outlet`.

### `src/components/layout/Header.tsx`

Lê a URL e procura o item correspondente em `navigationItems`, incluindo subrotas como `/pacientes/novo`. Mostra o título encontrado ou `Medvita Care` como alternativa. Exibe o nome do usuário em telas maiores, botão de menu no mobile, link para alterar senha e botão de logout. Usa `isLoggingOut` para impedir cliques repetidos durante a saída.

### `src/components/layout/Sidebar.tsx`

Recebe `isOpen` e `onClose`. Apresenta a marca, seletor de clínica, papel ativo e links do menu. O seletor usa os vínculos do contexto e mostra carregamento, ausência de vínculos ou erro quando necessário.

Os links usam `NavLink` para destacar a rota ativa. No mobile, a sidebar desliza e tem uma sobreposição clicável para fechar; no desktop, permanece visível. Clicar num link também fecha o menu mobile. Os ícones vêm de Lucide React.

## 8. Módulo de autenticação: `src/features/auth/`

### `types/auth.ts`

Define os contratos:

- `ClinicRole`: `ADMIN`, `RECEPTIONIST` ou `OPHTHALMOLOGIST`.
- `AuthenticatedClinicRole`: associação entre uma clínica e um papel.
- `AuthenticatedUser`: ID, nome, e-mail, indicador de administrador do sistema e papéis nas clínicas.
- `AuthResponse`: access token, refresh token, tipo Bearer, validade e usuário.
- `LoginRequest`: e-mail e senha.
- `ChangePasswordRequest`: senha atual e nova senha.
- `MessageResponse`: resposta com uma mensagem textual.

### `api/auth-api.ts`

Agrupa quatro métodos sobre `httpClient`:

| Método           | Chamada                                        | Autenticação no cliente |
| ---------------- | ---------------------------------------------- | ----------------------- |
| `login`          | `POST /auth/login`                             | Desativada.             |
| `refresh`        | `POST /auth/refresh` com refresh token no JSON | Desativada.             |
| `logout`         | `POST /auth/logout`                            | Ativada por padrão.     |
| `changePassword` | `PATCH /auth/change-password`                  | Ativada por padrão.     |

O arquivo conhece endpoints e tipos. A decisão de armazenar ou limpar a sessão pertence a `AuthProvider`.

### `pages/LoginPage.tsx`

Combina apresentação responsiva com um formulário de e-mail e senha. Usa estados locais para mostrar/ocultar a senha, mensagem de erro e envio em andamento.

`handleSubmit` impede a submissão tradicional, lê `FormData`, remove espaços das pontas do e-mail e chama `login` do contexto. Após sucesso, navega para a URL originalmente solicitada, incluindo busca e fragmento, ou para `/`. Em falha, exibe a mensagem de `ApiError` ou uma mensagem alternativa. Também apresenta avisos recebidos pelo estado de navegação, como a confirmação de troca de senha.

A validação básica usa atributos HTML como `required` e `type="email"`. Este formulário não usa React Hook Form nem Zod.

### `pages/ChangePasswordPage.tsx`

Solicita senha atual, nova senha e confirmação. Usa `FormData`, verifica se a confirmação coincide e chama `changePassword`. Os campos da nova senha têm limites HTML de 8 a 255 caracteres. Em sucesso, solicita navegação para `/login` com aviso para entrar novamente. Em erro, mantém a tela e apresenta feedback. O botão Cancelar chama `navigate(-1)`.

O provider limpa a sessão local após sucesso. O encerramento de outras sessões mencionado na interface depende do comportamento do back-end.

### `routes/ProtectedRoute.tsx`

Consulta o status de autenticação. Sem sessão, redireciona para `/login` e guarda a localização atual em `state.from`. Com sessão, renderiza as rotas filhas por `Outlet`.

### `routes/PublicOnlyRoute.tsx`

Permite as rotas filhas quando não há sessão. Se o usuário já está autenticado, redireciona para `/`.

### `api/auth-api.test.ts`

Usa spies no cliente HTTP para verificar que login e refresh marcam as chamadas como públicas e que logout usa a chamada autenticada padrão. Não realiza login real contra um servidor.

## 9. Módulo de clínicas: `src/features/clinics/`

### `types/clinic.ts`

Define `ClinicSummary`, com ID, nome, documento e status da clínica, e `ClinicMembership`, com IDs do vínculo, clínica e usuário, papel, status, datas e resumo opcional da clínica.

### `api/clinics-api.ts`

Expõe `listUserMemberships(userId)`, que chama `GET /users/:userId/clinics`. A seleção da clínica e a filtragem dos resultados ficam fora deste arquivo.

### `lib/allowed-memberships.ts`

`getAllowedMemberships(user, memberships)` cria um mapa dos papéis devolvidos na autenticação. Mantém somente vínculos em que:

- O vínculo está ativo.
- O resumo da clínica existe e indica uma clínica ativa.
- O papel do vínculo coincide com o papel autenticado para aquela clínica.

`isSystemAdmin` não cria uma exceção nessa função. Um administrador global precisa de vínculo clínico permitido para acessar o contexto usado pelos pacientes.

### `lib/allowed-memberships.test.ts`

Verifica que o indicador de administrador global não concede uma clínica fora dos papéis autenticados e que vínculos inativos são removidos.

Este módulo é uma base para seleção e autorização contextual. A rota `/clinicas` ainda não fornece um cadastro ou painel de gestão de clínicas.

## 10. Módulo de pacientes: `src/features/patients/`

### `types/patient.ts`

Organiza os contratos em:

- **`PatientSex`:** valores de sexo aceitos.
- **`Patient`:** registro recebido, com identificação, clínica, dados pessoais, contato, endereço, status e datas de criação/alteração.
- **`PatientPayload`:** dados usados para criar ou editar. Não inclui ID, clínica, status ou datas de auditoria; muitos campos aceitam ausência ou `null`.
- **`PatientsQuery`:** página, limite, busca e filtro de ativos.
- **`PaginationMeta`:** total, página, limite e total de páginas.
- **`PatientsResponse`:** lista `data` mais metadados `meta`.

### `api/patients-api.ts`

`basePath(clinicId)` gera `/clinics/:clinicId/patients`, mantendo a clínica explícita nas chamadas.

| Método         | Operação                                                      |
| -------------- | ------------------------------------------------------------- |
| `list`         | GET na base, com `page`, `limit`, `search` e `active`.        |
| `findById`     | GET na base acrescida do ID do paciente.                      |
| `create`       | POST na base com `PatientPayload`.                            |
| `update`       | PATCH no recurso do paciente com `PatientPayload`.            |
| `updateActive` | PATCH em `/:patientId/active`, enviando somente `{ active }`. |

Não há método de exclusão de paciente neste arquivo. A gestão de status usa ativação e desativação.

### `hooks/use-patients.ts`

É a ligação entre endpoints e TanStack Query.

`patientKeys` padroniza as chaves de cache: todas incluem a clínica; listagens também incluem os filtros e detalhes incluem o paciente.

- `usePatients`: consulta a lista somente quando há clínica e usa `keepPreviousData` para manter os dados anteriores durante mudanças da consulta, como paginação.
- `usePatient`: busca um registro somente quando há clínica e ID do paciente.
- `useCreatePatient`: executa o cadastro; em sucesso, grava o detalhe no cache e invalida as listas da clínica.
- `useUpdatePatient`: atualiza o registro e sincroniza detalhe e listas da mesma forma.
- `useUpdatePatientStatus`: altera o status e repete a estratégia de atualização de cache.

Invalidar uma lista marca seus dados como desatualizados e permite nova consulta pelo TanStack Query. As páginas consomem o resultado desses hooks para decidir entre carregamento, erro e conteúdo.

### `lib/patient-permissions.ts`

Centraliza três regras simples:

| Papel              | Consultar | Cadastrar/editar | Ativar/desativar |
| ------------------ | --------- | ---------------- | ---------------- |
| `ADMIN`            | Sim       | Sim              | Sim              |
| `RECEPTIONIST`     | Sim       | Sim              | Não              |
| `OPHTHALMOLOGIST`  | Sim       | Não              | Não              |
| Sem papel (`null`) | Não       | Não              | Não              |

`canReadPatients` verifica se o papel não é nulo. `canWritePatients` permite ADMIN ou RECEPTIONIST. `canChangePatientStatus` permite somente ADMIN.

### `lib/patient-format.ts`

Contém quatro funções de apresentação:

- `formatCpf`: formata 11 dígitos como `000.000.000-00`; sem valor, retorna “Não informado”.
- `maskCpf`: aplica a máscara progressivamente durante a digitação e limita a entrada a 11 dígitos.
- `formatZipCode`: formata oito dígitos como `00000-000`; sem valor, informa a ausência.
- `formatDateOnly`: reorganiza `AAAA-MM-DD` para `DD/MM/AAAA` sem construir um objeto `Date`.

Formatação de exibição e validação são responsabilidades distintas: essas funções não substituem o schema.

### `lib/patient-schema.ts`

Concentra validação e conversão entre formulário e API:

1. **`isValidCpf`:** remove caracteres não numéricos, exige 11 dígitos, rejeita sequências repetidas e confere os dois dígitos verificadores.
2. **`isValidDateOnly`:** exige `AAAA-MM-DD`, verifica uma data real com `Date.UTC` e rejeita datas futuras usando a data UTC atual como referência.
3. **`optionalText`:** cria validação de texto com trim e tamanho máximo.
4. **`brazilianStates`:** conjunto de UFs aceitas.
5. **`patientSchema`:** define campos e regras: nome obrigatório de até 150 caracteres; CPF opcional válido; nascimento obrigatório válido; enum de sexo; contato, endereço e limites; e-mail, CEP e UF válidos quando preenchidos.
6. **`PatientFormValues`:** tipo inferido do schema.
7. **`patientToFormValues`:** transforma um paciente nos valores iniciais do formulário, substituindo campos ausentes por strings vazias e aplicando máscara ao CPF.
8. **`optional`:** transforma texto vazio em `null`.
9. **`toPatientPayload`:** remove espaços, deixa CPF e CEP com dígitos, converte e-mail para minúsculas, UF para maiúsculas e campos opcionais vazios para `null`.

Exemplo: CPF `529.982.247-25` é enviado como `52998224725`; UF `sp` vira `SP`; telefone vazio vira `null`.

### `components/PatientForm.tsx`

Formulário compartilhado entre cadastro e edição. Recebe paciente opcional, texto de submissão, destino de cancelamento e uma função assíncrona `onSubmit`.

Internamente:

- Define classes visuais comuns para campos, labels e erros.
- Usa o componente local `FieldError` para mensagens por campo.
- Inicializa `useForm` com `zodResolver(patientSchema)` e `patientToFormValues`.
- Divide a interface em dados pessoais, contato e endereço.
- Aplica a máscara de CPF no `onChange`, mantendo a integração com o campo registrado pelo React Hook Form.
- Após validação, converte os dados com `toPatientPayload` e chama a função recebida.
- Se a mensagem do servidor contém “cpf”, associa o erro ao campo CPF; nos demais casos, usa erro geral do formulário.
- Desabilita os campos e impede cancelamento durante o envio; altera o texto do botão para “Salvando...”.

O formulário usa `noValidate`: a validação de submissão é coordenada pelo schema. Há labels, mensagens com `role="alert"`, `aria-invalid`, `aria-describedby` e indicação de envio com `aria-busy`.

### `components/PatientStatusBadge.tsx`

Recebe apenas `active: boolean`. Exibe “Ativo” em verde ou “Inativo” em cinza. É compartilhado pela listagem e pelos detalhes.

### `components/PatientsUnavailable.tsx`

Mostra a indisponibilidade do módulo conforme o contexto: carregamento de clínicas, erro de consulta, necessidade de selecionar uma entre várias clínicas ou ausência de vínculo permitido. Não realiza nova consulta diretamente; lê `useClinic`.

### `pages/PatientsPage.tsx`

O componente externo exige clínica e papel para consultar pacientes. Sem esse contexto, mostra `PatientsUnavailable`.

O componente interno `PatientsContent` recebe clínica e papel. Sua `key` é o ID da clínica, o que reinicia filtros e paginação quando a clínica muda.

Estados locais:

- `draftSearch`: texto ainda sendo digitado.
- `search`: busca efetivamente aplicada ao enviar o formulário.
- `activeFilter`: ativos, inativos ou todos; começa em ativos.
- `page`: página atual; começa em 1.

A consulta pede 20 registros por página. Submeter a busca ou mudar o filtro reinicia a página. Não existe busca a cada tecla nem debounce: o texto entra na consulta ao submeter o formulário.

A tela oferece botão de cadastro conforme a permissão, aviso de sucesso vindo da navegação, carregamento, erro com nova tentativa e estado vazio. Exibe cartões no mobile e tabela a partir do breakpoint `md`. A paginação usa os metadados da API e bloqueia os botões durante uma consulta em andamento.

### `pages/CreatePatientPage.tsx`

Exige clínica ativa e permissão de escrita; sem permissão, redireciona para `/pacientes`. O componente interno `CreatePatientContent` liga `PatientForm` à mutation `useCreatePatient`. Após sucesso, navega para os detalhes do novo registro com aviso de cadastro concluído e substitui a entrada atual do histórico.

### `pages/EditPatientPage.tsx`

Lê `patientId` da URL e consulta o paciente com `usePatient`. Verifica clínica, papel de escrita e existência do parâmetro. Apresenta carregamento ou uma mensagem genérica caso não consiga obter dados.

`EditPatientContent` inicializa o formulário com o registro recebido e usa `useUpdatePatient`. Ao salvar, navega para os detalhes com aviso de atualização. O tipo da propriedade `patient` é derivado do retorno de `usePatient`, removendo a possibilidade de ausência com `NonNullable`.

### `pages/PatientDetailsPage.tsx`

Lê paciente e contexto clínico; verifica possibilidade de consulta e trata carregamento, erro e ausência do registro.

- `sexLabels` converte valores do contrato em rótulos em português.
- O componente local `Detail` apresenta pares de label e valor, com alternativa “Não informado”.
- Monta linhas de endereço com os campos disponíveis.
- Mostra status e dados cadastrais formatados.
- Exibe edição para ADMIN e RECEPTIONIST.
- Exibe ativação/desativação somente para ADMIN, com `window.confirm` antes da mutation.
- Apresenta erro da alteração de status e aviso recebido após cadastro ou edição.
- Reserva uma seção para histórico clínico, ainda sem integração de atendimentos.

### Arquivos de teste de pacientes

| Arquivo                           | O que verifica                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/patients-api.test.ts`        | Clínica no caminho da listagem, filtros enviados e endpoint PATCH específico de status. Usa spies; não chama servidor real.                                 |
| `lib/patient-format.test.ts`      | Máscara progressiva de CPF, colagem de CPF formatado e limite de 11 dígitos. As outras funções de formatação não são diretamente cobertas por este arquivo. |
| `lib/patient-permissions.test.ts` | Leitura pelos três papéis, escrita restrita, alteração de status por ADMIN e ausência de acesso de leitura com papel nulo.                                  |
| `lib/patient-schema.test.ts`      | Validação e normalização de um cadastro, rejeição de CPF inválido e nascimento futuro. Não testa isoladamente cada regra do schema.                         |

## 11. Páginas gerais

### `src/pages/DashboardPage.tsx`

Declara uma lista local `shortcuts` com três atalhos: pacientes, agendamentos e calendário. Usa essa lista para montar cartões com título, descrição, ícone e link. A seção de próximos atendimentos mostra que a agenda ainda não está integrada. Não consulta indicadores nem atendimentos na API.

### `src/pages/ModulePage.tsx`

Recebe `title` e monta uma tela genérica com “Módulo em desenvolvimento” e “Em breve”. É reutilizada pelas rotas ainda sem implementação própria.

## 12. Estilos, imagens e tipos do ambiente

| Arquivo                | Papel atual                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`        | Importa Tailwind, define o tema de cores com `@theme`, aplica `box-sizing`, remove a margem do body, configura fonte e cores gerais e dá altura mínima ao elemento raiz. É importado em `main.tsx`. |
| `src/App.css`          | Contém apenas um comentário sobre estilos globais de componentes. Não possui regras CSS e não está importado no código atual.                                                                       |
| `src/assets/hero.png`  | Imagem disponível no repositório, sem referência encontrada no código atual de `src`.                                                                                                               |
| `src/assets/react.svg` | Asset da marca React, sem referência encontrada no código atual.                                                                                                                                    |
| `src/assets/vite.svg`  | Asset da marca Vite, sem referência encontrada no código atual.                                                                                                                                     |
| `public/favicon.svg`   | Ícone referenciado diretamente por `index.html` em `/favicon.svg`.                                                                                                                                  |
| `public/icons.svg`     | Sprite SVG com símbolos de ícones. Não há referência encontrada no código atual; os componentes usam Lucide React.                                                                                  |
| `src/vite-env.d.ts`    | Inclui os tipos de cliente do Vite e declara `VITE_API_URL` como variável opcional acessível por `import.meta.env`. Também estende `ImportMeta`.                                                    |

Arquivos em `public` são servidos por caminhos diretos. Arquivos em `src/assets` podem ser importados pelos componentes e processados pelo Vite. A aparência atual está principalmente nas classes Tailwind dos componentes, com as cores compartilhadas definidas em `index.css`.

## 13. Teste compartilhado de infraestrutura

### `src/api/http-client.test.ts`

Cria respostas JSON de teste com `jsonResponse`, injeta um `fetcher` simulado e restaura mocks após cada teste. Verifica:

- Montagem da URL, query string, corpo JSON e header Bearer.
- Conversão das mensagens de validação da API em erro padronizado.
- Uso de mensagens genéricas para respostas `5xx`.
- Conversão de falhas de conexão em `NETWORK_ERROR`.
- Compartilhamento de um refresh entre requisições concorrentes e repetição das chamadas originais após renovação.

O arquivo exercita indiretamente partes de `api-error.ts`. Não há um arquivo separado `api-error.test.ts` no inventário atual.

Os testes encontrados se concentram em funções e contratos de chamadas. Não há testes de renderização de componentes nem testes completos no navegador no conjunto analisado.

## 14. Como as partes se conectam

### Fluxo de abertura e login

```text
index.html → main.tsx → providers → App.tsx
                                      ↓
                               ProtectedRoute
                                      ↓ sem sessão
                                  LoginPage
                                      ↓
                         useAuth → AuthProvider
                                      ↓
                           authApi → httpClient
                                      ↓
                                    API
                                      ↓
                   sessão em memória → rota protegida
```

Ao existir usuário, `ClinicProvider` consulta os vínculos. Um único vínculo permitido ativa a clínica automaticamente; mais de um exige escolha na sidebar.

### Fluxo de listagem de pacientes

```text
PatientsPage
  → useClinic: clínica e papel
  → estados de busca, filtro e página
  → usePatients: consulta e cache
  → patientsApi.list: endpoint de pacientes da clínica
  → httpClient: URL, token, fetch e tratamento de erro
  → resposta da API
  → cartões/tabela e paginação
```

### Fluxo de cadastro ou edição

```text
CreatePatientPage / EditPatientPage
  → PatientForm
  → patientSchema: validação
  → toPatientPayload: normalização
  → mutation de use-patients
  → patientsApi → httpClient → API
  → atualiza detalhe em cache e invalida listas
  → navega para PatientDetailsPage com aviso
```

### Fluxo de sessão expirada

```text
requisição autenticada recebe 401
  → httpClient pede renovação
  → AuthProvider usa authApi.refresh
  → sucesso: atualiza sessão e repete a requisição uma vez
  → falha: limpa sessão e cache
  → ProtectedRoute encaminha para login
```

### Onde cada estado fica

| Estado                                 | Local                                |
| -------------------------------------- | ------------------------------------ |
| Usuário, access token e refresh token  | `AuthProvider`, em memória.          |
| Seleção de clínica                     | `ClinicProvider`, em memória.        |
| Vínculos e pacientes carregados        | Cache do TanStack Query, em memória. |
| Busca, filtro e página da listagem     | Estados locais de `PatientsContent`. |
| Campos e erros de pacientes            | React Hook Form em `PatientForm`.    |
| Menu mobile aberto/fechado             | Estado local de `AppLayout`.         |
| Visibilidade da senha e envio do login | Estados locais de `LoginPage`.       |
| Identificador do paciente              | Parâmetro da URL.                    |
| Destino original e avisos de navegação | Estado do React Router.              |

## 15. Situação funcional e pontos de atenção

| Parte                                                         | Situação observada no código                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Login, refresh, logout e troca de senha                       | Chamadas à API implementadas.                                                                   |
| Vínculos e seleção de clínica                                 | Implementados, com filtragem por clínica ativa e papel autenticado.                             |
| Pacientes                                                     | Consultas e alterações integradas no código, com regras por papel e cache por clínica.          |
| Dashboard                                                     | Atalhos implementados; agenda sem integração.                                                   |
| Histórico clínico do paciente                                 | Área informativa aguardando integração.                                                         |
| Agendamentos, calendário, profissionais, prontuários e exames | Rotas com tela genérica.                                                                        |
| Gestão de clínicas e usuários                                 | Rotas com tela genérica; a consulta de vínculos já existe separadamente.                        |
| Persistência de sessão                                        | Ausente; recarregar exige novo login.                                                           |
| Menu por papel                                                | Não implementado em `navigationItems`/`Sidebar`; as ações de pacientes possuem regras próprias. |
| Documentação inicial                                          | README ainda baseado no template; progresso registrado em arquivo separado.                     |
| Metadados HTML                                                | Idioma e título ainda genéricos.                                                                |

O isolamento no front-end combina clínica nas URLs, clínica nas chaves de cache, filtro de vínculos e limpeza de consultas na troca de contexto. Essas medidas organizam a interface e os dados locais. A autorização do acesso aos registros no servidor é responsabilidade do back-end e não foi auditada neste relatório.

## 16. Roteiro de leitura para entender o projeto

1. `main.tsx`: veja como providers e aplicação são montados.
2. `App.tsx` e `app/navigation.ts`: entenda rotas e menu.
3. `AuthProvider.tsx` e `ClinicProvider.tsx`: entenda a sessão e a clínica ativa.
4. `api/http-client.ts` e `api/api-error.ts`: veja como as chamadas e as falhas são padronizadas.
5. `features/patients/pages/PatientsPage.tsx`: acompanhe uma tela completa.
6. `features/patients/hooks/use-patients.ts` e `api/patients-api.ts`: acompanhe o caminho até a API e o cache.
7. `PatientForm.tsx` e `patient-schema.ts`: entenda o preenchimento, a validação e o envio.
8. Arquivos `.test.ts`: consulte exemplos executáveis das regras e contratos cobertos.

Para localizar uma mudança: rotas ficam em `App.tsx`; links do menu em `navigation.ts`; aparência compartilhada em `components/layout` e `index.css`; chamadas de negócio na `api` da feature; regras de formulário e permissões na `lib` da feature; e dados carregados pelos hooks.
