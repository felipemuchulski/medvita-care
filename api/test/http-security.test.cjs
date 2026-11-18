// Build first. Real HTTP/JWT/session pipeline, synthetic data, no database.
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
require("reflect-metadata");
const common = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { Reflector } = require("@nestjs/core");
const { ConfigService } = require("@nestjs/config");
const { JwtService } = require("@nestjs/jwt");
const { DataSource } = require("typeorm");
const request = require("supertest");
const { configureApplication } = require("../dist/configure-app");
const { AuthController } = require("../dist/auth/auth.controller");
const { AuthService } = require("../dist/auth/auth.service");
const { JwtStrategy } = require("../dist/auth/strategies/jwt.strategy");
const { JwtAuthGuard } = require("../dist/auth/guards/jwt-auth.guard");
const { AuthorizationGuard } = require("../dist/auth/guards/authorization.guard");
const { BcryptService } = require("../dist/common/hashing/bcrypt.service");
const { SystemAdmin } = require("../dist/common/decorators/system-admin.decorator");

DataSource.prototype.initialize = async () => { throw new Error("Database forbidden in A06 tests"); };

// Transport fixtures exercise route/cache coverage, not the business services.
const sensitivePaths = [
  "clinics/:clinicId/patients", "clinics/:clinicId/appointments",
  "clinics/:clinicId/encounters", "clinics/:clinicId/patients/:patientId/encounters",
  "clinics/:clinicId/exams", "clinics/:clinicId/professionals",
  "clinics/:clinicId/users", "clinics/:clinicId/audit-logs", "users", "users/:userId/clinics",
];
class TransportFixture {
  read() { return { data: "SYNTHETIC_SENSITIVE_DATA" }; }
  restricted() { return { admin: true }; }
  failure() { throw new common.ServiceUnavailableException("Falha sintética"); }
}
common.Controller()(TransportFixture);
for (const [method, routes] of [["read", sensitivePaths], ["restricted", "restricted"], ["failure", "failure"]]) {
  const descriptor = Object.getOwnPropertyDescriptor(TransportFixture.prototype, method);
  common.Get(routes)(TransportFixture.prototype, method, descriptor);
  if (method === "restricted") SystemAdmin()(TransportFixture.prototype, method, descriptor);
}

async function fixture(t, unified, overrides = {}, httpsOptions) {
  const webRoot = mkdtempSync(path.join(tmpdir(), "medvita-a06-"));
  mkdirSync(path.join(webRoot, "assets"));
  writeFileSync(path.join(webRoot, "index.html"), '<!doctype html><html><body><div id="root"></div><script src="/assets/app-synthetic.js"></script></body></html>');
  writeFileSync(path.join(webRoot, "assets/app-synthetic.js"), 'console.log("synthetic");');
  writeFileSync(path.join(webRoot, "assets/calendar-synthetic.css"), ".calendar { display: grid; }");
  const config = new ConfigService({
    NODE_ENV: "test", MEDVITA_UNIFIED: String(unified), MEDVITA_WEB_ROOT: webRoot,
    FRONTEND_URL: "http://localhost:5173", JWT_SECRET: randomBytes(32).toString("hex"),
    JWT_TOKEN_ISSUER: "urn:medvita:synthetic-test", JWT_TOKEN_AUDIENCE: "urn:medvita:synthetic-test",
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"), ...overrides,
  });
  const hashing = new BcryptService(), password = randomBytes(20).toString("hex");
  const user = {
    id: randomUUID(), name: "Usuário sintético", email: "synthetic@example.invalid",
    passwordHash: await hashing.hash(password), active: true, tokenVersion: 0,
    isSystemAdmin: false, clinicUsers: [],
  };
  const users = {
    async findByEmail(email) { if (email !== user.email) throw new common.NotFoundException(); return user; },
    async findForAuthentication(id) { if (id !== user.id) throw new common.NotFoundException(); return user; },
  };
  const sessions = new Map(), revoked = new Map();
  const sessionRepository = {
    create: value => value,
    async save(value) { sessions.set(value.id, { ...value }); return value; },
    async findOneBy(where) {
      const value = sessions.get(where.id);
      return value && (!where.userId || value.userId === where.userId) ? { ...value } : null;
    },
    async update(where, patch) {
      for (const [id, value] of sessions)
        if ((!where.id || id === where.id) && (!where.userId || value.userId === where.userId))
          sessions.set(id, { ...value, ...patch });
    },
  };
  const revokedRepository = {
    async findOneBy(where) { return revoked.get(where.jti) ?? null; },
    async upsert(value) { revoked.set(value.jti, value); },
  };
  const jwt = new JwtService({ secret: config.get("JWT_SECRET"), signOptions: {
    expiresIn: 300, issuer: config.get("JWT_TOKEN_ISSUER"), audience: config.get("JWT_TOKEN_AUDIENCE"),
  } });
  const auth = new AuthService(users, hashing, jwt, config, sessionRepository, revokedRepository, { async recordBestEffort() {} });
  new JwtStrategy(config, users, sessionRepository, revokedRepository);
  const module = await Test.createTestingModule({
    controllers: [AuthController, TransportFixture],
    providers: [{ provide: ConfigService, useValue: config }, { provide: AuthService, useValue: auth }],
  }).compile();
  const app = module.createNestApplication({ logger: false, ...(httpsOptions ? { httpsOptions } : {}) });
  t.after(async () => { await app.close(); rmSync(webRoot, { recursive: true, force: true }); });
  configureApplication(app);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new AuthorizationGuard(reflector));
  await app.listen(0, "127.0.0.1");
  const prefix = unified ? "/api" : "";
  const http = request(app.getHttpServer());
  async function login() {
    return http.post(`${prefix}/auth/login`).set("X-Medvita-Session", "1")
      .send({ email: user.email, password }).expect(201);
  }
  return { app, http, prefix, login, user, password, sessions, revoked };
}

