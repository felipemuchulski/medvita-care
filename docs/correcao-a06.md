# Correção A06 — segurança HTTP, cache e exposição do servidor

Data: 18/11/2026. Escopo: exclusivamente A06 de [auditoria-permissoes-qa.md](auditoria-permissoes-qa.md). A01, documentada em [correcao-a01.md](correcao-a01.md), foi preservada.

Implementação local concluída para revisão. Não houve conexão ao PostgreSQL, migrations, alteração de entidades, RBAC, permissões, credenciais ou arquivos `.env`, nem publicação na Hostinger. Nenhum componente ou estilo React foi modificado.

## 1. Análise inicial e problemas identificados

- `api/src/main.ts` cria a aplicação Nest/Express e chama `configureApplication`; não configura cabeçalhos diretamente. Foi mantido sem alterações.
- `api/src/configure-app.ts` já centralizava CORS, pipes, serialização e entrega do React no modo unificado. Não havia Helmet, middleware equivalente ou remoção explícita de `X-Powered-By`.
- Versões efetivamente instaladas, confirmadas também no lockfile: **Nest Core 12.0.3**, **@nestjs/platform-express 12.3.3**, **Express 5.3.0**. O adaptador instalado é diferente da versão mínima `^12.0.3` declarada no package.json. Nenhuma dependência foi atualizada nesta etapa.
- Login/refresh já definiam `Cache-Control: no-store` no controller, porém não cobriam uniformemente falhas anteriores ao método, logout, dados clínicos, usuários, vínculos ou auditoria.
- CORS permite a origem exata de `FRONTEND_URL`, com credentials e os headers `Content-Type`, `Authorization` e `X-Medvita-Session`. No modo separado, essa URL é obrigatória. No unificado, CORS só é habilitado se ela estiver preenchida. Essa lógica foi preservada.
- JWT Bearer, cookies HttpOnly/SameSite=Strict, Secure em produção, rotação de refresh e revogação de sessão foram analisados e mantidos. A presença de CORS não substitui autenticação ou RBAC.
- No desenvolvimento separado, Vite entrega o React e encaminha `/api` ao Nest, retirando o prefixo. No modo unificado, Nest aplica `/api`, serve o build estático e usa fallback HTML para navegação React.
- `web/public/.htaccess` é o fallback da hospedagem estática separada; não define estes headers. O build unificado remove esse arquivo da pasta pública para não conflitar com o proxy Node da hospedagem. Não foi modificado.
- O processo Node não pode garantir headers de respostas geradas ou substituídas pelo proxy/CDN/servidor estático da Hostinger. Configuração de HTTPS, cache na borda, identificação do proxy e banners do servidor publicado não foram consultados ou alterados.

## 2. Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `api/src/common/http-security.ts` | Novo middleware central de headers/cache e configuração explícita de confiança em proxies. |
| `api/src/configure-app.ts` | Registra a segurança antes de CORS, arquivos estáticos e Guards; fallback HTML não sobrescreve um `Cache-Control` já definido. |
| `api/test/http-security.test.cjs` | Nova suíte HTTP/HTTPS com autenticação/sessão reais, identidades e persistência em memória e bloqueio de conexão ao banco. |
| `api/package.json` | Comando `test:http-security`: build e testes A06 junto à regressão existente de agenda/prontuário/A01. |
| `docs/correcao-a06.md` | Este relatório. |

Optou-se por middleware Express explícito, compatível com as versões instaladas e sem adicionar Helmet ou novas dependências. Há uma única configuração de headers na aplicação; as duas definições preexistentes de `no-store` em login/refresh continuam com o mesmo valor, sem conflito. Não foram usados métodos de versões posteriores do Nest.

## 3. Cabeçalhos implementados

Aplicados às respostas que passam pelo Nest, inclusive HTML/assets no modo unificado, respostas da API e erros/preflights que percorrem esse pipeline:

| Header | Valor/regra | Justificativa |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | Evitar interpretação do conteúdo como um tipo diferente do MIME declarado. MIME de JS/CSS é conferido nos testes. |
| `Referrer-Policy` | `no-referrer` | Não transmitir URLs e possíveis identificadores em Referer ao navegar/carregar recursos. Não altera o header Origin usado pelo CORS. |
| `X-Frame-Options` | `DENY` | Bloquear enquadramento da aplicação, inclusive em navegadores que usam esse mecanismo. |
| `Content-Security-Policy` | `frame-ancestors 'none'` | Aplicar proteção contra enquadramento em navegadores modernos. Esta política ativa não restringe scripts, estilos, fontes ou conexões da aplicação. |
| `Content-Security-Policy-Report-Only` | Política de recursos descrita abaixo | Avaliar uma política mais ampla sem bloquear React, calendário, API ou desenvolvimento. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | Não foi identificado uso dessas APIs no front-end; não foram desativadas capacidades de clipboard ou outras sem necessidade. |
| `Strict-Transport-Security` | `max-age=86400`, somente em produção e `request.secure === true` | Adoção inicial por um dia, sem includeSubDomains/preload; requer HTTPS real ou proxy explicitamente confiável. |
| `X-Powered-By` | Desabilitado com `app.disable("x-powered-by")` | Retirar a identificação automática do Express. O Node não emite `Server` nos cenários testados; banners adicionados pela borda precisam ser tratados nela. |

