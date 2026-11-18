const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");
const { fixture } = require("./support/system-admin-fixture.cjs");

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

test("A02 HTTP: professionals keep global administration without elevating medical or reception roles", async t => {
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
  const otherAppointment = [...f.rows("Appointment").values()].find(a => a.professionalId === other.id);
  await f.write("patch", `/clinics/${f.a}/appointments/${otherAppointment.id}/cancel`, doctor, { reason: "Motivo sintético" }).expect(403);
  await f.write("patch", `/clinics/${f.a}/appointments/${otherAppointment.id}/reschedule`, doctor, { scheduledAt: payload.scheduledAt }).expect(403);
  await f.write("patch", `/clinics/${f.a}/appointments/${created.id}/reschedule`, doctor, { scheduledAt: payload.scheduledAt }).expect(200);
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
