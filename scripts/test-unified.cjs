// HTTP integration against the compiled artifact. No database or migrations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const artifact = path.join(root, 'deploy');
const runtime = createRequire(path.join(artifact, 'api/package.json'));
const development = createRequire(path.join(root, 'api/package.json'));
runtime('reflect-metadata');
const common = runtime('@nestjs/common');
const { Reflector, NestFactory } = runtime('@nestjs/core');
const { ConfigService } = runtime('@nestjs/config');
const { JwtService } = runtime('@nestjs/jwt');
const request = development('supertest');
const compiled = name => require(path.join(artifact, 'api/dist', name));
const { configureApplication } = compiled('configure-app');
const { AuthController } = compiled('auth/auth.controller');
const { AuthService } = compiled('auth/auth.service');
const { JwtStrategy } = compiled('auth/strategies/jwt.strategy');
const { JwtAuthGuard } = compiled('auth/guards/jwt-auth.guard');
const { AuthorizationGuard } = compiled('auth/guards/authorization.guard');
const { BcryptService } = compiled('common/hashing/bcrypt.service');
const { SystemAdmin } = compiled('common/decorators/system-admin.decorator');
// Any accidental attempt to open a TypeORM connection fails the suite.
runtime('typeorm').DataSource.prototype.initialize = async () => { throw new Error('Database access forbidden in unified tests'); };

class UsersFixture {
  list() { return { authorized: true }; }
}
common.Controller('users')(UsersFixture);
const descriptor = Object.getOwnPropertyDescriptor(UsersFixture.prototype, 'list');
common.Get()(UsersFixture.prototype, 'list', descriptor);
SystemAdmin()(UsersFixture.prototype, 'list', descriptor);

async function fixture(unified) {
  const secret = randomBytes(32).toString('hex'), issuer = 'urn:medvita:unified-test';
  const values = { MEDVITA_UNIFIED: unified ? 'true' : 'false', MEDVITA_WEB_ROOT: path.join(artifact, 'public'), FRONTEND_URL: unified ? '' : 'http://localhost:5173', JWT_SECRET: secret, JWT_REFRESH_SECRET: randomBytes(32).toString('hex'), JWT_TOKEN_ISSUER: issuer, JWT_TOKEN_AUDIENCE: issuer, NODE_ENV: 'test' };
  const config = new ConfigService(values);
  const hashing = new BcryptService();
  const password = randomBytes(16).toString('hex');
  const user = { id: randomUUID(), name: 'Fixture local', email: 'fixture@example.com', passwordHash: await hashing.hash(password), active: true, isSystemAdmin: true, tokenVersion: 0, clinicUsers: [] };
  const users = {
    async findByEmail(email) { if (email.trim().toLowerCase() !== user.email) throw new common.NotFoundException(); return user; },
    async findForAuthentication(id) { if (id !== user.id) throw new common.NotFoundException(); return user; },
    async findById(id) { if (id !== user.id) throw new common.NotFoundException(); return user; },
    async updatePassword(id, hash) { assert.equal(id, user.id); user.passwordHash = hash; user.tokenVersion++; },
  };
  const sessions = new Map(), revoked = new Map();
  const sessionRepository = {
    create(value) { return value; },
    async save(value) { sessions.set(value.id, { ...value }); return value; },
    async findOneBy(where) { const value = sessions.get(where.id); return value && (!where.userId || where.userId === value.userId) ? { ...value } : null; },
    async update(where, patch) { for (const [id, value] of sessions) if ((!where.id || where.id === id) && (!where.userId || where.userId === value.userId)) sessions.set(id, { ...value, ...patch }); },
  };
  const revokedRepository = { async findOneBy(where) { return revoked.get(where.jti) ?? null; }, async upsert(value) { revoked.set(value.jti, value); } };
  const audit = { async recordBestEffort() {} };
  const jwt = new JwtService({ secret, signOptions: { expiresIn: 900, issuer, audience: issuer } });
  const auth = new AuthService(users, hashing, jwt, config, sessionRepository, revokedRepository, audit);
  new JwtStrategy(config, users, sessionRepository, revokedRepository);
  const reflector = new Reflector();
  class FixtureModule {}
  common.Module({ controllers: [AuthController, UsersFixture], providers: [{ provide: ConfigService, useValue: config }, { provide: Reflector, useValue: reflector }, { provide: AuthService, useValue: auth }] })(FixtureModule);
  const { ExpressAdapter } = runtime('@nestjs/platform-express');
  const app = await NestFactory.create(FixtureModule, new ExpressAdapter(), { logger: false });
  configureApplication(app);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new AuthorizationGuard(reflector));
  // Real compiled HTTP server, restricted to loopback, without importing AppModule.
  await app.listen(0, '127.0.0.1');
  return { app, password, user, prefix: unified ? '/api' : '' };
}

