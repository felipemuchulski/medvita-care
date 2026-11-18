// Build first. Real Nest HTTP pipeline and JWT/RBAC; persistence is memory-only.
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const path = require("node:path");
const { test } = require("node:test");
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { Reflector } = require("@nestjs/core");
const { ConfigService } = require("@nestjs/config");
const { JwtService } = require("@nestjs/jwt");
const { DataSource } = require("typeorm");
const request = require("supertest");
const { configureApplication } = require("../dist/configure-app");
const { JwtStrategy } = require("../dist/auth/strategies/jwt.strategy");
const { JwtAuthGuard } = require("../dist/auth/guards/jwt-auth.guard");
const { AuthorizationGuard } = require("../dist/auth/guards/authorization.guard");
const { AppointmentsController } = require("../dist/appointments/appointments.controller");
const { AppointmentsService } = require("../dist/appointments/appointments.service");
const { Appointment } = require("../dist/appointments/entities/appointment.entity");
const { EncountersController } = require("../dist/encounters/encounters.controller");
const { EncountersService } = require("../dist/encounters/encounters.service");
const { Encounter } = require("../dist/encounters/entities/encounter.entity");
const { AuditService } = require("../dist/audit/audit.service");

// Do not import AppModule, configuration files, seeds or migrations.
DataSource.prototype.initialize = async () => {
  throw new Error("Database access forbidden in A01 tests");
};
const marker = "SYNTHETIC_CLINICAL_CONTENT";
const clinical = {
  chiefComplaint: marker,
  anamnesis: marker,
  clinicalAssessment: marker,
  plan: marker,
  clinicalNotes: marker,
  visualAcuityRight: marker,
  visualAcuityLeft: marker,
  intraocularPressureRight: 12,
  intraocularPressureLeft: 13,
  futureClinicalField: marker,
};

