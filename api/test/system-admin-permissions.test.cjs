// Full controller/service matrix, in-memory persistence and real JWT/HTTP only.
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { test } = require("node:test");
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { Reflector } = require("@nestjs/core");
const { ConfigService } = require("@nestjs/config");
const { JwtService } = require("@nestjs/jwt");
const { DataSource } = require("typeorm");
const request = require("supertest");
const load = name => require(`../dist/${name}`);
const { configureApplication } = load("configure-app");
const { JwtStrategy } = load("auth/strategies/jwt.strategy");
const { JwtAuthGuard } = load("auth/guards/jwt-auth.guard");
const { AuthorizationGuard } = load("auth/guards/authorization.guard");
const { HashingService } = load("common/hashing/hashing.service");
const { BcryptService } = load("common/hashing/bcrypt.service");
const modules = [
  ["users", "UserService", "UsersController", "user.service", "User", "user"],
  ["clinics", "ClinicService", "ClinicController", "clinics.service", "Clinic", "clinic"],
  ["clinic-users", "ClinicUsersService", "ClinicUsersController", "clinic-users.service", "ClinicUser", "clinic-user"],
  ["professionals", "ProfessionalsService", "ProfessionalsController", "professionals.service", "ProfessionalProfile", "professional-profile"],
  ["patients", "PatientsService", "PatientsController", "patients.service", "Patient", "patient"],
  ["appointments", "AppointmentsService", "AppointmentsController", "appointments.service", "Appointment", "appointment"],
  ["encounters", "EncountersService", "EncountersController", "encounters.service", "Encounter", "encounter"],
  ["exams", "ExamsService", "ExamsController", "exams.service", "Exam", "exam"],
  ["audit", "AuditService", "AuditController", "audit.service", "AuditLog", "audit-log"],
];
const entity = {}, serviceClass = {}, controllers = [];
for (const [dir, service, controller, file, model, entityFile] of modules) {
  entity[model] = load(`${dir}/entities/${entityFile}.entity`)[model];
  serviceClass[service] = load(`${dir}/${file}`)[service];
  controllers.push(load(`${dir}/${dir}.controller`)[controller]);
}
entity.ExamType = load("exams/entities/exam-type.entity").ExamType;
DataSource.prototype.initialize = async () => { throw new Error("Database forbidden in A02 tests"); };