async function httpChecks(unified) {
  const { app, password, user, prefix } = await fixture(unified);
  try {
    const server = app.getHttpServer(), index = fs.readFileSync(path.join(artifact, 'public/index.html'), 'utf8');
    if (unified) {
      for (const url of ['/', '/login', '/pacientes', '/agendamentos', '/pacientes/123/editar', '/agendamentos?status=CONFIRMED', '/unknown-spa-route']) {
        const response = await request(server).get(url).set('Accept', 'text/html');
        assert.equal(response.status, 200);
        assert.equal(response.text, index);
        assert.equal(response.headers.location, undefined);
      }
      assert.equal((await request(server).head('/login').set('Accept', 'text/html')).status, 200);
      for (const url of ['/api', '/api/unknown', '/api/clinics/missing/patients', '/API/missing', '/assets/missing.js', '/missing.css', '/.env', '/api/dist/main.js']) {
        const response = await request(server).get(url).set('Accept', 'text/html');
        assert.equal(response.status, 404);
        if (/^\/api/i.test(url)) assert.ok(response.headers['content-type'].includes('application/json'));
        assert.notEqual(response.text, index);
      }
      assert.equal((await request(server).get('/pacientes').set('Accept', 'application/json')).status, 404);
      assert.equal((await request(server).post('/pacientes').send({})).status, 404);
      assert.equal((await request(server).post('/auth/login').send({})).status, 404);
      for (const extension of ['.js', '.css', '.woff2']) {
        const file = fs.readdirSync(path.join(artifact, 'public/assets')).find(name => name.endsWith(extension));
        const response = await request(server).get('/assets/' + file);
        assert.equal(response.status, 200);
        assert.ok(!response.headers['content-type'].includes('text/html'));
      }
      assert.equal((await request(server).get('/favicon.svg')).status, 200);
    } else {
      assert.equal((await request(server).get('/login').set('Accept', 'text/html')).status, 404);
      assert.equal((await request(server).post('/api/auth/login').send({})).status, 404);
    }
    assert.equal((await request(server).get(prefix + '/users')).status, 401);
    assert.equal((await request(server).post(prefix + '/auth/login').send({ email: user.email, password })).status, 403);
    const login = await request(server).post(prefix + '/auth/login').set('X-Medvita-Session', '1').send({ email: user.email, password });
    assert.equal(login.status, 201);
    assert.equal(login.body.user.isSystemAdmin, true);
    assert.deepEqual(login.body.user.clinicRoles, []);
    assert.equal(login.body.refreshToken, undefined);
    const cookie = login.headers['set-cookie'].find(value => value.startsWith('medvita_session='));
    assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && cookie.includes('Secure'));
    assert.equal((await request(server).get(prefix + '/users').auth(login.body.accessToken, { type: 'bearer' })).status, 200);
    const refreshed = await request(server).post(prefix + '/auth/refresh').set('X-Medvita-Session', '1').set('Cookie', cookie.split(';')[0]);
    assert.equal(refreshed.status, 201);
    assert.ok(refreshed.body.accessToken);
    const logout = await request(server).post(prefix + '/auth/logout').set('X-Medvita-Session', '1').auth(refreshed.body.accessToken, { type: 'bearer' });
    assert.equal(logout.status, 201);
    assert.equal((await request(server).get(prefix + '/users').auth(refreshed.body.accessToken, { type: 'bearer' })).status, 401);
    const newLogin = await request(server).post(prefix + '/auth/login').set('X-Medvita-Session', '1').send({ email: user.email, password });
    const changed = await request(server).patch(prefix + '/auth/change-password').auth(newLogin.body.accessToken, { type: 'bearer' }).send({ currentPassword: password, newPassword: randomBytes(16).toString('hex') });
    assert.equal(changed.status, 200);
    assert.equal((await request(server).get(prefix + '/users').auth(newLogin.body.accessToken, { type: 'bearer' })).status, 401);
    console.log(`PASS: HTTP ${unified ? 'unificado /api + SPA/assets/404 JSON' : 'legado sem prefixo e sem SPA'}; guards, cookie seguro, login/refresh/logout/troca de senha em memória.`);
  } finally { await app.close(); }
}

