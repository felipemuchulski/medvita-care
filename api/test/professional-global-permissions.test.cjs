const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");
const { fixture } = require("./support/system-admin-fixture.cjs");

function shared(f) {
  const user = f.actors.doctor;
  const profile = [...f.rows("ProfessionalProfile").values()].find(p => p.userId === user.id);
  f.put("ClinicUser", { clinicId: f.b, userId: user.id, role: "OPHTHALMOLOGIST" });
  const adminB = f.actor("ADMIN", false, f.b);
  return { user, profile, adminB };
}
const snapshot = f => JSON.stringify([...f.rows("ProfessionalProfile").values()]);
const fields = { crm: "A-9876", crmState: "rj", rqe: "RQE-123", specialty: " Oftalmologia sintética " };

test("A04: admins A/B cannot update any global attribute, through HTTP or direct service, without writes", async t => {
  const f = await fixture(t), { profile, adminB } = shared(f), before = snapshot(f);
  for (const [actor, clinic] of [[f.actors.admin, f.a], [adminB, f.b]]) {
    for (const [field, value] of Object.entries(fields)) {
      const response = await f.write("patch", `/clinics/${clinic}/professionals/${profile.id}`, actor, { [field]: value }).expect(403);
      assert.equal(response.body.message, "Acesso restrito a administradores do sistema.");
      assert.equal(response.headers["cache-control"], "no-store");
      assert.equal(response.headers["x-powered-by"], undefined);
    }
    await assert.rejects(f.values.ProfessionalsService.update(clinic, profile.id, fields, f.principal(actor)), { status: 403 });
  }
  assert.equal(snapshot(f), before);
  assert.equal(f.profileWrites.length, 0);
});

test("A04: global admin updates one shared profile; authorized A/B reads reflect it and clinical records are preserved", async t => {
  const f = await fixture(t), { profile, user, adminB } = shared(f);
  const clinical = () => JSON.stringify([...["Appointment", "Encounter", "Exam"].map(name => [...f.rows(name).values()])]);
  const before = clinical();
  const count = f.rows("ProfessionalProfile").size;
  const response = await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, f.actors.global, fields).expect(200);
  assert.equal(response.body.id, profile.id);
  assert.equal(response.body.userId, user.id);
  assert.equal(response.body.crm, "A9876");
  assert.equal(response.body.crmState, "RJ");
  assert.equal(response.body.rqe, "RQE123");
  assert.equal(response.body.specialty, "Oftalmologia sintética");
  for (const [clinic, actor] of [[f.a, f.actors.admin], [f.b, adminB]]) {
    for (const suffix of [profile.id, `user/${user.id}`, "crm/A9876/RJ"]) {
      const read = await f.get(`/clinics/${clinic}/professionals/${suffix}`, actor).expect(200);
      assert.equal(read.body.id, profile.id); assert.equal(read.body.crm, "A9876");
    }
    const list = await f.get(`/clinics/${clinic}/professionals`, actor).expect(200);
    assert.equal(list.body.filter(p => p.userId === user.id).length, 1);
  }
  assert.equal(f.rows("ProfessionalProfile").size, count);
  assert.equal(clinical(), before);
  const appointment = [...f.rows("Appointment").values()].find(a => a.professionalId === profile.id);
  const detail = await f.get(`/clinics/${f.a}/appointments/${appointment.id}`, user).expect(200);
  assert.equal(detail.body.professional.crm, "A9876");
  assert.deepEqual(Object.keys(detail.body.encounter).sort(), ["id", "status"]);
  const encounter = [...f.rows("Encounter").values()].find(e => e.professionalId === profile.id);
  await f.get(`/clinics/${f.a}/encounters/${encounter.id}`, user).expect(200);
  assert.equal(f.profileWrites.length, 1);
});

test("A04: ophthalmologist, receptionist and unlinked user cannot edit, including direct calls", async t => {
  const f = await fixture(t), { profile } = shared(f), before = snapshot(f);
  for (const actor of [f.actors.doctor, f.actors.receptionist, f.actors.unlinked]) {
    await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, actor, fields).expect(403);
    await assert.rejects(f.values.ProfessionalsService.update(f.a, profile.id, fields, f.principal(actor)), { status: 403 });
  }
  await f.http.patch(`/clinics/${f.a}/professionals/${profile.id}`).send(fields).expect(401);
  assert.equal(snapshot(f), before); assert.equal(f.profileWrites.length, 0);
});

