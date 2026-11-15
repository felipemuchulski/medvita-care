import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'deploy');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--use-installed')) throw new Error('Argumento de build desconhecido.');
const useInstalled = args.includes('--use-installed');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(cwd, args, extra = {}) {
  const result = spawnSync(npm, args, { cwd, env: { ...process.env, ...extra }, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Falha na etapa npm do build unificado.');
}
function digest(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }

// No app/server/DataSource imports here: build cannot connect to the database.
for (const app of ['api', 'web']) {
  if (!useInstalled) run(join(root, app), ['ci', '--include=dev', '--no-audit', '--no-fund']);
}
run(join(root, 'web'), ['run', 'build'], { VITE_API_URL: '/api' });
run(join(root, 'api'), ['run', 'build']);

rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'api/certificates'), { recursive: true });
cpSync(join(root, 'api/dist'), join(output, 'api/dist'), { recursive: true });
cpSync(join(root, 'web/dist'), join(output, 'public'), { recursive: true });
// Hostinger must send all requests to Node. Never publish the static-only rules
// beside its generated Node proxy configuration in the unified deployment.
rmSync(join(output, 'public/.htaccess'), { force: true });
if (existsSync(join(output, 'public/api'))) throw new Error('O namespace /api é reservado ao NestJS.');
const certificate = join(root, 'api/certificates/prod-ca-2021.crt');
new X509Certificate(readFileSync(certificate));
cpSync(certificate, join(output, 'api/certificates/prod-ca-2021.crt'));
for (const name of ['package.json', 'package-lock.json']) cpSync(join(root, 'api', name), join(output, 'api', name));
cpSync(join(root, 'scripts/start-unified.cjs'), join(output, 'start.cjs'));
cpSync(join(root, 'server.cjs'), join(output, 'server.cjs'));
// Always use the existing API lockfile for the self-contained runtime artifact.
run(join(output, 'api'), ['ci', '--omit=dev', '--no-audit', '--no-fund']);

function assertNoEnvironmentFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (/^\.env(?:\.|$)/.test(entry.name)) throw new Error('Arquivo de ambiente proibido no artefato.');
    if (entry.isDirectory()) assertNoEnvironmentFiles(join(directory, entry.name));
  }
}
assertNoEnvironmentFiles(output);
for (const file of ['server.cjs', 'start.cjs', 'api/dist/main.js', 'public/index.html', 'api/certificates/prod-ca-2021.crt', 'api/node_modules/@nestjs/core/package.json']) {
  if (!existsSync(join(output, file))) throw new Error('Artefato unificado incompleto.');
}
writeFileSync(join(output, 'build-manifest.json'), JSON.stringify({
  mode: 'unified', entry: 'server.cjs', apiPrefix: '/api', frontendApiUrl: '/api',
  apiLockSha256: digest(join(root, 'api/package-lock.json')),
  webLockSha256: digest(join(root, 'web/package-lock.json')),
  certificateSha256: digest(certificate),
}, null, 2) + '\n');
console.log('Artefato unificado pronto em deploy/: API, React, CA e dependências de produção. Nenhuma conexão ao banco.');