async function fixture(t) {
  const maps = new Map(Object.values(entity).map(C => [C, new Map()]));
  const rows = name => maps.get(entity[name]);
  const a = randomUUID(), b = randomUUID();
  function put(name, data) {
    const row = Object.assign(new entity[name](), { id: randomUUID(), active: true, createdAt: new Date(), updatedAt: new Date() }, data);
    rows(name).set(row.id, row); return row;
  }
  put("Clinic", { id: a, name: "Clínica sintética A", document: "11111111000111" });
  put("Clinic", { id: b, name: "Clínica sintética B", document: "22222222000122" });
  function actor(role, global = false, clinicId = a) {
    const user = put("User", { name: "Usuário sintético", email: `${randomUUID()}@example.invalid`, tokenVersion: 0, isSystemAdmin: global });
    if (role) put("ClinicUser", { userId: user.id, clinicId, role });
    if (role === "OPHTHALMOLOGIST") put("ProfessionalProfile", { userId: user.id, crm: String(rows("ProfessionalProfile").size + 1000), crmState: "SP", rqe: null, specialty: "Oftalmologia" });
    return user;
  }
  const actors = { global: actor(null, true), globalAdmin: actor("ADMIN", true), globalDoctor: actor("OPHTHALMOLOGIST", true),
    admin: actor("ADMIN"), receptionist: actor("RECEPTIONIST"), doctor: actor("OPHTHALMOLOGIST"), unlinked: actor(null), otherDoctor: actor("OPHTHALMOLOGIST", false, b) };
  const patientA = put("Patient", { clinicId: a, name: "Paciente sintético A", birthDate: "2000-01-01", cpf: null });
  const patientB = put("Patient", { clinicId: b, name: "Paciente sintético B", birthDate: "2000-01-01", cpf: null });
  const examType = put("ExamType", { name: "Tipo sintético", code: "SYNTHETIC", isActive: true });
  for (const [name, user] of Object.entries(actors)) {
    const profile = [...rows("ProfessionalProfile").values()].find(p => p.userId === user.id);
    if (!profile) continue;
    const clinicId = name === "otherDoctor" ? b : a;
    const patientId = clinicId === a ? patientA.id : patientB.id;
    const scheduledAt = new Date(Date.now() + 86400000);
    const appointment = put("Appointment", { clinicId, patientId, professionalId: profile.id, scheduledAt,
      endsAt: new Date(+scheduledAt + 1800000), durationMinutes: 30, status: "COMPLETED", reason: null, notes: null, cancellationReason: null, cancelledAt: null });
    const encounter = put("Encounter", { clinicId, patientId, professionalId: profile.id, appointmentId: appointment.id,
      status: "COMPLETED", startedAt: new Date(), chiefComplaint: "QUEIXA SINTÉTICA", anamnesis: "ANAMNESE SINTÉTICA", clinicalAssessment: "AVALIAÇÃO SINTÉTICA", plan: "PLANO SINTÉTICO" });
    put("Exam", { clinicId, patientId, requestedByProfessionalId: profile.id, encounterId: encounter.id, examTypeId: examType.id,
      status: "COMPLETED", requestedAt: new Date(), resultText: "RESULTADO SINTÉTICO" });
  }
  function hydrate(C, row) {
    if (!row) return null;
    const copy = Object.assign(new C(), row);
    if (C === entity.User) copy.clinicUsers = [...rows("ClinicUser").values()].filter(m => m.userId === row.id).map(m => Object.assign(new entity.ClinicUser(), m, { clinic: rows("Clinic").get(m.clinicId) }));
    if (C === entity.ClinicUser) { copy.user = hydrate(entity.User, rows("User").get(row.userId)); copy.clinic = rows("Clinic").get(row.clinicId); }
    if (C === entity.ProfessionalProfile) copy.user = hydrate(entity.User, rows("User").get(row.userId));
    if ([entity.Appointment, entity.Encounter, entity.Exam].includes(C)) {
      copy.patient = rows("Patient").get(row.patientId);
      const profile = hydrate(entity.ProfessionalProfile, rows("ProfessionalProfile").get(row.professionalId ?? row.requestedByProfessionalId));
      if (C === entity.Exam) { copy.requestedByProfessional = profile; copy.examType = rows("ExamType").get(row.examTypeId); }
      else copy.professional = profile;
      if (C === entity.Appointment) copy.encounter = [...rows("Encounter").values()].find(e => e.appointmentId === row.id) ?? null;
      if (C === entity.Encounter) copy.appointment = rows("Appointment").get(row.appointmentId);
    }
    return copy;
  }
  const repos = new Map();
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
  const manager = { getRepository: C => repos.get(C), transaction: callback => callback(manager) };
  for (const C of Object.values(entity)) {
    const table = maps.get(C);
    const repo = {
      manager,
      create: value => Object.assign(new C(), { active: true, tokenVersion: 0, isSystemAdmin: false }, value),
      async save(value) { value.id ??= randomUUID(); value.createdAt ??= new Date(); value.updatedAt = new Date(); table.set(value.id, value); return value; },
      async findOneBy(where) { return hydrate(C, [...table.values()].find(r => matches(r, where))); },
      async findOne({ where }) { return this.findOneBy(where); },
      async find({ where } = {}) { return [...table.values()].filter(r => matches(r, where)).map(r => hydrate(C, r)); },
      async countBy(where) { return [...table.values()].filter(r => matches(r, where)).length; },
      async existsBy(where) { return (await this.countBy(where)) > 0; },
      createQueryBuilder() {
        const params = {}, expressions = []; let offset = 0, limit = Infinity;
        function accepted(row) {
          if (params.clinicId && row.clinicId !== undefined && row.clinicId !== params.clinicId) return false;
          for (const key of ["id", "patientId", "status", "crm", "crmState", "userId", "appointmentId"]) {
            if (params[key] !== undefined && row[key] !== params[key]) return false;
          }
          if (C === entity.ProfessionalProfile) {
            const user = rows("User").get(row.userId), clinic = rows("Clinic").get(params.clinicId);
            const membership = [...rows("ClinicUser").values()].some(m => m.userId === row.userId && m.clinicId === params.clinicId && m.role === "OPHTHALMOLOGIST" && m.active);
            if (!user?.active || !clinic?.active || !membership) return false;
          }
          if (params.currentUserId) {
            const userId = C === entity.ProfessionalProfile ? row.userId : rows("ProfessionalProfile").get(row.professionalId)?.userId;
            if (userId !== params.currentUserId) return false;
          }
          if (params.professionalId && (C === entity.Exam ? row.requestedByProfessionalId : row.professionalId ?? row.id) !== params.professionalId) return false;
          if (C === entity.ClinicUser && params.role && row.role !== params.role) return false;
          if (C === entity.ClinicUser && expressions.some(e => e.includes("membership.active = true")) && !row.active) return false;
          if (params.statuses) return params.statuses.includes(row.status) && row.scheduledAt < params.end && row.endsAt > params.start && row.id !== params.excludeAppointmentId;
          return true;
        }
        const q = {
          where(sql, values) { expressions.push(sql); Object.assign(params, values); return this; },
          andWhere(sql, values) { expressions.push(sql); Object.assign(params, values); return this; },
          skip(value) { offset = value; return this; }, take(value) { limit = value; return this; },
          async getOne() { return hydrate(C, [...table.values()].find(accepted)); },
          async getMany() { return [...table.values()].filter(accepted).slice(offset, offset + limit).map(r => hydrate(C, r)); },
          async getManyAndCount() { return [await this.getMany(), [...table.values()].filter(accepted).length]; },
        };
        for (const method of ["innerJoin", "innerJoinAndSelect", "leftJoin", "leftJoinAndSelect", "select", "addSelect", "orderBy", "addOrderBy", "setLock"])
          q[method] = function(...args) { for (const value of args) if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(params, value); return this; };
        return q;
      },
    };
    repos.set(C, repo);
  }
  const hashing = new BcryptService(), values = {};
  const R = name => repos.get(entity[name]);
  values.UserService = new serviceClass.UserService(R("User"), hashing);
  values.ClinicService = new serviceClass.ClinicService(R("Clinic"));
  values.AuditService = new serviceClass.AuditService(R("AuditLog"));
  values.ClinicUsersService = new serviceClass.ClinicUsersService(R("ClinicUser"), values.ClinicService, values.UserService, values.AuditService);
  values.ProfessionalsService = new serviceClass.ProfessionalsService(R("ProfessionalProfile"), values.ClinicService, values.UserService, values.ClinicUsersService);
  values.PatientsService = new serviceClass.PatientsService(R("Patient"), values.ClinicService, values.AuditService);
  values.AppointmentsService = new serviceClass.AppointmentsService(R("Appointment"), values.PatientsService, values.ProfessionalsService, values.AuditService);
  values.EncountersService = new serviceClass.EncountersService(R("Encounter"), values.AppointmentsService, values.AuditService);
  values.ExamsService = new serviceClass.ExamsService(R("Exam"), values.AuditService);
  const config = new ConfigService({ NODE_ENV: "test", FRONTEND_URL: "http://localhost:5173", JWT_SECRET: randomBytes(32).toString("hex") });
  const jwt = new JwtService({ secret: config.get("JWT_SECRET"), signOptions: { expiresIn: 300 } });
  const sessions = new Map();
  new JwtStrategy(config, values.UserService, { async findOneBy(where) { return sessions.get(where.id) ?? null; } }, { async findOneBy() { return null; } });
  const module = await Test.createTestingModule({ controllers, providers: [
    { provide: ConfigService, useValue: config }, { provide: HashingService, useValue: hashing },
    ...Object.entries(values).map(([name, value]) => ({ provide: serviceClass[name], useValue: value })),
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  t.after(() => app.close()); configureApplication(app);
  const reflector = app.get(Reflector); app.useGlobalGuards(new JwtAuthGuard(reflector), new AuthorizationGuard(reflector));
  await app.listen(0, "127.0.0.1");
  function token(user) {
    const sid = randomUUID(); sessions.set(sid, { id: sid, userId: user.id, expiresAt: new Date(Date.now() + 300000) });
    return jwt.sign({ sub: user.id, sid, jti: randomUUID(), type: "access", tokenVersion: user.tokenVersion });
  }
  const http = request(app.getHttpServer());
  const get = (url, user) => http.get(url).auth(token(user), { type: "bearer" });
  const write = (method, url, user, body) => http[method](url).auth(token(user), { type: "bearer" }).send(body);
  const principal = user => ({ sub: user.id, isSystemAdmin: user.isSystemAdmin,
    clinicRoles: [...rows("ClinicUser").values()].filter(m => m.userId === user.id && m.active && rows("Clinic").get(m.clinicId)?.active).map(m => ({ clinicId: m.clinicId, role: m.role })) });
  return { a, b, actors, rows, put, actor, token, http, get, write, values, principal, patientA, patientB };
}

const matrix = {
  global: [200, 200, 200, 200, 200, 403, 403, 403, 403, 403],
  globalAdmin: [200, 200, 200, 200, 200, 200, 200, 403, 403, 200],
  globalDoctor: [200, 200, 200, 200, 200, 200, 200, 200, 200, 403],
  admin: [403, 403, 200, 200, 200, 200, 200, 403, 403, 200],
  receptionist: [403, 403, 200, 200, 200, 200, 200, 403, 403, 403],
  doctor: [403, 403, 200, 200, 200, 200, 200, 200, 200, 403],
  unlinked: [403, 403, 403, 403, 403, 403, 403, 403, 403, 403],
};
for (const [name, statuses] of Object.entries(matrix)) test(`A02 HTTP matrix: ${name} across all nine administrative/clinical modules`, async t => {
  const f = await fixture(t), actor = f.actors[name];
  const paths = ["/users", "/clinics", `/clinics/${f.a}`, `/clinics/${f.a}/users`, `/clinics/${f.a}/professionals`,
    `/clinics/${f.a}/patients`, `/clinics/${f.a}/appointments`, `/clinics/${f.a}/encounters`, `/clinics/${f.a}/exams`, `/clinics/${f.a}/audit-logs`];
  for (let i = 0; i < paths.length; i++) {
    const response = await f.get(paths[i], actor).expect(statuses[i]);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["x-powered-by"], undefined);
    if (statuses[i] === 403) assert.equal(JSON.stringify(response.body).includes("SINTÉTICO"), false);
  }
});

test("A02 HTTP: global administrative writes still work without local membership", async t => {
  const f = await fixture(t), actor = f.actors.global;
  const user = (await f.write("post", "/users", actor, { name: "Novo sintético", email: "new@example.invalid", password: "Synthetic-Password-123" }).expect(201)).body;
  await f.get(`/users/${user.id}`, actor).expect(200);
  await f.write("patch", `/users/${user.id}`, actor, { name: "Nome atualizado" }).expect(200);
  const clinic = (await f.write("post", "/clinics", actor, { name: "Nova clínica sintética", document: "33333333000133" }).expect(201)).body;
  await f.write("patch", `/clinics/${clinic.id}`, actor, { name: "Clínica atualizada" }).expect(200);
  await f.get(`/clinics/document/${clinic.document}`, actor).expect(200);
  await f.write("post", `/clinics/${clinic.id}/users`, actor, { userId: user.id, role: "ADMIN" }).expect(201);
  await f.write("post", `/clinics/${clinic.id}/users`, actor, { userId: f.actors.unlinked.id, role: "RECEPTIONIST" }).expect(201);
  await f.write("patch", `/clinics/${clinic.id}/users/${f.actors.unlinked.id}/role`, actor, { role: "ADMIN" }).expect(200);
  await f.write("patch", `/clinics/${clinic.id}/users/${user.id}/active`, actor, { active: false }).expect(200);
  await f.write("patch", `/clinics/${clinic.id}/active`, actor, { active: false }).expect(200);
  await f.get(`/clinics/${clinic.id}`, actor).expect(200);
  await f.write("patch", `/users/${user.id}/active`, actor, { active: false }).expect(200);
});

test("A02 HTTP: professionals remain administrative; no A04 remodel or new local privileges", async t => {
  const f = await fixture(t), global = f.actors.global;
  const eligible = f.actor("OPHTHALMOLOGIST");
  const prior = [...f.rows("ProfessionalProfile").values()].find(p => p.userId === eligible.id);
  f.rows("ProfessionalProfile").delete(prior.id);
  const profile = (await f.write("post", `/clinics/${f.a}/professionals`, global,
    { userId: eligible.id, crm: "987654", crmState: "SP" }).expect(201)).body;
  await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, global, { specialty: "Oftalmologia sintética" }).expect(200);
  for (const actor of [f.actors.receptionist, f.actors.doctor])
    await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, actor, { specialty: "Negado" }).expect(403);
});

