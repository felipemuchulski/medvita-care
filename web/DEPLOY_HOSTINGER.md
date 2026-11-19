# Roteamento SPA na Hostinger

## Falha ao baixar uma página após publicação

`Failed to fetch dynamically imported module` indica que o navegador não conseguiu baixar um módulo de página. Uma aba antiga pode ainda pedir um arquivo com hash de um build anterior; publicação incompleta, indisponibilidade de rede e resposta com tipo incorreto também precisam ser verificados na aba Network.

O HTML agora recebe `Cache-Control: no-cache` no `.htaccess` estático e no servidor unificado, inclusive em `/index.html`. A interface oferece um botão para recarregar a mesma URL quando ocorre erro de carregamento. O recarregamento depende do usuário, evitando ciclos automáticos em falhas persistentes.

Publique `index.html` e todos os arquivos de `assets/` do mesmo build, preferencialmente com troca atômica de diretório. Preserve assets da versão anterior durante a transição para atender abas já abertas. Se houver CDN, invalide o HTML antigo. Não renomeie chunks manualmente.

Após publicar, confira `Cache-Control` no documento e que a URL do módulo solicitada pelo navegador responde 200 com JavaScript. Se recarregar não resolver, verifique o status e o Content-Type do arquivo que falhou. A tela de recuperação não substitui um arquivo ausente no servidor.

Análise e implementação em 15/11/2026. Correção preparada e testada localmente, sem deploy, alteração no NestJS ou acesso ao Supabase.

## Diagnóstico

O sintoma relatado é compatível com ausência de fallback no servidor que entrega o frontend: navegação interna roda no navegador; F5 e abertura direta solicitam a URL ao servidor. Sem um arquivo físico ou rewrite, a hospedagem responde 404 antes de carregar React.

Auditoria do repositório:

| Arquivo | Resultado |
|---|---|
| `package.json` | `build` executa `tsc -b && vite build`, produzindo frontend estático. `dev` e `preview` são comandos do Vite; não há servidor Node de produção, script start ou dependência Express no frontend. |
| `vite.config.ts` | Plugins React/Tailwind; diretório de saída padrão `dist`; base padrão `/`. Proxy `/api` configurado em `server.proxy` somente para desenvolvimento. |
| `index.html` | Documento inicial com `#root`, entrada `src/main.tsx` e favicon absoluto na raiz. O build gera referências `/assets/...`. |
| `src/main.tsx` | Usa `createBrowserRouter` com RouterProvider: navegação por histórico, equivalente à modalidade BrowserRouter, sem hash. |
| `src/App.tsx` | Rotas `/login`, `/pacientes`, `/agendamentos` e subrotas, proteção de sessão e fallback da aplicação já existem. Nenhuma alteração foi necessária. |
| `src/api/http-client.ts` | Mantém `VITE_API_URL` e fallback `/api`. Não alterado. |
| Configurações de deploy | Antes da correção não havia `.htaccess`, `_redirects`, `vercel.json`, `netlify.toml`, servidor HTTP do frontend, Dockerfile ou workflow de deploy versionado para essa finalidade. Configuração efetiva do painel não está no repositório e não foi acessada. |

## Estratégia escolhida e evidências

