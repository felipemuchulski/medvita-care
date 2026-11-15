# MedVita Care — uma Web App com React e NestJS

Implementação e validação local em 15/11/2026. Nenhuma conexão ao Supabase, migration, alteração de dados, git push ou deploy foi executado. Os deploys existentes não foram acessados, removidos ou reconfigurados.

## Auditoria e decisão

| Área | Estado encontrado e tratamento |
|---|---|
| Raiz | Havia lockfile npm vazio e nenhum package.json. Adicionados scripts de coordenação; não foram criados workspaces nem hoisting, pois API e web usam versões distintas de TypeScript e ferramentas. |
| API | NestJS 12, CommonJS, build `nest build`, entrada `api/dist/main.js`, execução separada `npm --prefix api run start:prod`. Defaults legados preservados. |
| Web | React/TypeScript/Vite, `tsc -b && vite build`, saída `web/dist`. `createBrowserRouter`/RouterProvider e rotas em `src/App.tsx` preservados. |
| Vite | Base `/`, proxy de desenvolvimento `/api` para a API sem prefixo, removendo `/api`. Nenhuma mudança na configuração local. |
| HTTP | Um único cliente Fetch em `web/src/api/http-client.ts`; VITE_API_URL ou `/api`. Build da raiz força VITE_API_URL=/api somente no processo do Vite unificado; não edita .env nem o build separado da web. |
| Nest CLI | `deleteOutDir:true`, assets de certificados e watchAssets já configurados. O empacotamento também copia explicitamente a CA pública para o caminho esperado. |
| TLS | DataSource/connectionOptions existentes, CA com validação de cadeia e hostname. Caminho relativo resolve a raiz da API, também no artefato. Não há alteração em TLS ou DataSource. |
| Auth | Access token em memória; refresh em cookie HttpOnly, SameSite=Strict, Secure em produção, path `/`. Chamadas de autenticação usam credentials:include e X-Medvita-Session. Nenhum contrato JWT/cookie alterado. |
| CORS | Modo separado mantém exigência de FRONTEND_URL e opções existentes. No unificado, FRONTEND_URL é opcional por ser mesma origem; se fornecida, continua sendo a origem exata permitida, sem wildcard com credenciais. |
| Clínica e RBAC | Contextos, seleção de clínica, guards, services e papéis preservados. Servir index.html é público; dados continuam atrás dos endpoints autenticados. |

### Avaliação de @nestjs/serve-static