test("A04: local admin still creates an eligible profile, with defaults, and cannot duplicate it through clinic B", async t => {
  const f = await fixture(t), { adminB } = shared(f);
  const eligible = f.actor("OPHTHALMOLOGIST");
  const old = [...f.rows("ProfessionalProfile").values()].find(p => p.userId === eligible.id);
  f.rows("ProfessionalProfile").delete(old.id); // Synthetic fixture: eligible user has no profile yet.
  f.put("ClinicUser", { clinicId: f.b, userId: eligible.id, role: "OPHTHALMOLOGIST" });
  const body = { userId: eligible.id, crm: "NEW-123", crmState: "sp" };
  const created = await f.write("post", `/clinics/${f.a}/professionals`, f.actors.admin, body).expect(201);
  assert.equal(created.body.crm, "NEW123"); assert.equal(created.body.rqe, null);
  assert.equal(created.body.specialty, "Oftalmologia");
  await f.write("post", `/clinics/${f.b}/professionals`, adminB, body).expect(409);
  await f.write("post", `/clinics/${f.a}/professionals`, f.actors.admin, body).expect(409);
  await f.write("patch", `/clinics/${f.a}/professionals/${created.body.id}`, f.actors.admin, { rqe: "123" }).expect(403);
  assert.equal([...f.rows("ProfessionalProfile").values()].filter(p => p.userId === eligible.id).length, 1);
  assert.equal(f.profileWrites.length, 1);
});

test("A04: duplicate CRM/UF and invalid global updates are rejected without persistence", async t => {
  const f = await fixture(t), { profile } = shared(f), before = snapshot(f);
  const other = [...f.rows("ProfessionalProfile").values()].find(p => p.id !== profile.id && p.userId === f.actors.globalDoctor.id);
  await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, f.actors.global, { crm: other.crm, crmState: other.crmState }).expect(409);
  for (const body of [{ crm: "!!!" }, { crmState: "ZZ" }, { rqe: "!!!" }, { specialty: "" }, { specialty: "x".repeat(101) }, { userId: randomUUID() }])
    await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, f.actors.global, body).expect(400);
  assert.equal(snapshot(f), before); assert.equal(f.profileWrites.length, 0);
});

test("A04: inactive local membership and inactive clinic remain restricted; global stays scoped to an eligible profile", async t => {
  const f = await fixture(t), { profile } = shared(f), before = snapshot(f);
  const membership = [...f.rows("ClinicUser").values()].find(m => m.userId === f.actors.admin.id);
  membership.active = false;
  await f.get(`/clinics/${f.a}/professionals`, f.actors.admin).expect(403);
  await f.write("post", `/clinics/${f.a}/professionals`, f.actors.admin, {}).expect(403);
  await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, f.actors.admin, fields).expect(403);
  f.rows("Clinic").get(f.a).active = false;
  await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, f.actors.global, fields).expect(400);
  assert.equal(snapshot(f), before); assert.equal(f.profileWrites.length, 0);
  await f.write("patch", `/clinics/${f.b}/professionals/${profile.id}`, f.actors.global, { rqe: "123" }).expect(200);
});

test("A04: missing or out-of-clinic profile and inactive professional do not allow update or duplicate creation", async t => {
  const f = await fixture(t), { profile, user } = shared(f);
  await f.write("patch", `/clinics/${f.a}/professionals/${randomUUID()}`, f.actors.global, fields).expect(404);
  const foreign = [...f.rows("ProfessionalProfile").values()].find(p => p.userId === f.actors.otherDoctor.id);
  await f.write("patch", `/clinics/${f.a}/professionals/${foreign.id}`, f.actors.global, fields).expect(404);
  user.active = false;
  await f.write("patch", `/clinics/${f.a}/professionals/${profile.id}`, f.actors.global, fields).expect(404);
  assert.equal(f.profileWrites.length, 0);
  await f.write("post", `/clinics/${f.a}/professionals`, f.actors.admin,
    { userId: f.actors.unlinked.id, crm: "123456", crmState: "SP" }).expect(400);
});

test("A04: changes to clinic membership neither delete nor duplicate a shared global profile", async t => {
  const f = await fixture(t), { profile, user, adminB } = shared(f), before = snapshot(f);
  await f.write("patch", `/clinics/${f.a}/users/${user.id}/active`, f.actors.admin, { active: false }).expect(200);
  await f.get(`/clinics/${f.a}/professionals/${profile.id}`, f.actors.admin).expect(404);
  await f.get(`/clinics/${f.b}/professionals/${profile.id}`, adminB).expect(200);
  await f.write("patch", `/clinics/${f.b}/users/${user.id}/role`, adminB, { role: "RECEPTIONIST" }).expect(200);
  await f.get(`/clinics/${f.b}/professionals/${profile.id}`, adminB).expect(404);
  assert.equal(snapshot(f), before); assert.equal(f.profileWrites.length, 0);
});