async function fixture(t) {
  const clinic = randomUUID(), patientId = randomUUID(), professionalId = randomUUID();
  const doctorId = randomUUID(), appointmentId = randomUUID();
  const patient = { id: patientId, name: "Paciente sintético", encounters: [clinical] };
  const professional = {
    id: professionalId, userId: doctorId, crm: "123456", crmState: "SP",
    user: { id: doctorId, name: "Médico sintético", passwordHash: marker, extra: clinical },
    encounters: [clinical],
  };
  const appointments = new Map(), encounters = new Map(), events = [];
  const future = new Date(Date.now() + 86400000);
  function seed() {
    appointments.clear(); encounters.clear(); events.length = 0;
    appointments.set(appointmentId, Object.assign(new Appointment(), {
      id: appointmentId, clinicId: clinic, patientId, professionalId,
      scheduledAt: future, endsAt: new Date(+future + 1800000), durationMinutes: 30,
      status: "SCHEDULED", reason: "Consulta sintética", notes: "Nota operacional",
      cancellationReason: null, cancelledAt: null, createdAt: new Date(), updatedAt: new Date(),
      patient, professional, unexpectedRelation: clinical,
    }));
  }
  seed();
  function hydrate(row, entity) {
    if (entity === Appointment) return Object.assign(new Appointment(), row, {
      patient, professional,
      encounter: [...encounters.values()].find(e => e.appointmentId === row.id) ?? null,
    });
    return Object.assign(new Encounter(), row, {
      patient, professional, appointment: appointments.get(row.appointmentId),
    });
  }
  function repository(entity, rows) {
    return {
      manager: null,
      create: value => Object.assign(new entity(), value),
      async save(value) {
        value.id ??= randomUUID(); value.createdAt ??= new Date(); value.updatedAt = new Date();
        rows.set(value.id, value); return value;
      },
      async existsBy(where) {
        return [...rows.values()].some(row => Object.entries(where).every(([k, v]) => row[k] === v));
      },
      async findOne({ where }) {
        const row = [...rows.values()].find(row => Object.entries(where).every(([k, v]) => row[k] === v));
        return row ? hydrate(row, entity) : null;
      },
      createQueryBuilder() {
        const params = {};
        function matches(row) {
          if (params.statuses) return false; // Existing overlap tests cover conflicts separately.
          return (!params.id || row.id === params.id) &&
            (!params.appointmentId || row.id === params.appointmentId) &&
            (!params.clinicId || row.clinicId === params.clinicId) &&
            (!params.currentUserId || professional.userId === params.currentUserId) &&
            (!params.patientId || row.patientId === params.patientId) &&
            (!params.professionalId || row.professionalId === params.professionalId) &&
            (!params.status || row.status === params.status);
        }
        const builder = {
          where(sql, values) { Object.assign(params, values); return this; },
          andWhere(sql, values) { Object.assign(params, values); return this; },
          async getOne() {
            const row = [...rows.values()].find(matches);
            return row ? hydrate(row, entity) : null;
          },
          async getManyAndCount() {
            const data = [...rows.values()].filter(matches).map(row => hydrate(row, entity));
            return [data, data.length];
          },
        };
        for (const method of ["innerJoin", "innerJoinAndSelect", "leftJoin", "leftJoinAndSelect", "addSelect", "orderBy", "addOrderBy", "skip", "take", "setLock"])
          builder[method] = function () { return this; };
        return builder;
      },
    };
  }
  const appointmentRepo = repository(Appointment, appointments);
  const encounterRepo = repository(Encounter, encounters);
  const manager = {
    getRepository: entity => entity === Appointment ? appointmentRepo : encounterRepo,
    transaction: callback => callback(manager),
  };
  appointmentRepo.manager = encounterRepo.manager = manager;
  let failClinicalReadAudit = false;
  const auditRepo = {
    create: value => value,
    async save(value) {
      if (failClinicalReadAudit && value.action === "ENCOUNTER_READ")
        throw new Error("Synthetic audit failure");
      events.push(value);
      return value;
    },
  };
  const audit = new AuditService(auditRepo);
  manager.getRepository = entity => entity === Appointment ? appointmentRepo
    : entity === Encounter ? encounterRepo : auditRepo;
  const appointmentService = new AppointmentsService(appointmentRepo,
    { async findActiveForClinic() { return patient; } },
    { async findActiveForClinic() { return professional; } }, audit);
  const encounterService = new EncountersService(encounterRepo, appointmentService, audit);
  const secret = randomBytes(32).toString("hex");
  const config = new ConfigService({ JWT_SECRET: secret, FRONTEND_URL: "http://localhost:5173" });
  const users = new Map();
  const jwt = new JwtService({ secret, signOptions: { expiresIn: 300 } });
  // Real Passport strategy, backed by synthetic users/sessions instead of TypeORM.
  new JwtStrategy(config, { async findForAuthentication(id) { return users.get(id); } },
    { async findOneBy(where) { return { id: where.id, userId: where.userId, expiresAt: new Date(Date.now() + 300000) }; } },
    { async findOneBy() { return null; } });
  const module = await Test.createTestingModule({
    controllers: [AppointmentsController, EncountersController],
    providers: [
      { provide: AppointmentsService, useValue: appointmentService },
      { provide: EncountersService, useValue: encounterService },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new AuthorizationGuard(reflector));
  t.after(() => app.close());
  await app.listen(0, "127.0.0.1");
  function token(role, id = role === "OPHTHALMOLOGIST" ? doctorId : randomUUID()) {
    users.set(id, {
      id, name: "Usuário sintético", email: "synthetic@example.invalid", active: true,
      tokenVersion: 0, isSystemAdmin: false,
      clinicUsers: [{ clinicId: clinic, role, active: true, clinic: { active: true } }],
    });
    return jwt.sign({ sub: id, sid: randomUUID(), jti: randomUUID(), type: "access", tokenVersion: 0 });
  }
  const base = `/clinics/${clinic}/appointments`;
  function http(method, url, access, body) {
    let call = request(app.getHttpServer())[method](url);
    if (access) call = call.auth(access, { type: "bearer" });
    if (body) call = call.send(body);
    return call;
  }
  return { clinic, patientId, professionalId, doctorId, appointmentId, future,
    appointments, encounters, events, seed, token, base, http,
    failClinicalReadAudit: () => { failClinicalReadAudit = true; } };
}

function assertSafe(body, expectedEncounter) {
  assert.deepEqual(body.encounter, expectedEncounter);
  assert.deepEqual(Object.keys(body).sort(), ["id", "clinicId", "patientId", "professionalId", "scheduledAt", "endsAt", "durationMinutes", "status", "reason", "notes", "cancellationReason", "cancelledAt", "createdAt", "updatedAt", "patient", "professional", "encounter"].sort());
  assert.deepEqual(Object.keys(body.patient).sort(), ["id", "name"]);
  assert.deepEqual(Object.keys(body.professional).sort(), ["id", "userId", "crm", "crmState", "user"].sort());
  assert.deepEqual(Object.keys(body.professional.user).sort(), ["id", "name"]);
  assert.equal(JSON.stringify(body).includes(marker), false);
  for (const field of Object.keys(clinical)) assert.equal(JSON.stringify(body).includes(`"${field}"`), false);
  assert.equal(body.notes, "Nota operacional");
}

for (const role of ["ADMIN", "RECEPTIONIST", "OPHTHALMOLOGIST"]) {
  test(`${role}: real HTTP list/detail expose only operational encounter metadata`, async t => {
    const f = await fixture(t), access = f.token(role), id = randomUUID();
    for (const status of ["IN_PROGRESS", "COMPLETED", "CANCELLED"]) {
      f.encounters.set(id, Object.assign(new Encounter(), clinical, {
        id, clinicId: f.clinic, appointmentId: f.appointmentId, status,
        cancellationReason: marker, patient: { clinical },
      }));
      const detail = await f.http("get", `${f.base}/${f.appointmentId}`, access).expect(200);
      assertSafe(detail.body, { id, status });
      const list = await f.http("get", f.base, access).expect(200);
      assertSafe(list.body.data[0], { id, status });
      assert.equal(list.body.meta.total, 1);
    }
    f.encounters.clear();
    assertSafe((await f.http("get", `${f.base}/${f.appointmentId}`, access).expect(200)).body, null);
  });
}

for (const role of ["ADMIN", "RECEPTIONIST"]) {
  test(`${role}: create/reschedule/cancel serialize the same safe response`, async t => {
    const f = await fixture(t), access = f.token(role);
    const created = await f.http("post", f.base, access, {
      patientId: f.patientId, professionalId: f.professionalId,
      scheduledAt: f.future.toISOString(), notes: "Nota operacional",
    }).expect(201);
    assertSafe(created.body, null);
    const id = created.body.id;
    const rescheduled = await f.http("patch", `${f.base}/${id}/reschedule`, access, {
      scheduledAt: new Date(+f.future + 3600000).toISOString(), durationMinutes: 45,
    }).expect(200);
    assertSafe(rescheduled.body, null);
    assert.equal(rescheduled.body.durationMinutes, 45);
    const cancelled = await f.http("patch", `${f.base}/${id}/cancel`, access, { reason: "Cancelamento sintético" }).expect(200);
    assertSafe(cancelled.body, null);
    assert.equal(cancelled.body.status, "CANCELLED");
    assert.deepEqual(f.events.map(e => e.action), ["APPOINTMENT_CREATED", "APPOINTMENT_RESCHEDULED", "APPOINTMENT_CANCELLED"]);
  });
}

test("ophthalmologist can create, start, read and complete own encounter through audited clinical endpoints", async t => {
  const f = await fixture(t), access = f.token("OPHTHALMOLOGIST");
  const created = await f.http("post", f.base, access, {
    patientId: f.patientId, professionalId: f.professionalId,
    scheduledAt: f.future.toISOString(), notes: "Nota operacional",
  }).expect(201);
  assertSafe(created.body, null);
  const started = await f.http("post", `/clinics/${f.clinic}/encounters`, access, { appointmentId: created.body.id }).expect(201);
  const id = started.body.id;
  assert.equal(started.body.status, "IN_PROGRESS");
  const payload = { ...clinical }; delete payload.futureClinicalField;
  const saved = await f.http("patch", `/clinics/${f.clinic}/encounters/${id}`, access, payload).expect(200);
  assert.equal(saved.body.anamnesis, marker);
  const read = await f.http("get", `/clinics/${f.clinic}/encounters/${id}`, access).expect(200);
  assert.equal(read.body.plan, marker);
  assertSafe((await f.http("get", `${f.base}/${created.body.id}`, access).expect(200)).body, { id, status: "IN_PROGRESS" });
  const completed = await f.http("patch", `/clinics/${f.clinic}/encounters/${id}/complete`, access, payload).expect(200);
  assert.equal(completed.body.status, "COMPLETED");
  assert.equal(completed.body.clinicalAssessment, marker);
  assertSafe((await f.http("get", `${f.base}/${created.body.id}`, access).expect(200)).body, { id, status: "COMPLETED" });
  assert.ok(f.events.some(e => e.action === "ENCOUNTER_STARTED"));
  assert.ok(f.events.some(e => e.action === "ENCOUNTER_COMPLETED"));
  assert.ok(f.events.some(e => e.action === "ENCOUNTER_READ" && e.resourceId === id));
  for (const role of ["ADMIN", "RECEPTIONIST"]) {
    const unauthorized = f.token(role);
    await f.http("get", `/clinics/${f.clinic}/encounters/${id}`, unauthorized).expect(403);
    assertSafe((await f.http("get", `${f.base}/${created.body.id}`, unauthorized).expect(200)).body, { id, status: "COMPLETED" });
  }
  const otherDoctor = f.token("OPHTHALMOLOGIST", randomUUID());
  await f.http("get", `/clinics/${f.clinic}/encounters/${id}`, otherDoctor).expect(404);
});

test("existing JWT, tenant, ownership and reschedule/cancel role restrictions remain enforced", async t => {
  const f = await fixture(t), access = f.token("OPHTHALMOLOGIST");
  await f.http("get", `${f.base}/${f.appointmentId}`).expect(401);
  await f.http("get", `/clinics/${randomUUID()}/appointments/${f.appointmentId}`, access).expect(403);
  await f.http("get", `${f.base}/${f.appointmentId}`, f.token("OPHTHALMOLOGIST", randomUUID())).expect(404);
  await f.http("patch", `${f.base}/${f.appointmentId}/reschedule`, access, { scheduledAt: f.future.toISOString() }).expect(403);
  await f.http("patch", `${f.base}/${f.appointmentId}/cancel`, access, { reason: "Motivo sintético" }).expect(403);
  assert.equal(f.events.length, 0);
});

test("clinical reads remain blocked when audit fails; availability returns only operational fields", async t => {
  const f = await fixture(t), access = f.token("OPHTHALMOLOGIST");
  const started = await f.http("post", `/clinics/${f.clinic}/encounters`, access, { appointmentId: f.appointmentId }).expect(201);
  Object.assign(f.encounters.get(started.body.id), clinical);
  f.failClinicalReadAudit();
  const blocked = await f.http("get", `/clinics/${f.clinic}/encounters/${started.body.id}`, access).expect(503);
  assert.equal(JSON.stringify(blocked.body).includes(marker), false);
  assertSafe((await f.http("get", `${f.base}/${f.appointmentId}`, access).expect(200)).body, { id: started.body.id, status: "IN_PROGRESS" });
  const availability = await f.http("get", `${f.base}/availability`, access).query({
    professionalId: f.professionalId, scheduledAt: f.future.toISOString(), durationMinutes: 30,
  }).expect(200);
  assert.deepEqual(Object.keys(availability.body).sort(), ["available", "conflict", "period"]);
  assert.equal(JSON.stringify(availability.body).includes(marker), false);
});

test("TypeORM generates SQL selecting encounter id/status without clinical columns, without connecting", async () => {
  const source = new DataSource({ type: "postgres", entities: [path.join(__dirname, "../dist/**/*.entity.js")] });
  await source.buildMetadatas(); // Metadata/query generation only; initialize is forbidden above.
  const service = new AppointmentsService(source.getRepository(Appointment), {}, {}, {});
  const sql = service.responseQuery().getSql();
  const selected = sql.slice(0, sql.indexOf(" FROM "));
  const columns = [...selected.matchAll(/"encounter"\."([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(columns.sort(), ["id", "status"]);
  assert.equal(source.isInitialized, false);
});