function assertHeaders(response, sensitive = true) {
  const h = response.headers;
  assert.equal(h["x-powered-by"], undefined);
  assert.equal(h.server, undefined);
  assert.equal(h["x-content-type-options"], "nosniff");
  assert.equal(h["referrer-policy"], "no-referrer");
  assert.equal(h["x-frame-options"], "DENY");
  // Express may supply its stricter default CSP for a missing static asset.
  assert.ok(["frame-ancestors 'none'", "default-src 'none'"].includes(h["content-security-policy"]));
  assert.match(h["content-security-policy-report-only"], /default-src 'self'/);
  assert.match(h["permissions-policy"], /camera=\(\), microphone=\(\), geolocation=\(\)/);
  if (sensitive) assert.equal(h["cache-control"], "no-store");
}

for (const unified of [false, true]) {
  const mode = unified ? "unified" : "separate";
  test(`${mode}: login/refresh/logout and authenticated sensitive responses keep headers and session behavior`, async t => {
    const f = await fixture(t, unified), login = await f.login();
    assertHeaders(login);
    assert.equal(login.body.refreshToken, undefined);
    const cookie = login.headers["set-cookie"][0];
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
    const refreshed = await f.http.post(`${f.prefix}/auth/refresh`).set("X-Medvita-Session", "1")
      .set("Cookie", cookie.split(";")[0]).expect(201);
    assertHeaders(refreshed);
    const access = refreshed.body.accessToken;
    for (const route of sensitivePaths) {
      const url = `${f.prefix}/${route.replace(/:[a-zA-Z]+/g, randomUUID())}`;
      assertHeaders(await f.http.get(url).auth(access, { type: "bearer" }).expect(200));
    }
    const logout = await f.http.post(`${f.prefix}/auth/logout`).set("X-Medvita-Session", "1")
      .auth(access, { type: "bearer" }).expect(201);
    assertHeaders(logout);
    assert.match(logout.headers["set-cookie"][0], /Expires=Thu, 01 Jan 1970/);
    assertHeaders(await f.http.get(`${f.prefix}/users`).auth(access, { type: "bearer" }).expect(401));
    assertHeaders(await f.http.post(`${f.prefix}/auth/refresh`).set("X-Medvita-Session", "1")
      .set("Cookie", refreshed.headers["set-cookie"][0].split(";")[0]).expect(401));
    assert.ok([...f.sessions.values()].every(s => s.revokedAt));
    assert.equal(f.revoked.size, 1);
  });

  test(`${mode}: 400/401/403/404/503 errors and CORS preflight inherit security and no-store`, async t => {
    const f = await fixture(t, unified), access = (await f.login()).body.accessToken;
    assertHeaders(await f.http.get(`${f.prefix}/users`).expect(401));
    assertHeaders(await f.http.get(`${f.prefix}/restricted`).auth(access, { type: "bearer" }).expect(403));
    for (const response of [
      await f.http.get(`${f.prefix}/missing`).expect(404),
      await f.http.get(`${f.prefix}/failure`).auth(access, { type: "bearer" }).expect(503),
    ]) {
      assertHeaders(response);
      assert.equal(response.body.stack, undefined);
      assert.equal(response.text.includes(process.cwd()), false);
      assert.equal(response.text.includes("node_modules"), false);
    }
    assertHeaders(await f.http.post(`${f.prefix}/auth/login`).send({ email: f.user.email, password: f.password }).expect(403));
    assertHeaders(await f.http.post(`${f.prefix}/auth/login`).set("X-Medvita-Session", "1").send({}).expect(400));
    const preflight = await f.http.options(`${f.prefix}/users`).set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET").set("Access-Control-Request-Headers", "Authorization,X-Medvita-Session").expect(204);
    assertHeaders(preflight);
    assert.equal(preflight.headers["access-control-allow-origin"], "http://localhost:5173");
    assert.equal(preflight.headers["access-control-allow-credentials"], "true");
    const allowed = await f.http.get(`${f.prefix}/users`).set("Origin", "http://localhost:5173")
      .auth(access, { type: "bearer" }).expect(200);
    assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:5173");
    const foreign = await f.http.get(`${f.prefix}/users`).set("Origin", "https://foreign.example.invalid")
      .auth(access, { type: "bearer" }).expect(200);
    // CORS is a browser read restriction, not an authentication/HTTP status rule.
    assert.notEqual(foreign.headers["access-control-allow-origin"], "https://foreign.example.invalid");
    assert.notEqual(foreign.headers["access-control-allow-origin"], "*");
  });
}

