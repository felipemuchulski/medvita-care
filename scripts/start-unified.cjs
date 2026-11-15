const path = require('node:path');

// This file is copied to deploy/start.cjs. Paths never depend on the shell cwd.
process.env.MEDVITA_UNIFIED = 'true';
process.env.NODE_ENV ??= 'production';
process.env.MEDVITA_WEB_ROOT = path.join(__dirname, 'public');
process.env.DB_SSL_CA_PATH ??= path.join(__dirname, 'api/certificates/prod-ca-2021.crt');

require('./api/dist/main.js').bootstrap().catch(() => {
  console.error('Falha ao iniciar MedVita Care. Consulte a configuração do ambiente.');
  process.exitCode = 1;
});