test("A02 HTTP: authorship, tenant isolation and minimal A01 response for global physicians", async t => {
  const f = await fixture(t), actor = f.actors.globalDoctor;
  const ownProfile = [...f.rows("ProfessionalProfile").values()].find(p => p.userId === actor.id);
  const own = [...f.rows("Encounter").values()].find(e => e.professionalId === ownProfile.id);
  const other = [...f.rows("Encounter").values()].find(e => e.professionalId !== ownProfile.id && e.clinicId === f.a);
  await f.get(`/clinics/${f.a}/encounters/${own.id}`, actor).expect(200);
  await f.get(`/clinics/${f.a}/encounters/${other.id}`, actor).expect(404);
  await f.get(`/clinics/${f.a}/appointments/${other.appointmentId}`, actor).expect(404);
  await f.get(`/clinics/${f.a}/patients/${f.patientA.id}/encounters`, actor).expect(200); // Shared history unchanged.
  const exam = [...f.rows("Exam").values()].find(e => e.requestedByProfessionalId === ownProfile.id);
  await f.get(`/clinics/${f.a}/exams/${exam.id}`, actor).expect(200);
  const foreign = [...f.rows("Exam").values()].find(e => e.requestedByProfessionalId !== ownProfile.id && e.clinicId === f.a);
  await f.get(`/clinics/${f.a}/exams/${foreign.id}`, actor).expect(404);
  const detail = await f.get(`/clinics/${f.a}/appointments/${own.appointmentId}`, actor).expect(200);
  assert.deepEqual(detail.body.encounter, { id: own.id, status: "COMPLETED" });
  assert.equal(JSON.stringify(detail.body).includes("ANAMNESE SINTÉTICA"), false);
  for (const name of ["global", "globalAdmin", "globalDoctor", "admin", "receptionist", "doctor", "unlinked"]) {
    const actor = f.actors[name];
    for (const module of ["patients", "appointments", "encounters", "exams", "audit-logs"])
      await f.get(`/clinics/${f.b}/${module}`, actor).expect(403);
    await f.get(`/clinics/${f.a}/patients/${f.patientB.id}`, actor).expect(name === "global" || name === "unlinked" ? 403 : 404);
  }
});