test("unified: public HTML/assets retain their cache behavior and MIME types", async t => {
  const f = await fixture(t, true);
  for (const route of ["/", "/login", "/calendario", "/prontuarios/pacientes/synthetic"]) {
    const html = await f.http.get(route).set("Accept", "text/html").expect(200);
    assertHeaders(html, false);
    assert.equal(html.headers["cache-control"], "no-cache");
    assert.match(html.headers["content-type"], /text\/html/);
  }
  for (const [route, mime] of [["/assets/app-synthetic.js", /javascript/], ["/assets/calendar-synthetic.css", /text\/css/]]) {
    const asset = await f.http.get(route).expect(200);
    assertHeaders(asset, false);
    assert.notEqual(asset.headers["cache-control"], "no-store");
    assert.match(asset.headers["content-type"], mime);
    const conditional = await f.http.get(route).set("If-None-Match", asset.headers.etag).expect(304);
    assertHeaders(conditional, false);
    assert.notEqual(conditional.headers["cache-control"], "no-store");
  }
  const missing = await f.http.get("/assets/missing.js").expect(404);
  assertHeaders(missing, false);
  assertHeaders(await f.http.get("/API/missing").expect(404));
  const access = (await f.login()).body.accessToken;
  assertHeaders(await f.http.get("/calendario").set("Accept", "text/html").auth(access, { type: "bearer" }).expect(200));
  assertHeaders(await f.http.get("/assets/app-synthetic.js").auth(access, { type: "bearer" }).expect(200));
});

test("unified same-origin mode can keep CORS disabled", async t => {
  const f = await fixture(t, true, { FRONTEND_URL: "" });
  const login = await f.login();
  assertHeaders(login);
  assert.equal(login.headers["access-control-allow-origin"], undefined);
});

for (const [name, environment, trust, forwarded, expected] of [
  ["untrusted forwarded HTTPS", "production", undefined, "https", undefined],
  ["trusted forwarded HTTPS", "production", "127.0.0.1/32", "https", "max-age=86400"],
  ["trusted HTTP", "production", "127.0.0.1/32", "http", undefined],
  ["different trusted proxy", "production", "192.0.2.1/32", "https", undefined],
  ["development HTTPS indication", "development", "127.0.0.1/32", "https", undefined],
]) {
  test(`HSTS: ${name}`, async t => {
    const f = await fixture(t, false, { NODE_ENV: environment, HTTP_TRUST_PROXY: trust });
    const response = await f.http.get("/users").set("X-Forwarded-Proto", forwarded).expect(401);
    assertHeaders(response);
    assert.equal(response.headers["strict-transport-security"], expected);
  });
}

test("unsafe or invalid trust proxy settings fail before serving requests", () => {
  for (const value of ["true", "1", "0.0.0.0/0", "::/0", "127.0.0.1/33", "::1/129", "127.0.0.1,", "127.0.0.1/32/extra"]) {
    const config = new ConfigService({ FRONTEND_URL: "http://localhost:5173", HTTP_TRUST_PROXY: value });
    const app = { get: () => config, disable() {}, set() {} };
    assert.throws(() => configureApplication(app), /HTTP_TRUST_PROXY/);
  }
});

test("production direct TLS emits HSTS and preserves Secure session cookies without trusting proxies", async t => {
  const directory = mkdtempSync(path.join(tmpdir(), "medvita-a06-tls-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const keyPath = path.join(directory, "synthetic-key.pem");
  const certPath = path.join(directory, "synthetic-cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", keyPath, "-out", certPath], { stdio: "ignore" });
  const cert = readFileSync(certPath);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production"; // Ephemeral test process only; no .env file.
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  const f = await fixture(t, false, { NODE_ENV: "production" }, { key: readFileSync(keyPath), cert });
  const login = await f.http.post("/auth/login").ca(cert).set("X-Medvita-Session", "1")
    .send({ email: f.user.email, password: f.password }).expect(201);
  assertHeaders(login);
  assert.equal(login.headers["strict-transport-security"], "max-age=86400");
  assert.match(login.headers["set-cookie"][0], /; Secure/);
  assert.equal(f.app.getHttpAdapter().getInstance().get("trust proxy"), false);
});
