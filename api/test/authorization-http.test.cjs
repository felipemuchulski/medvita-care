// Real controllers/guards/JWT and auth/clinical services, memory-only repositories.
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { test } = require("node:test");
require("reflect-metadata");
const common = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { Reflector } = require("@nestjs/core");
const { ConfigService } = require("@nestjs/config");
const { JwtService } = require("@nestjs/jwt");
const { DataSource } = require("typeorm");
const request = require("supertest");
const load = name => require(`../dist/${name}`);
const { configureApplication } = load("configure-app");
const { AuthController } = load("auth/auth.controller");
const { AuthService } = load("auth/auth.service");
const { UsersController } = load("users/users.controller");
const { UserService } = load("users/user.service");
const { ClinicUsersController } = load("clinic-users/clinic-users.controller");
const { ClinicUsersService } = load("clinic-users/clinic-users.service");
const { HashingService } = load("common/hashing/hashing.service");
const { BcryptService } = load("common/hashing/bcrypt.service");
const { JwtStrategy } = load("auth/strategies/jwt.strategy");
const { JwtAuthGuard } = load("auth/guards/jwt-auth.guard");
const { AuthorizationGuard } = load("auth/guards/authorization.guard");
const { Public } = load("common/decorators/public.decorator");
const { Authenticated } = load("common/decorators/authenticated.decorator");
const { SystemAdmin } = load("common/decorators/system-admin.decorator");
const { ClinicRoles } = load("common/decorators/roles.decorator");
const { ExamsController } = load("exams/exams.controller");
const { ExamsService } = load("exams/exams.service");
const { ProfessionalProfile } = load("professionals/entities/professional-profile.entity");
const { ExamType } = load("exams/entities/exam-type.entity");
DataSource.prototype.initialize = async () => { throw new Error("Database forbidden in A07 tests"); };

class PolicyFixture {
  missing() { return { reached: true }; }
  public() { return { public: true }; }
  authenticated() { return { authenticated: true }; }
  admin() { return { admin: true }; }
  clinical() { return { clinical: true }; }
}
common.Controller("policy")(PolicyFixture);
for (const [method, route, decorator] of [
  ["missing", "missing"], ["public", "public", Public()],
  ["authenticated", "authenticated", Authenticated()], ["admin", "admin", SystemAdmin()],
  ["clinical", "clinics/:clinicId", ClinicRoles("clinicId", "OPHTHALMOLOGIST")],
]) {
  const descriptor = Object.getOwnPropertyDescriptor(PolicyFixture.prototype, method);
  common.Get(route)(PolicyFixture.prototype, method, descriptor);
  decorator?.(PolicyFixture.prototype, method, descriptor);
}