test("A02 HTTP: global flag does not elevate clinical write permissions or local physician ownership", async t => {
  const f = await fixture(t), global = f.actors.global, admin = f.actors.globalAdmin, doctor = f.actors.globalDoctor;
  const profiles = [...f.rows("ProfessionalProfile").values()];
  const own = profiles.find(p => p.userId === doctor.id), other = profiles.find(p => p.userId === f.actors.doctor.id);
  const payload = { patientId: f.patientA.id, professionalId: own.id, scheduledAt: new Date(Date.now() + 172800000).toISOString() };
  await f.write("post", `/clinics/${f.a}/appointments`, global, payload).expect(403);
  const created = (await f.write("post", `/clinics/${f.a}/appointments`, doctor, payload).expect(201)).body;
  await f.write("post", `/clinics/${f.a}/appointments`, doctor, { ...payload, professionalId: other.id }).expect(403);
  await f.write("patch", `/clinics/${f.a}/appointments/${created.id}/cancel`, doctor, { reason: "Motivo sintético" }).expect(403);
  await f.write("patch", `/clinics/${f.a}/appointments/${created.id}/reschedule`, doctor, { scheduledAt: payload.scheduledAt }).expect(403);
  for (const actor of [global, admin]) {
    await f.write("post", `/clinics/${f.a}/encounters`, actor, { appointmentId: created.id }).expect(403);
    await f.write("post", `/clinics/${f.a}/exams`, actor, {}).expect(403);
  }
  await f.write("patch", `/clinics/${f.a}/appointments/${created.id}/cancel`, admin, { reason: "Motivo sintético" }).expect(200);
});

