# medvita-care
Sistema de gestão para clínicas oftalmológicas, desenvolvido como projeto de TCC, com foco no gerenciamento de pacientes, consultas, prontuários e exames oftalmológicos. O projeto utiliza NestJS no back-end, React no front-end e PostgreSQL como banco de dados.

## Deploy unificado opcional

Na raiz, `npm ci` e `npm run build` geram `deploy/` com API, React e CA pública.
`npm start` inicia o processo Node único e conecta ao banco configurado no ambiente.

Os builds separados de `api/` e `web/` continuam disponíveis.
Configurações da Hostinger, diferenças de prefixo, resultados e plano de migração:
[UNIFIED_DEPLOY.md](./UNIFIED_DEPLOY.md).

