// Full controller/service matrix, in-memory persistence and real JWT/HTTP only.
const { randomUUID, randomBytes } = require("node:crypto");
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { Reflector } = require("@nestjs/core");
const { ConfigService } = require("@nestjs/config");
const { JwtService } = require("@nestjs/jwt");
const { DataSource } = require("typeorm");
const request = require("supertest");
const load = name => require(`../../dist/${name}`);
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

async function fixture(t, { transactional = false } = {}) {
  const profileWrites = [];
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
  const locks = new Map(), lockEvents = [];
  let failAudit = false;
  // Optional deterministic row-lock/rollback simulator. No database is initialized.
  // Used only for same-appointment interleavings, not a PostgreSQL substitute.
  if (transactional) manager.transaction = async callback => {
    let release, snapshot;
    async function lock(id, mode) {
      if (release) return;
      if (mode !== "pessimistic_write") throw new Error("Expected appointment write lock");
      lockEvents.push({ id, phase: "waiting", mode });
      const previous = locks.get(id) ?? Promise.resolve();
      let unlock;
      const next = new Promise(resolve => { unlock = resolve; });
      locks.set(id, next);
      await previous;
      release = () => { unlock(); if (locks.get(id) === next) locks.delete(id); };
      snapshot = new Map([...maps].map(([C, table]) => [C, structuredClone([...table])]));
      lockEvents.push({ id, phase: "acquired", mode });
    }
    const tx = { getRepository(C) {
      const repo = repos.get(C);
      if (C !== entity.Appointment) return repo;
      return new Proxy(repo, { get(target, property) {
        if (property === "findOne") return async options => {
          if (options.lock) await lock(options.where.id, options.lock.mode);
          return target.findOne(options);
        };
        if (property === "createQueryBuilder") return (...args) => {
          const query = target.createQueryBuilder(...args), params = {};
          let mode;
          const proxy = new Proxy(query, { get(q, key) {
            if (key === "getOne") return async () => {
              if (mode) await lock(params.appointmentId ?? params.id, mode);
              return q.getOne();
            };
            if (typeof q[key] !== "function") return q[key];
            return (...values) => {
              if (key === "setLock") mode = values[0];
              if (["where", "andWhere"].includes(key)) Object.assign(params, values[1]);
              const result = q[key](...values);
              return result === q ? proxy : result;
            };
          } });
          return proxy;
        };
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      } });
    } };
    try { return await callback(tx); }
    catch (error) {
      if (snapshot) for (const [C, data] of snapshot) {
        const table = maps.get(C); table.clear();
        for (const [id, row] of data) table.set(id, Object.assign(new C(), row));
      }
      throw error;
    } finally { release?.(); }
  };
  for (const C of Object.values(entity)) {
    const table = maps.get(C);
    const repo = {
      manager,
      create: value => Object.assign(new C(), { active: true, tokenVersion: 0, isSystemAdmin: false }, value),
      async save(value) { if (C === entity.AuditLog && failAudit) { failAudit = false; throw new Error("Synthetic audit write failure"); } if (C === entity.ProfessionalProfile) profileWrites.push(value.id ?? "new"); value.id ??= randomUUID(); value.createdAt ??= new Date(); value.updatedAt = new Date(); table.set(value.id, value); return value; },
      async findOneBy(where) { return hydrate(C, [...table.values()].find(r => matches(r, where))); },
      async findOne({ where }) { return this.findOneBy(where); },
      async find({ where } = {}) { return [...table.values()].filter(r => matches(r, where)).map(r => hydrate(C, r)); },
      async countBy(where) { return [...table.values()].filter(r => matches(r, where)).length; },
      async existsBy(where) { return (await this.countBy(where)) > 0; },
      createQueryBuilder() {
        const params = {}, expressions = []; let offset = 0, limit = Infinity;
        function accepted(row) {
          if (params.clinicId && row.clinicId !== undefined && row.clinicId !== params.clinicId) return false;
          if (params.appointmentId && (C === entity.Appointment ? row.id : row.appointmentId) !== params.appointmentId) return false;
          for (const key of ["id", "patientId", "status", "crm", "crmState", "userId"]) {
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
  return { profileWrites, a, b, actors, rows, put, actor, token, http, get, write, values, principal, patientA, patientB,
    lockEvents, failNextAudit: () => { failAudit = true; } };
}


module.exports = { fixture };