test("A02 HTTP: inactive users/memberships/clinics and anonymous requests stay restricted", async t => {
  const f = await fixture(t), global = f.actors.global;
  await f.http.get("/users").expect(401);
  global.active = false;
  await f.get("/users", global).expect(401); global.active = true;
  const local = f.actors.doctor;
  const membership = [...f.rows("ClinicUser").values()].find(m => m.userId === local.id);
  membership.active = false;
  await f.get(`/clinics/${f.a}/patients`, local).expect(403);
  await f.get(`/clinics/${f.a}/users`, local).expect(403);
  membership.active = true; f.rows("Clinic").get(f.a).active = false;
  for (const name of ["global", "globalAdmin", "globalDoctor", "admin", "receptionist", "doctor"])
    for (const module of ["patients", "appointments", "encounters", "exams", "audit-logs"])
      await f.get(`/clinics/${f.a}/${module}`, f.actors[name]).expect(403);
  await f.get(`/clinics/${f.a}`, global).expect(200);
  await f.get(`/clinics/${f.a}/users`, global).expect(200);
  await f.get(`/clinics/${f.a}/professionals`, global).expect(400); // Existing active-clinic rule preserved.
});

test("A02 services enforce administrative authorization without relying on the HTTP guard", async t => {
  const f = await fixture(t), { UserService: users, ClinicService: clinics, ClinicUsersService: memberships } = f.values;
  const local = f.principal(f.actors.doctor), global = f.principal(f.actors.global), admin = f.principal(f.actors.admin);
  const denied = promise => assert.rejects(promise, { status: 403 });
  await denied(users.findAll({}, local));
  await denied(users.createUser({}, local));
  await denied(users.findByIdForAdmin(f.actors.admin.id, local));
  await denied(users.updateUser(f.actors.admin.id, {}, local));
  await denied(users.updateActive(f.actors.admin.id, { active: false }, local));
  await denied(clinics.findAll(local)); await denied(clinics.create({}, local));
  await denied(clinics.findByDocument("synthetic", local));
  await denied(clinics.updateActive(f.a, { active: false }, local));
  await denied(clinics.updateClinic(f.a, {}, local));
  await denied(clinics.findByIdForUser(f.b, admin));
  await denied(memberships.create(f.a, {}, local));
  await denied(memberships.updateRole(f.a, f.actors.admin.id, {}, local));
  await denied(memberships.updateActive(f.a, f.actors.admin.id, {}, local));
  await denied(memberships.findByClinic(f.b, admin));
  await denied(memberships.findByUser(f.actors.admin.id, local));
  assert.ok((await users.findAll({}, global)).length);
  assert.equal((await clinics.findByIdForUser(f.a, global)).id, f.a);
  assert.ok((await memberships.findByClinic(f.a, global)).length);
  assert.equal((await memberships.findByUser(f.actors.doctor.id, local))[0].userId, f.actors.doctor.id);
  assert.equal((await memberships.findByUser(f.actors.admin.id, global))[0].userId, f.actors.admin.id);
});