async function fixture(t) {
  const config = new ConfigService({ NODE_ENV: "test", FRONTEND_URL: "http://localhost:5173",
    JWT_SECRET: randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    JWT_TOKEN_ISSUER: "urn:medvita:a07", JWT_TOKEN_AUDIENCE: "urn:medvita:a07" });
  const hashing = new BcryptService(), password = randomBytes(20).toString("hex");
  const clinicId = randomUUID(), userId = randomUUID(), professionalId = randomUUID(), examId = randomUUID();
  const users = new Map(), sessions = new Map(), revoked = new Map(), reads = [];
  const user = { id: userId, name: "Usuário sintético", email: "synthetic@example.invalid", active: true,
    passwordHash: await hashing.hash(password), isSystemAdmin: false, tokenVersion: 0,
    clinicUsers: [{ clinicId, role: "OPHTHALMOLOGIST", active: true, clinic: { active: true } }] };
  users.set(userId, user);
  const userService = {
    async findByEmail(email) {
      const found = [...users.values()].find(u => u.email === email);
      if (!found) throw new common.NotFoundException(); return found;
    },
    async findById(id) { if (!users.has(id)) throw new common.NotFoundException(); return users.get(id); },
    async findForAuthentication(id) { return this.findById(id); },
    async updatePassword(id, hash) { const u = await this.findById(id); u.passwordHash = hash; u.tokenVersion++; return { id }; },
  };
  const sessionRepository = {
    create: value => value,
    async save(value) { sessions.set(value.id, { ...value }); return value; },
    async findOneBy(where) { const s = sessions.get(where.id); return s && (!where.userId || s.userId === where.userId) ? { ...s } : null; },
    async update(where, patch) { for (const [id, s] of sessions) if ((!where.id || id === where.id) && (!where.userId || s.userId === where.userId)) sessions.set(id, { ...s, ...patch }); },
  };
  const revokedRepository = { async findOneBy(where) { return revoked.get(where.jti) ?? null; }, async upsert(value) { revoked.set(value.jti, value); } };
  const jwt = new JwtService({ secret: config.get("JWT_SECRET"), signOptions: { expiresIn: 300,
    issuer: config.get("JWT_TOKEN_ISSUER"), audience: config.get("JWT_TOKEN_AUDIENCE") } });
  const auth = new AuthService(userService, hashing, jwt, config, sessionRepository, revokedRepository, { async recordBestEffort() {} });
  new JwtStrategy(config, userService, sessionRepository, revokedRepository);
  const profile = { id: professionalId, userId };
  const exam = { id: examId, clinicId, requestedByProfessionalId: professionalId, resultText: "RESULTADO SINTÉTICO" };
  function query(profileQuery = false) {
    const params = {};
    const q = {
      where(sql, values) { Object.assign(params, values); return this; },
      andWhere(sql, values) { Object.assign(params, values); return this; },
      async getOne() {
        if (profileQuery) return params.userId === userId && params.clinicId === clinicId ? profile : null;
        return params.id === examId && params.clinicId === clinicId && params.professionalId === professionalId ? exam : null;
      },
    };
    for (const key of ["innerJoin", "leftJoin", "addSelect", "select", "setLock"]) q[key] = function(...args) {
      for (const value of args) if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(params, value);
      return this;
    };
    return q;
  }
  const manager = { getRepository: entity => entity === ProfessionalProfile
    ? { createQueryBuilder: () => query(true) }
    : entity === ExamType ? { async find() { return [{ id: randomUUID(), name: "Tipo sintético" }]; } }
    : { createQueryBuilder: () => query() } };
  const exams = new ExamsService({ manager }, { async recordSensitiveRead(event) { reads.push(event); } });
  const module = await Test.createTestingModule({
    controllers: [PolicyFixture, AuthController, UsersController, ClinicUsersController, ExamsController],
    providers: [
      { provide: ConfigService, useValue: config }, { provide: AuthService, useValue: auth },
      { provide: UserService, useValue: userService }, { provide: HashingService, useValue: hashing },
      { provide: ClinicUsersService, useValue: { async findByUser(id) { return [{ userId: id, clinicId }]; } } },
      { provide: ExamsService, useValue: exams },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  t.after(() => app.close());
  configureApplication(app);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new AuthorizationGuard(reflector));
  await app.listen(0, "127.0.0.1");
  function access(actor = user, patch = {}, options = {}) {
    const payload = { sub: actor.id, sid: randomUUID(), jti: randomUUID(), tokenVersion: actor.tokenVersion, type: "access", ...patch };
    sessions.set(payload.sid, { id: payload.sid, userId: actor.id, expiresAt: new Date(Date.now() + 300000) });
    return { token: jwt.sign(payload, options), payload };
  }
  const http = request(app.getHttpServer());
  const get = (url, token) => token ? http.get(url).auth(token, { type: "bearer" }) : http.get(url);
  return { http, get, user, users, access, clinicId, password, professionalId, examId, sessions, revoked, reads };
}

test("HTTP: missing policy returns 403 even to System Admin; absent JWT still returns 401", async t => {
  const f = await fixture(t);
  await f.get("/policy/missing").expect(401);
  await f.get("/policy/missing", f.access().token).expect(403);
  f.user.isSystemAdmin = true;
  const denied = await f.get("/policy/missing", f.access().token).expect(403);
  assert.equal(denied.headers["cache-control"], "no-store");
  assert.equal(denied.headers["x-powered-by"], undefined);
  assert.equal(denied.body.reached, undefined);
});
test("HTTP: Public is explicit and Authenticated requires a valid JWT", async t => {
  const f = await fixture(t);
  await f.get("/policy/public").expect(200);
  await f.get("/policy/public", "invalid-synthetic-token").expect(200);
  await f.get("/policy/authenticated").expect(401);
  await f.get("/policy/authenticated", "invalid-synthetic-token").expect(401);
  await f.get("/policy/authenticated", f.access().token).expect(200);
});
test("HTTP: expired/revoked/session-expired/wrong-version/wrong-type tokens and inactive User are rejected", async t => {
  const f = await fixture(t);
  await f.get("/policy/authenticated", f.access(f.user, {}, { expiresIn: -1 }).token).expect(401);
  const tokenRevoked = f.access(); f.revoked.set(tokenRevoked.payload.jti, { jti: tokenRevoked.payload.jti });
  await f.get("/policy/authenticated", tokenRevoked.token).expect(401);
  const sessionRevoked = f.access(); f.sessions.get(sessionRevoked.payload.sid).revokedAt = new Date();
  await f.get("/policy/authenticated", sessionRevoked.token).expect(401);
  const sessionExpired = f.access(); f.sessions.get(sessionExpired.payload.sid).expiresAt = new Date(0);
  await f.get("/policy/authenticated", sessionExpired.token).expect(401);
  await f.get("/policy/authenticated", f.access(f.user, { tokenVersion: 99 }).token).expect(401);
  await f.get("/policy/authenticated", f.access(f.user, { type: "refresh" }).token).expect(401);
  const inactive = f.access(); f.user.active = false;
  await f.get("/policy/authenticated", inactive.token).expect(401);
});
test("HTTP: global admin flag is separate from local roles; memberships and URL clinic stay enforced", async t => {
  const f = await fixture(t), token = f.access().token;
  await f.get("/policy/admin", token).expect(403);
  await f.get(`/policy/clinics/${f.clinicId}`, token).expect(200);
  await f.get(`/policy/clinics/${randomUUID()}`, token).set("x-clinic-id", f.clinicId).expect(403);
  for (const role of ["ADMIN", "RECEPTIONIST"]) {
    f.user.clinicUsers[0].role = role;
    await f.get("/policy/admin", token).expect(403);
    await f.get(`/policy/clinics/${f.clinicId}`, token).expect(403);
  }
  f.user.clinicUsers[0].role = "OPHTHALMOLOGIST";
  f.user.clinicUsers[0].active = false;
  await f.get(`/policy/clinics/${f.clinicId}`, token).expect(403);
  f.user.clinicUsers[0].active = true; f.user.clinicUsers[0].clinic.active = false;
  await f.get(`/policy/clinics/${f.clinicId}`, token).expect(403);
  f.user.clinicUsers = [];
  await f.get(`/policy/clinics/${f.clinicId}`, token).expect(403);
  f.user.isSystemAdmin = true;
  await f.get("/policy/admin", token).expect(200);
  await f.get(`/policy/clinics/${f.clinicId}`, token).expect(200); // Existing guard bypass; services still apply A02.
});
test("HTTP: real membership controller preserves self/global identity checks", async t => {
  const f = await fixture(t), token = f.access().token;
  await f.get(`/users/${f.user.id}/clinics`).expect(401);
  const own = await f.get(`/users/${f.user.id}/clinics`, token).expect(200);
  assert.equal(own.body[0].userId, f.user.id);
  const other = randomUUID();
  await f.get(`/users/${other}/clinics`, token).expect(403);
  f.user.isSystemAdmin = true;
  await f.get(`/users/${other}/clinics`, token).expect(200);
});
test("HTTP: own password-by-ID checks identity/current password and invalidates previous tokens", async t => {
  const f = await fixture(t), token = f.access().token;
  const patch = (id, currentPassword) => f.http.patch(`/users/${id}/password`).auth(token, { type: "bearer" })
    .send({ currentPassword, newPassword: "Synthetic-New-Password-123" });
  await patch(randomUUID(), f.password).expect(403);
  await patch(f.user.id, "Synthetic-Wrong-Password").expect(401);
  await patch(f.user.id, f.password).expect(200);
  await f.get("/policy/authenticated", token).expect(401);
});
test("HTTP: session password change and React-style cookie restoration remain functional", async t => {
  const f = await fixture(t);
  const login = await f.http.post("/auth/login").set("X-Medvita-Session", "1")
    .send({ email: f.user.email, password: f.password }).expect(201);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const restored = await f.http.post("/auth/refresh").set("X-Medvita-Session", "1").set("Cookie", cookie).expect(201);
  const token = restored.body.accessToken;
  await f.http.patch("/auth/change-password").auth(token, { type: "bearer" })
    .send({ currentPassword: f.password, newPassword: "Synthetic-Session-Password-123" }).expect(200);
  await f.get("/policy/authenticated", token).expect(401);
  await f.http.post("/auth/refresh").set("X-Medvita-Session", "1")
    .set("Cookie", restored.headers["set-cookie"][0].split(";")[0]).expect(401);
});
test("HTTP: physician exam access remains scoped/audited and grants no clinical access to administrative roles", async t => {
  const f = await fixture(t), token = f.access().token, base = `/clinics/${f.clinicId}/exams`;
  await f.get(`${base}/types`, token).expect(200);
  const result = await f.get(`${base}/${f.examId}`, token).expect(200);
  assert.equal(result.body.resultText, "RESULTADO SINTÉTICO");
  assert.ok(f.reads.some(e => e.resourceId === f.examId && e.action === "EXAM_READ"));
  await f.get(`${base}/${randomUUID()}`, token).expect(404);
  await f.get(`/clinics/${randomUUID()}/exams/${f.examId}`, token).expect(403);
  for (const role of ["ADMIN", "RECEPTIONIST"]) {
    f.user.clinicUsers[0].role = role;
    await f.get(`${base}/${f.examId}`, token).expect(403);
  }
  f.user.isSystemAdmin = true; f.user.clinicUsers = [];
  await f.get(`${base}/${f.examId}`, token).expect(403); // A02 remains in ExamsService, beyond the guard bypass.
});

test("A02: real local/clinical services still deny global admin without local membership", async () => {
  const actor = { sub: randomUUID(), isSystemAdmin: true, clinicRoles: [] }, clinic = randomUUID();
  const { AppointmentsService } = load("appointments/appointments.service");
  const { PatientsService } = load("patients/patients.service");
  const { EncountersService } = load("encounters/encounters.service");
  const { AuditService } = load("audit/audit.service");
  await assert.rejects(new AppointmentsService({}, {}, {}, {}).findAll(clinic, {}, actor), { status: 403 });
  await assert.rejects(new PatientsService({}, {}, {}).findAllByClinic(clinic, {}, actor), { status: 403 });
  await assert.rejects(new EncountersService({}, {}, {}).findAll(clinic, {}, actor), { status: 403 });
  await assert.rejects(new AuditService({}).findAll(clinic, {}, actor), { status: 403 });
});