A linha 12 acompanha NestJS 12, mas passou a ser ESM e documenta ajustes para projetos CommonJS. Instalar essa dependência não era necessário para a aplicação atual. Foi usado `NestExpressApplication.useStaticAssets`, disponível no adaptador Express já instalado, junto de middleware explícito para fallback. Nenhuma dependência de API/web foi atualizada ou adicionada. [Releases oficiais de serve-static](https://github.com/nestjs/serve-static/releases).

### Contratos da API

Nenhum decorator de controller foi alterado. Hoje a API separada possui estes grupos, sem prefixo global:

| Controller/domínio | Caminho legado | Caminho no novo modo unificado |
|---|---|---|
| Autenticação | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password` | `/api/auth/...` |
| Usuários | `/users`, `/users/:id`, status/senha e `/users/:userId/clinics` | `/api/users/...` |
| Clínicas | `/clinics`, documento, detalhes/status | `/api/clinics/...` |
| Equipe | `/clinics/:clinicId/users`, papel/status | `/api/clinics/:clinicId/users/...` |
| Profissionais | `/clinics/:clinicId/professionals`, usuário/CRM/detalhes | `/api/clinics/:clinicId/professionals/...` |
| Pacientes | `/clinics/:clinicId/patients`, detalhes/status | `/api/clinics/:clinicId/patients/...` |
| Agendamentos | `/clinics/:clinicId/appointments`, disponibilidade, reagendamento/cancelamento | `/api/clinics/:clinicId/appointments/...` |
| Prontuários | `/clinics/:clinicId/encounters`, detalhes/transições e `/clinics/:clinicId/patients/:patientId/encounters` | Os mesmos caminhos sob `/api` |
| Exames | `/clinics/:clinicId/exams`, catálogo/detalhes/transições | Os mesmos caminhos sob `/api` |
| Auditoria | `/clinics/:clinicId/audit-logs` | `/api/clinics/:clinicId/audit-logs` |

Todos os métodos GET/POST/PATCH existentes são preservados. O prefixo novo é opt-in no modo unificado, usando `setGlobalPrefix('api')`. O launcher gerado liga esse modo; **não configure MEDVITA_UNIFIED=true na API separada enquanto houver consumidores dos caminhos antigos**. Não existem aliases silenciosos para os caminhos antigos no novo domínio. Integrações externas que migrarem para a nova origem devem adotar `/api`; os dois endereços publicados atuais não são modificados.

## Estrutura e build

```text
medvita-care/
  package.json / package-lock.json   # coordenação npm, sem novas dependências
  server.cjs                        # entrada do processo Node
  scripts/
    build-unified.mjs
    start-unified.cjs                # copiado como launcher do artefato
    test-unified.cjs
  api/                              # continua utilizável separadamente
    src/main.ts
    src/configure-app.ts
    certificates/prod-ca-2021.crt
  web/                              # continua utilizável separadamente
  deploy/                           # gerado e ignorado pelo Git
    server.cjs
    start.cjs
    build-manifest.json
    public/                         # React index.html, assets, favicon/ícones
    api/
      package.json / package-lock.json
      certificates/prod-ca-2021.crt
      dist/main.js                  # entrada Nest compilada
      dist/configure-app.js
      dist/...                      # módulos, entidades e migrations compiladas
      node_modules/                 # dependências de produção da API
```

Na raiz:

```bash
npm ci
npm run build
```

O build executa `npm ci --include=dev` separadamente em api e web, usando os lockfiles existentes; compila React com URL relativa `/api`; compila Nest; monta `deploy`; instala dependências de produção em `deploy/api` com o lockfile da API. A instalação ocorre na plataforma onde o build roda, incluindo o runtime nativo do bcrypt. Não envie node_modules compilado no Mac como substituto de um build Linux da Hostinger.

As cópias são por lista explícita: não copia `.env`, fontes inteiros ou diretórios arbitrários. O build recusa arquivos `.env*` no artefato, verifica entradas obrigatórias e CA, e gera manifesto com checksums dos lockfiles e certificado. O diretório público não pode conter `api`, namespace reservado ao backend.

O `.htaccess` da web separada permanece nos fontes/build separado; é retirado somente de `deploy/public`. No unificado, a Hostinger deve encaminhar a requisição ao Node e o próprio Nest aplica o fallback. Não sobreponha as regras de encaminhamento gerenciadas da Web App Node com o arquivo de hospedagem estática.

Alternativa de desenvolvimento com dependências já instaladas: `npm run build:local`. Ela evita reinstalar api/web, mas o artefato continua recebendo uma instalação de produção por npm ci. Para reprodução e deploy use o build normal.

## Execução e fallback

```bash
npm start
```

O comando roda `server.cjs`, que carrega `deploy/start.cjs`, que inicializa `deploy/api/dist/main.js` no **mesmo processo Node**. O launcher configura modo unificado, diretório público absoluto, NODE_ENV=production se ausente e caminho padrão absoluto da CA se DB_SSL_CA_PATH não foi informado. Não inicia Vite nem um segundo servidor. Porta continua sendo `PORT` fornecida pelo ambiente, ou 3000.

`server.cjs` também existe dentro de `deploy`, de modo que a mesma entrada funciona quando o provedor executa a raiz do projeto ou publica o output como raiz. Diretórios da SPA e CA são resolvidos pelo launcher a partir do artefato, sem depender do diretório atual do shell.

Servir a SPA:

- Arquivos estáticos reais são entregues pelo adaptador Express.
- GET/HEAD que aceitam HTML recebem index.html quando não são API, assets, caminho com extensão ou segmento oculto. A URL/query não é redirecionada.
- `/api` e `/api/...`, incluindo caminhos inexistentes, não entram no fallback; o Nest responde 404 JSON para endpoint inexistente.
- Assets ausentes não recebem o index da SPA; POST/PATCH/DELETE não são transformados em navegação.
- Caminhos do backend, `.env` e certificado fora de `public` não ficam publicados como arquivos.
- Sem index.html, ou com namespace público reservado, a inicialização unificada falha, em vez de mascarar um build incompleto.

O modo separado (`cd api`, scripts usuais, sem flag unificada) não registra prefixo ou arquivos da SPA. A exigência anterior de FRONTEND_URL e os caminhos originais continuam funcionando.

Para desenvolvimento habitual, mantenha dois processos como antes: `npm --prefix api run start:dev` e `npm --prefix web run dev`. O proxy Vite continua removendo `/api` para falar com a API legada. Para desenvolvimento do servidor unificado, use o build e o Node; não aponte o proxy que remove prefixo para uma API já prefixada sem ajustar sua configuração conscientemente.

## Hostinger — nova configuração, sem tocar nas atuais

Prepare uma Web App de homologação separada, com domínio temporário, ligada ao mesmo repositório e à branch da mudança. A Hostinger documenta escolha de root, comandos e entry por app de um monorepo. [Monorepos na Hostinger](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/).

Em Build and output settings:

| Campo | Valor |
|---|---|
| Framework preset | **Other**, como aplicação Node com entrada própria; não Vite estático |
| Root directory | Raiz do repositório (`.`), contendo api e web |
| Node version | **24.x** |
| Package manager | npm |
| Build command | `npm run build` |
| Output directory | `deploy` |
| Entry file | `server.cjs` |

A Hostinger disponibiliza Other com build/output/entry configuráveis e Node 24. O painel efetivo não foi acessado nem alterado. [Configurações oficiais da Web App](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

Se não houver vaga temporária para uma terceira Web App, será necessário planejar capacidade ou homologação alternativa antes do corte; não remova um dos dois deploys atuais para testar esta mudança. Após validação publicada e aceite explícito, planeje o domínio definitivo, o corte dos consumidores e só então a retirada dos apps antigos. Nenhuma dessas ações foi executada.

### Ambiente da Web App unificada

Forneça no painel, sem versionar valores reais:

- `NODE_ENV=production`.
- `DATABASE_URL`: conexão existente ao Supabase (ou as DB_* já suportadas).
- `DB_SSL_CA_PATH=certificates/prod-ca-2021.crt`, relativo à raiz da API no artefato; se omitido, o launcher usa a CA empacotada. Caminhos absolutos de uma máquina/deploy antigo não devem ser reaproveitados sem verificar a existência.
- `JWT_SECRET` e `JWT_REFRESH_SECRET`: preservar a política existente, distintos em produção.
- Preservar `JWT_TOKEN_ISSUER`, `JWT_TOKEN_AUDIENCE` e TTLs existentes.
- `FRONTEND_URL`: opcional para mesma origem; se necessário CORS, use a origem exata autorizada. Não usar wildcard com cookies.
- `PORT`: respeitar a fornecida pela Hostinger; não fixar outra porta no painel sem necessidade.

VITE_API_URL é fixado em `/api` pelo build unificado; não depende do endereço antigo do backend. MEDVITA_UNIFIED/MEDVITA_WEB_ROOT são controlados pelo launcher. Não copie as autorizações/senhas do bootstrap para o ambiente permanente da nova aplicação. Nenhum `.env` é empacotado ou lido da árvore de fontes pelo artefato.

`npm start` **inicializa o TypeORM e conecta ao banco configurado**, embora não rode migrations/synchronize. Por isso não foi executado contra o ambiente real nesta etapa; os testes abaixo sobem o servidor compilado com módulos de teste e estado em memória. A primeira inicialização integral do AppModule com Supabase permanece pendente de homologação autorizada.

## Testes e resultados

Comandos executados:

```bash
npm run build
npm run lint
npm run test:unified
npm --prefix web run test -- --passWithNoTests
```

- Build completo por lockfiles aprovado: API e React compilados e runtime instalado. Lockfiles/versões de api e web não alterados. Manifesto, index, entrada, CA e dependências de produção presentes; CA conferida por checksum; nenhum `.env*` no artefato.
- Lint de API/web aprovado.
- Servidor HTTP real do artefato, em loopback: `/`, `/login`, `/pacientes`, `/agendamentos`, subrota, query e rota desconhecida retornam index; HEAD também funciona. JS/CSS/fontes/favicon funcionam; assets ausentes e caminhos ocultos não recebem a SPA.
- `/api` e endpoints desconhecidos retornam 404 JSON mesmo com Accept HTML. Caminho POST antigo `/auth/login` não vira alias no unificado.
- AuthController/AuthService/JwtStrategy/guards compilados e bcrypt reais foram exercitados com repositórios de sessão/usuário em memória: login, cookie HttpOnly/Secure/SameSite Strict, refresh, autorização global, logout, troca de senha e revogação. Nenhum token/senha foi impresso.
- Modo legado também exercitado: auth sem prefixo, ausência de SPA no backend, guards e sessão preservados.
- A suíte substitui inicialização TypeORM por falha explícita e não importa AppModule para servir os fixtures. Isso confirma infraestrutura HTTP/auth, não homologa SQL, persistência real, todas as operações de negócio ou renderização no navegador.
- Vitest encontrou zero suítes; a saída passWithNoTests não equivale a testes unitários do frontend aprovados.
- O teste existente `api/test/system-admin-bootstrap.test.cjs` **não foi executado nesta tarefa**, pois cria PostgreSQL temporário e executa migrations, vedadas pelo escopo atual. Não foi removido ou alterado.
- Validação local realizada em Node 26.13.0; o runtime Hostinger 24.x indicado deve passar pelo smoke de homologação. O teste local abriu somente loopback mediante permissão do ambiente.

Não houve acesso ao PostgreSQL, execução de migrations/seed/bootstrap, alteração de dados, push ou deploy. Build instala pacotes do registro npm, não inicia o backend.

## Homologação e retorno

1. Mantenha os apps antigos e suas variáveis/origens intactos. Confira previamente as configurações de root por app; não altere a API antiga para raiz do monorepo.
2. Após uma publicação manual autorizada na nova Web App, confira o commit e logs. A raiz deve servir React; abra diretamente `/login`, `/pacientes` e `/agendamentos` e use F5.
3. Verifique no Network que o frontend usa `/api/...` na nova origem e que `/api/nao-existe` retorna JSON/404, não index. Confirme assets e ausência de erro MIME.
4. Faça login na nova origem, recarregue, troque de clínica e confirme papéis/isolamento; verifique refresh e logout. Sessões/cookies dos domínios antigos não são transferidos automaticamente: novo login é esperado.
5. Homologue operações reais somente com autorização e dados de teste. Esta etapa não autoriza alterações no banco.
6. Só depois de aceite planeje domínio final e retirada dos deploys anteriores. Se houver falha, mantenha o tráfego nos endereços antigos; não reverta banco ou migrations, pois esta mudança não os alterou.

Não é necessário migrar schema para unificar a entrega HTTP. Endpoints públicos externos devem ser atualizados conscientemente para o prefixo novo quando o consumidor mudar de origem. O frontend existente e o novo não devem compartilhar configurações de VITE_API_URL indevidamente.

## Arquivos modificados/criados

- `package.json` e `package-lock.json` da raiz: coordenação npm e comandos.
- `.gitignore`: artefato e arquivos privados fora do Git.
- `server.cjs`: entrada única e portátil.
- `scripts/build-unified.mjs`: build/empacotamento por lockfiles.
- `scripts/start-unified.cjs`: inicialização do artefato e caminhos fixos.
- `scripts/test-unified.cjs`: testes sem banco sobre o compilado.
- `api/src/main.ts`: bootstrap exportado e configuração delegada; execução direta preservada.
- `api/src/configure-app.ts`: CORS/validação existentes e modo unificado opt-in.
- `UNIFIED_DEPLOY.md` e `README.md`: relatório e descoberta dos comandos.

Entidades, migrations, services, guards, contratos JWT, TLS/DataSource, certificados-fonte e fontes/componentes do React foram preservados. Nenhuma alteração remota foi feita.