Política Report-Only:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'
```

Fora de produção, `connect-src` também inclui `ws:` e `wss:` para observação sem ruído desnecessário de desenvolvimento/HMR. `style-src` contempla estilos inline usados por bibliotecas visuais. Não há `upgrade-insecure-requests` para interferir com desenvolvimento HTTP.

**Somente `frame-ancestors` é CSP bloqueante nesta etapa.** A política de recursos está em Report-Only: serve para diagnóstico em DevTools, não constitui bloqueio de XSS nem monitoramento centralizado de violações. Não foi criado coletor ou configurado envio de relatórios a terceiros. Antes de torná-la bloqueante, verificar origens reais de API/assets e comportamento visual. Os dois headers CSP têm propósitos distintos e não apresentam diretivas ativas contraditórias.

Em erro de arquivo estático inexistente, o Express pode substituir a CSP ativa por `default-src 'none'`, mais restritiva para a página de erro. Os testes aceitam esse comportamento seguro e verificam os demais headers.

## 4. Estratégia de cache

O middleware é executado antes de autenticação/autorização. Assim, o resultado de um Guard, pipe ou handler não deixa de receber a política por falhar antes de chegar ao controller.

| Resposta | Política |
| --- | --- |
| Modo separado | Todas as respostas do Nest recebem `Cache-Control: no-store`, pois esse processo serve a API, não o React estático. Inclui rotas desconhecidas, auth e preflight. |
| Modo unificado, `/api` ou `/api/...` | `no-store`, sem depender da presença de token nem do sucesso da autenticação. Abrange pacientes, agenda, atendimentos/históricos, exames, profissionais, clínicas, usuários, vínculos e auditoria; inclui erros. |
| Requisição com header Authorization, em qualquer caminho | `no-store`, inclusive se atingir fallback HTML ou arquivo estático. Assets públicos normais não enviam esse header. |
| HTML público da SPA no unificado | Mantém `no-cache` para revalidação do documento. Não sobrescreve `no-store` previamente aplicado. O HTML é a casca pública, sem dados clínicos renderizados no servidor. |
| Assets públicos da SPA | Mantém o comportamento existente de cache/ETag/Last-Modified do servidor estático, inclusive revalidação 304. Não foi imposto `no-store` nem alterado o TTL desses arquivos. |

Cookies de sessão com path `/` podem acompanhar assets; sua mera presença **não** desabilita o cache dos assets públicos. A proteção de conteúdo da API é definida pelo namespace, inclusive login/refresh/logout, e não por tentar inferir dados sensíveis a partir do cookie.

Não foi criado cache público para APIs, nem tratamento especial que permita cachear resultados 401/403/404 da API. `no-store` não apaga cópias armazenadas anteriormente e não altera React Query, armazenamento de formulários ou histórico do navegador; alterações desses mecanismos pertencem a outros escopos. Caches preexistentes na borda devem ser avaliados na entrega.

## 5. Desenvolvimento, produção e proxy

### Desenvolvimento

- Nest separado mantém suas rotas sem `/api`; Vite continua encaminhando `/api` e retirando o prefixo como antes.
- HSTS não é emitido fora de `NODE_ENV=production`, mesmo com indicação de HTTPS de um proxy confiável.
- O middleware não muda headers dos documentos servidos diretamente pelo processo Vite. A política CSP desse servidor de desenvolvimento não foi alterada.
- CORS e cookies conservam as regras anteriores; não foram adicionados `*`, novas origens ou alterações de SameSite.

### Produção e `HTTP_TRUST_PROXY`

Por padrão, `trust proxy` é **false**. Um cliente não consegue ativar HSTS apenas enviando `X-Forwarded-Proto: https` ao processo em HTTP.

A nova configuração opcional `HTTP_TRUST_PROXY` aceita uma lista separada por vírgulas de IPs ou CIDRs dos proxies realmente confiáveis. Um exemplo estritamente sintético é `192.0.2.10/32,2001:db8::10/128`; **não corresponde à infraestrutura MedVita/Hostinger e não deve ser copiado como configuração real**.

Entradas inválidas, booleanos, contagem de saltos e redes `/0` são rejeitados antes de servir requisições. Não foi ativado `trust proxy: true` nem presumido que o proxy da Hostinger use loopback. A aplicação continua iniciando sem configurar essa opção, com confiança desabilitada.

Somente após identificar e limitar o proxy real, e confirmar que ele substitui headers encaminhados vindos do cliente, deve-se fornecer sua allowlist na plataforma. Isso permite ao Express reconhecer `request.secure` quando TLS termina no proxy. Também afeta APIs Express que dependem de endereços encaminhados; essa configuração merece homologação, não deve ser usada com redes amplas por conveniência.

Quando o Node recebe TLS diretamente, HSTS funciona sem confiar em proxy. Quando a Hostinger termina TLS e não há confiança configurada, **o Node não emite HSTS**; ele deve ser gerenciado corretamente pela borda ou habilitado após validar a allowlist. Esta mudança não implementa redirecionamento HTTP→HTTPS.

Nenhum `.env`, painel de hospedagem, certificado real ou configuração do proxy foi modificado. A única chave/certificado gerada durante os testes é descartável e sintética, em diretório temporário removido ao final.

### React estático hospedado separadamente

O middleware Nest protege a API; ele **não controla** o HTML/JS/CSS que Apache/LiteSpeed/CDN entregam diretamente no modo separado. Os headers equivalentes do documento React precisam ser configurados e conferidos nessa hospedagem antes da liberação. O `.htaccess` atual foi preservado para não introduzir diretivas cuja compatibilidade com o plano Hostinger não foi validada. No modo unificado, os documentos e assets entregues pelo Node já recebem os headers desta correção.

## 6. Testes executados e resultados

| Verificação | Resultado |
| --- | --- |
| `npm --prefix api run test:http-security` | **27/27 aprovados**, com build Nest/TypeScript incluído: 13 novos testes de segurança HTTP/HTTPS e 14 testes existentes de agenda/permissões/prontuário/A01. |
| `npm --prefix api run lint` | Aprovado. |
| `npm --prefix web test -- --reporter=dot` | **7/7 aprovados**, incluindo contrato mínimo de A01, reconhecimento do atendimento e mapeamento do calendário. |
| `npm --prefix web run build` | Aprovado, incluindo React/FullCalendar e checagem TypeScript. |
| `git diff --check` | Aprovado. |

Cobertura nova:

- Login, refresh com cookie, requisição Bearer autorizada, logout, sessão revogada e tentativa de refresh após logout, nos modos separado e unificado.
- Ausência de `X-Powered-By` e `Server`, headers de segurança e `no-store` em respostas autenticadas das rotas de transporte representando cada grupo de dados sensíveis.
- Respostas 400, 401, 403, 404 e 503, inclusive falha de validação ou header obrigatório antes da resposta de login; erros sintéticos sem stack/caminho local no corpo.
- CORS para origem permitida e proibida, credentials, Authorization/header de sessão em preflight e modo unificado com CORS desabilitado. A origem não autorizada não recebe permissão de leitura pelo navegador; CORS não foi transformado em bloqueio HTTP ou RBAC.
- HTML com fallback, JS/CSS com MIME apropriado, cache público e 304, arquivo estático inexistente, `/API` desconhecido e requisições autenticadas atingindo HTML/assets.
- HSTS ausente em HTTP, desenvolvimento e proxy não confiável; presente em produção atrás de proxy explicitamente confiável. Configurações inválidas de confiança são rejeitadas.
- HTTPS real em loopback com certificado sintético e CA explícita no cliente do teste, sem desabilitar globalmente a validação TLS: HSTS e cookie Secure presentes, com `trust proxy` false.
- A suíte A01 preservada continua validando respostas sem dados clínicos para ADMIN/RECEPTIONIST, criação/início/edição/leitura/conclusão pelo médico autor, negação a perfis indevidos e bloqueio de leitura clínica quando auditoria falha.

Os testes novos utilizam o código compilado atual, servidor Nest/Express real, interceptor/pipes, JWT/Passport/Guards e AuthController/AuthService reais. Identidades, sessões, revogações e persistência são fixtures em memória; as rotas de transporte de dados da suíte A06 não substituem teste funcional de todos os módulos. Os serviços reais de agenda/atendimento/auditoria são exercitados pela regressão A01. `DataSource.initialize` é bloqueado nas suítes HTTP.

Foi necessária execução com permissão de loopback do ambiente para os testes HTTP/HTTPS; não houve acesso ao domínio publicado. As expectativas de testes foram ajustadas à validação de DTO antes do método de login e à CSP mais restrita dos erros estáticos do Express, sem modificar esses comportamentos da aplicação.

Não foram executados testes que preparam PostgreSQL, integração com banco, navegador/leitor de tela nem suíte contra artefato `deploy/` antigo. O artefato unificado não foi reconstruído/publicado nesta etapa.

## 7. Riscos de compatibilidade e limites

- O bloqueio de frames é intencional e pode impedir pré-visualização dentro de iframe do painel da hospedagem ou integrações que embutam o site. A navegação normal em janela própria deve ser validada; não se recomenda liberar enquadramento globalmente para contornar uma prévia do painel.
- CSP Report-Only pode apontar recursos/origens adicionais, principalmente API em origem diferente ou recursos externos futuros. Ela não bloqueia esses carregamentos nesta etapa. Antes de torná-la bloqueante, resolver os avisos e aprovar a política real.
- Bibliotecas que usam estilos inline, como o calendário, não são bloqueadas pela política ativa. Os testes de MIME/build e helpers não substituem inspeção do calendário no navegador.
- `Permissions-Policy` impede câmera/microfone/geolocalização/pagamento/USB se funções futuras tentarem usá-los. Não foi identificado uso atual dessas APIs.
- Proxies/CDNs podem acrescentar ou substituir `Server`, `X-Powered-By`, CSP, CORS, HSTS ou cache, inclusive em erros. A proteção observada diretamente no Node não comprova o resultado público na Hostinger.
- Uma CSP bloqueante já existente na borda continua bloqueante; adicionar Report-Only no Node não a relaxa. Várias políticas ativas podem se combinar em restrições adicionais.
- HSTS é mantido pelo navegador durante seu prazo. Não foi ativado para subdomínios nem preload; alteração do header não desfaz imediatamente a política já recebida.

## 8. Pendências de homologação na Hostinger

1. Identificar se a publicação efetiva usa Node unificado ou front-end estático separado; conferir os headers do HTML na camada que realmente o entrega.
2. Identificar terminação TLS e IPs/CIDRs dos proxies autorizados; comprovar substituição de `X-Forwarded-Proto` e limitação de acesso direto ao Node. Definir um responsável por HSTS na borda/aplicação para evitar valores conflitantes.
3. Comparar headers públicos e do Node em HTML, JS/CSS/fontes, login/refresh/logout, dados clínicos e erros 401/403/404/5xx. Avaliar `Server`, headers de runtime e páginas de erro geradas pela hospedagem, sem registrar tokens ou dados reais.
4. Confirmar bypass de cache/CDN para `/api`, autenticação e demais rotas de API do modo separado; não aceitar regras que sobrescrevam `no-store`. Avaliar remoção de cópias sensíveis que possam ter sido cacheadas anteriormente.
5. Garantir que os assets versionados mantenham a política pública esperada; não aplicar `no-store` indiscriminadamente ao site inteiro pela borda.
6. No navegador, validar login/restauração/refresh/logout, 401/403, agenda/prontuário sem vazamento de A01 e calendário, com CSP Report-Only inspecionada. Usar dados sintéticos e conferir telas pequenas, foco e acessibilidade sem mudanças visuais.
7. No modo estático separado, configurar os headers do documento React no servidor estático/CDN após verificar suporte do plano Hostinger; não presumir que os headers da API protegem esse documento.

## 9. Orientações para deploy seguro após revisão

1. Revisar o diff A06 e este relatório; manter A01 na revisão a ser entregue. Não ampliar o escopo com alterações RBAC ou outras recomendações da auditoria.
2. Executar `npm --prefix api run test:http-security` e os testes/build do web em ambiente isolado, com loopback e OpenSSL disponíveis para o teste TLS sintético. Não executar migrations ou seeds como parte desses checks.
3. Reconstruir o artefato apropriado com o processo de entrega do projeto; o `deploy/` anterior não contém automaticamente esta correção. No unificado, preservar o prefixo `/api` e a remoção do `.htaccess` estático do artefato público.
4. Manter `NODE_ENV=production`. Configurar `HTTP_TRUST_PROXY` somente com a topologia confirmada; se não houver confirmação, manter confiança desabilitada e tratar HSTS na borda HTTPS validada.
5. Homologar os itens da seção anterior antes de liberar. Não ativar CSP de recursos em modo bloqueante, includeSubDomains ou preload sem uma etapa própria de verificação.
6. Após a publicação aprovada, conferir respostas públicas e comportamento de sessão/agenda/calendário. Manter uma versão anterior revisada que preserve A01 para eventual retorno; lembrar que HSTS já recebido e configurações da borda exigem avaliação própria.

As precauções de proxy seguem a [documentação oficial do Express](https://expressjs.com/en/guide/behind-proxies/). A distinção entre política CSP ativa e observacional pode ser conferida na [referência de CSP Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only).

Status: **A06 implementado e testado localmente; aguardando revisão e homologação antes de qualquer publicação**.