async function main() {
  process.env.NODE_ENV = 'production'; // Exercise Secure cookies, even on local loopback.
  for (const file of ['server.cjs', 'start.cjs', 'public/index.html', 'api/dist/main.js', 'api/certificates/prod-ca-2021.crt', 'api/node_modules/bcrypt/package.json']) assert.ok(fs.existsSync(path.join(artifact, file)));
  assert.ok(!fs.existsSync(path.join(artifact, 'public/.htaccess')));
  const manifest = JSON.parse(fs.readFileSync(path.join(artifact, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.frontendApiUrl, '/api');
  const checksum = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(manifest.apiLockSha256, checksum(path.join(root, 'api/package-lock.json')));
  assert.equal(manifest.webLockSha256, checksum(path.join(root, 'web/package-lock.json')));
  assert.equal(manifest.certificateSha256, checksum(path.join(artifact, 'api/certificates/prod-ca-2021.crt')));
  const { connectionOptions } = compiled('database/connection-options');
  const databaseOptions = connectionOptions({ DB_HOST: 'localhost', DB_PORT: 5432, DB_USERNAME: 'unused', DB_NAME: 'unused', DB_SSL_CA_PATH: 'certificates/prod-ca-2021.crt' });
  assert.equal(databaseOptions.ssl.rejectUnauthorized, true);
  assert.equal(databaseOptions.ssl.checkServerIdentity, require('node:tls').checkServerIdentity);
  assert.equal(databaseOptions.synchronize, false);
  assert.equal(databaseOptions.migrationsRun, false);
  assert.equal(databaseOptions.ssl.ca, fs.readFileSync(path.join(artifact, 'api/certificates/prod-ca-2021.crt'), 'utf8'));
  function noEnv(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { assert.ok(!/^\.env(?:\.|$)/.test(entry.name)); if (entry.isDirectory()) noEnv(path.join(directory, entry.name)); } }
  noEnv(artifact);
  console.log('PASS: artefato autocontido, CA íntegra, lockfiles, /api e ausência de .env.');
  await httpChecks(true);
  await httpChecks(false);
  console.log('Nenhuma conexão de banco, migration, alteração remota ou deploy executado.');
}
void main().catch(error => {
  console.error('FAIL: teste local unificado:', error.name);
  console.error(error.stack?.split('\n').find(line => line.trimStart().startsWith('at ') && line.includes('test-unified.cjs')) ?? 'Sem localização disponível.');
  console.error(error.stack?.split('\n').filter(line => line.trimStart().startsWith('at ')).slice(0, 6).join('\n'));
  process.exitCode = 1;
});
