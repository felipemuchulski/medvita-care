// Run after npm run build. In-memory repositories; no database connection.
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
process.env.NODE_PATH = path.resolve(__dirname, "../dist");
require("node:module")._initPaths();
require("reflect-metadata");
const { Reflector } = require("@nestjs/core");
const { AuthorizationGuard } = require("../dist/auth/guards/authorization.guard");
const { AppointmentsController } = require("../dist/appointments/appointments.controller");
const { AppointmentsService } = require("../dist/appointments/appointments.service");

function fixture(role = "OPHTHALMOLOGIST", membershipClinic = "clinic") {
  const user = { sub: "doctor", clinicRoles: [{ clinicId: membershipClinic, role }] };
  let saved;
  const audits = [];
  const query = {
    innerJoinAndSelect() { return this; },
    leftJoinAndSelect() { return this; },
    where() { return this; },
    andWhere() { return this; },
    orderBy() { return this; },
    async getOne() { return null; },
  };
  const repository = {
    createQueryBuilder() { return { ...query }; },
    create(value) { return value; },
    async save(value) { saved = { ...value, id: "appointment" }; return saved; },
    manager: { async transaction(callback) {
      return callback({ getRepository: () => repository });
    } },
  };
  const service = new AppointmentsService(repository,
    { async findActiveForClinic() { return { active: true }; } },
    { async findActiveForClinic(clinic, id) { return { userId: id === "own" ? "doctor" : "other" }; } },
    { async record(entry) { audits.push(entry); } },
  );
  // Persistence authorization is tested separately from response hydration.
  service.findById = async () => saved;
  const dto = { patientId: "patient", professionalId: "own", scheduledAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30 };
  return { service, user, dto, repository, audits, saved: () => saved };
}

test("controller guard accepts ophthalmologists only in their clinic", () => {
  const guard = new AuthorizationGuard(new Reflector());
  const { user } = fixture();
  const context = clinicId => ({
    getHandler: () => AppointmentsController.prototype.create,
    getClass: () => AppointmentsController,
    switchToHttp: () => ({ getRequest: () => ({ user, params: { clinicId } }) }),
  });
  assert.equal(guard.canActivate(context("clinic")), true);
  assert.throws(() => guard.canActivate(context("other-clinic")), { status: 403 });
});

test("ophthalmologist creates an appointment in their own agenda with audit", async () => {
  const f = fixture();
  const result = await f.service.create("clinic", f.dto, f.user);
  assert.equal(result.professionalId, "own");
  assert.equal(result.clinicId, "clinic");
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].actorId, "doctor");
});

test("ophthalmologist cannot create for another professional or clinic", async () => {
  for (const otherClinic of [false, true]) {
    const f = fixture("OPHTHALMOLOGIST", otherClinic ? "other-clinic" : "clinic");
    if (!otherClinic) f.dto.professionalId = "other";
    await assert.rejects(f.service.create("clinic", f.dto, f.user), { status: 403 });
    assert.equal(f.saved(), undefined);
    assert.equal(f.audits.length, 0);
  }
});

test("admins and receptionists can still schedule for other professionals", async () => {
  for (const role of ["ADMIN", "RECEPTIONIST"]) {
    const f = fixture(role);
    f.dto.professionalId = "other";
    assert.equal((await f.service.create("clinic", f.dto, f.user)).professionalId, "other");
  }
});

test("overlapping appointments remain blocked for ophthalmologists", async () => {
  const f = fixture();
  const originalQuery = f.repository.createQueryBuilder();
  f.repository.createQueryBuilder = () => ({ ...originalQuery, async getOne() { return { id: "conflict" }; } });
  await assert.rejects(f.service.create("clinic", f.dto, f.user), { status: 409 });
  assert.equal(f.saved(), undefined);
});