O projeto é uma SPA estática Vite. A Hostinger documenta que o deploy React utiliza `.htaccess` para fallback e recomenda redeploy para regenerar regras quando houver 404 em refresh. Isso foi confirmado na documentação oficial, não presumido a partir do nome “Node.js Web App”. [Guia oficial de React](https://www.hostinger.com/ca/tutorials/?p=145986).

Foi criado `public/.htaccess`. O Vite copia `public` para a raiz de `dist`, preservando o nome e conteúdo; isso também foi confirmado no build local. Assim, a regra pode acompanhar cada deploy via GitHub, sem depender de edição manual de um build antigo. [Diretório public do Vite](https://vite.dev/guide/assets.html#the-public-directory).

Não foram criados arquivos de redirect de outros provedores nem servidor Node adicional. A aplicação continua com URLs por histórico. O arquivo é destinado à entrega **estática** deste frontend, não ao `.htaccess` de encaminhamento gerenciado da API NestJS ou de outro app Node.

## Comportamento da regra

- `/api` e `/api/...` não são reescritos, independentemente de método ou Accept.
- Arquivos e diretórios existentes mantêm o tratamento normal.
- Arquivos ausentes em `/assets` e caminhos com extensão continuam sem fallback; JS/CSS/fontes ausentes não recebem HTML com status 200.
- Somente GET/HEAD com `Accept` contendo `text/html` recebem `/index.html` quando não há arquivo/diretório correspondente.
- A substituição é interna: não há redirect HTTP nem mudança de URL; query string é preservada.
- Rotas desconhecidas de navegação chegam ao React, que mantém o comportamento de `src/App.tsx`.
- Requisições JSON, POST, PATCH, DELETE e OPTIONS ficam sob o tratamento normal do servidor. OPTIONS pode retornar 200 nativamente, mas não recebe o documento SPA por essa regra.

Essa regra não cria um proxy para a API. Se já houver regra de proxy na mesma origem, ela deve permanecer antes do fallback. API em outra origem, conforme o `VITE_API_URL` já configurado, não passa pelo servidor estático do frontend. Não modifique VITE_API_URL para resolver esse 404 de documento.

O arquivo atende a publicação na raiz do domínio/subdomínio, conforme os caminhos atuais. Não prepara uma implantação em subdiretório; nesse caso, seria necessário alinhar base, router e rewrite em tarefa própria. Nenhuma rota atual usa sufixo de arquivo; uma rota futura contendo extensão exigirá revisão da exclusão de assets.

## Ajustes no painel e deploy

No painel da **Web App do frontend**, abra **Settings & Redeploy** e revise **Build and output settings**:

| Campo | Valor para este repositório |
|---|---|
| Framework preset | Vite (frontend estático) |
| Root directory | `web` |
| Branch | A branch que receber a correção no GitHub |
| Package manager | npm |
| Build command | `npm run build` |
| Output directory | `dist`, relativo a `web` |
| Entry file / servidor Node | Não adicionar para este frontend estático |
| Environment Variables | Preservar VITE_API_URL e as demais configurações existentes |

Esses campos e a distinção entre frontend estático e servidor Node são documentados pela Hostinger. Não foi identificada opção documentada de “SPA mode” ou suporte genérico a `_redirects`; nenhuma foi presumida. [Configurações oficiais da Web App](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

Procedimento:

1. Versione `public/.htaccess` e esta documentação; envie à branch conectada ao GitHub. Não versione `dist` ou arquivos `.env`.
2. Faça o redeploy da Web App do frontend e confira o commit e o sucesso em Deployments.
3. No File Manager, localize o diretório estático ativo contendo `index.html`, `assets` e `.htaccess`. A documentação indica `hbuilds/current/public_html` nas implantações estáticas com estrutura atual; instalações antigas podem ter organização diferente. Use o diretório ativo, não uma versão antiga.
4. Não altere o arquivo de encaminhamento da Web App da API. Se o frontend estiver configurado como servidor Node/Other, reveja o preset para Vite: regras de diretório estático não corrigem rotas interceptadas por um processo Node.
5. Se o provedor substituir a regra copiada por uma gerada, confira se a regra efetiva contém fallback SPA. Faça o redeploy para regeneração e, persistindo a falha, contate o suporte da Hostinger com domínio, commit e URLs afetadas. A aplicação não pode obrigar um servidor que ignora o arquivo a executá-lo. Não sobrescreva regras de proxy gerenciadas.

Arquivos de build gerenciados podem ser substituídos a cada deploy; correção exclusivamente manual pelo File Manager não é permanente. A versão mantida neste repositório é a origem da regra. Não houve acesso ao painel ou confirmação de qual preset está configurado hoje.

## Build e verificações realizadas

```bash
cd web
npm run build
```

Resultado: TypeScript e Vite 8.3.5 aprovados, 2333 módulos transformados, `dist/index.html`, assets e `dist/.htaccess` gerados. Comparação byte a byte confirmou que `.htaccess` foi copiado de `public` sem alterações. Nenhuma dependência ou script npm foi adicionado.

Teste temporário em Apache 2.4.67 local, servindo uma cópia do build com `.htaccess` habilitado:

| Cenário | Resultado |
|---|---|
| GET HTML em `/`, `/login`, `/pacientes`, `/agendamentos`, subrota de edição, URL com query e rota desconhecida | 200, corpo igual ao index.html, sem Location/redirect |
| HEAD em `/login` com Accept HTML | 200 |
| `/api`, `/api/auth/refresh`, `/api/patients.json` | Sem fallback; 404 nativo no servidor local sem API |
| JS/CSS/SVG ausentes e asset ausente | 404, sem corpo do index.html |
| JSON GET, POST e OPTIONS em rota de tela | Sem corpo da SPA; resposta normal do servidor |
| JS, CSS, WOFF2, favicon e ícones existentes | Conteúdo original e tipos não HTML preservados |

O servidor de teste foi encerrado. O teste confirma a regra em um servidor compatível, não equivale a verificar a configuração efetiva da Hostinger. `vite preview` sozinho não validaria `.htaccess`, por isso não foi usado como prova do rewrite. Não houve execução de JavaScript no navegador, chamadas autenticadas à API ou nova homologação de login.

## Validação após deploy

Abra diretamente e atualize com F5: `/login`, `/pacientes`, `/agendamentos` e uma subrota real. Sem sessão, páginas protegidas devem carregar o aplicativo e encaminhar ao login; com sessão, devem recuperar a sessão normalmente. Um 401 do endpoint de refresh não é o mesmo problema que o 404 do documento na Hostinger.

Na aba Network, verifique que a requisição **Document** recebeu 200 e HTML da aplicação; assets existentes têm conteúdo JS/CSS adequado. As requisições da API continuam indo ao endereço anterior e retornando respostas da API, nunca o index.html do frontend.

Teste HTTP sem depender de sessão, substituindo o domínio:

```bash
curl -I -H 'Accept: text/html' https://SEU-FRONTEND/login
curl -I -H 'Accept: text/html' https://SEU-FRONTEND/pacientes
curl -I -H 'Accept: text/html' https://SEU-FRONTEND/agendamentos
curl -I -H 'Accept: text/html' https://SEU-FRONTEND/assets/arquivo-inexistente.js
```

Esperado: 200 nos três documentos e 404 no arquivo inexistente. Copie uma URL real de JS/CSS do index para testar um asset existente. O Accept HTML é necessário para exercitar a regra de navegação. Uma API remota não é consultada por esses testes de documento.

## Arquivos alterados

- Criado `web/public/.htaccess`: fallback SPA para entrega estática da Hostinger.
- Criado `web/DEPLOY_HOSTINGER.md`: diagnóstico, evidências, build, limites e deploy.
- Atualizado `web/README.md`: atalho para este procedimento.

Package.json, vite.config.ts, index.html, router, autenticação, VITE_API_URL, componentes, layout, backend NestJS e banco foram preservados. A correção só se torna ativa no site após commit/push e redeploy com a configuração indicada. Nenhum commit, push ou deploy foi realizado nesta tarefa.
