// Real Nest/Express HTTP, JWT, guards, DTOs and services; synthetic memory only.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { fixture } = require("./support/system-admin-fixture.cjs");

const future = () => new Date(Date.now() + 4 * 86400000);
const operations = ["reschedule", "cancel"];
const payload = action => action === "cancel" ? { reason: "Motivo sintético" }
  : { scheduledAt: future().toISOString(), durationMinutes: 45 };
async function setup(t) {
  const f = await fixture(t, { transactional: true });
  const profile = [...f.rows("ProfessionalProfile").values()].find(p => p.userId === f.actors.doctor.id);
  const scheduledAt = new Date(Date.now() + 2 * 86400000);
  const appointment = f.put("Appointment", { clinicId: f.a, professionalId: profile.id,
    patientId: f.patientA.id, scheduledAt, endsAt: new Date(+scheduledAt + 1800000),
    durationMinutes: 30, status: "SCHEDULED", reason: "Consulta sintética", notes: null,
    cancellationReason: null, cancelledAt: null });
  const url = action => `/clinics/${f.a}/appointments/${appointment.id}/${action}`;
  const call = (action, actor = f.actors.doctor, body = payload(action)) => f.write("patch", url(action), actor, body);
  const direct = action => f.values.AppointmentsService[action](f.a, appointment.id, payload(action), f.principal(f.actors.doctor));
  return { ...f, profile, appointment, url, call, direct };
}
function checkpoint(f) {
  const before = structuredClone(f.rows("Appointment").get(f.appointment.id));
  const audits = f.rows("AuditLog").size;
  return () => {
    assert.deepEqual(structuredClone(f.rows("Appointment").get(f.appointment.id)), before);
    assert.equal(f.rows("AuditLog").size, audits);
  };
}
function assertSafe(body) {
  assert.equal(body.encounter, null);
  for (const key of ["anamnesis", "clinicalAssessment", "plan", "clinicalNotes", "visualAcuityRight", "intraocularPressureRight"])
    assert.equal(JSON.stringify(body).includes(`"${key}"`), false);
}

for (const action of operations) {
  for (const role of ["doctor", "admin", "receptionist"]) test(`${role} can ${action} an authorized appointment atomically with audit`, async t => {
    const f = await setup(t), actor = f.actors[role];
    const eligibility = f.values.ProfessionalsService.findActiveForClinic.bind(f.values.ProfessionalsService);
    const managers = [];
    f.values.ProfessionalsService.findActiveForClinic = (...args) => {
      managers.push(args[2]); return eligibility(...args);
    };
    f.appointment.status = "CONFIRMED";
    const response = await f.call(action, actor).expect(200);
    assertSafe(response.body);
    assert.equal(response.body.professionalId, f.profile.id);
    assert.equal(response.body.clinicId, f.a);
    assert.equal(f.rows("Appointment").size, 4); // Existing history + this row; no physical deletion.
    if (action === "cancel") {
      assert.equal(response.body.status, "CANCELLED");
      assert.equal(response.body.cancellationReason, "Motivo sintético");
      assert.ok(response.body.cancelledAt);
    } else {
      assert.equal(response.body.status, "SCHEDULED");
      assert.equal(response.body.durationMinutes, 45);
      assert.equal(+new Date(response.body.endsAt) - +new Date(response.body.scheduledAt), 45 * 60000);
    }
    const events = [...f.rows("AuditLog").values()];
    assert.equal(events.length, 1);
    assert.equal(events[0].actorId, actor.id);
    assert.equal(events[0].clinicId, f.a);
    assert.equal(events[0].resourceId, f.appointment.id);
    assert.equal(events[0].action, action === "cancel" ? "APPOINTMENT_CANCELLED" : "APPOINTMENT_RESCHEDULED");
    if (action === "cancel") assert.equal(events[0].metadata.previousStatus, "CONFIRMED");
    else assert.equal(events[0].metadata.previousScheduledAt, f.appointment.scheduledAt.toISOString());
    assert.deepEqual(f.lockEvents.filter(e => e.phase === "acquired").map(e => e.id), [f.appointment.id]);
    assert.equal(managers.length, role === "doctor" ? 1 : 0);
    if (role === "doctor") assert.equal(typeof managers[0]?.getRepository, "function");
  });

  test(`ophthalmologist cannot ${action} another professional's appointment, even in a direct service call`, async t => {
    const f = await setup(t), other = f.actors.globalDoctor, unchanged = checkpoint(f);
    await f.call(action, other).expect(403);
    await assert.rejects(f.values.AppointmentsService[action](f.a, f.appointment.id, payload(action), f.principal(other)), { status: 403 });
    unchanged();
  });

  test(`${action} isolates clinic scope even when the physician belongs to both clinics`, async t => {
    const f = await setup(t), unchanged = checkpoint(f);
    await f.write("patch", `/clinics/${f.b}/appointments/${f.appointment.id}/${action}`, f.actors.doctor, payload(action)).expect(403);
    f.put("ClinicUser", { userId: f.actors.doctor.id, clinicId: f.b, role: "OPHTHALMOLOGIST" });
    await f.write("patch", `/clinics/${f.b}/appointments/${f.appointment.id}/${action}`, f.actors.doctor, payload(action)).expect(404);
    unchanged();
  });

  for (const scenario of ["missing-profile", "inactive-membership", "inactive-user", "inactive-clinic"]) {
    test(`${action} rejects ${scenario} at HTTP and service eligibility boundaries without writes`, async t => {
      const f = await setup(t), principal = f.principal(f.actors.doctor), unchanged = checkpoint(f);
      if (scenario === "missing-profile") f.rows("ProfessionalProfile").delete(f.profile.id);
      if (scenario === "inactive-membership") [...f.rows("ClinicUser").values()].find(m => m.userId === principal.sub).active = false;
      if (scenario === "inactive-user") f.actors.doctor.active = false;
      if (scenario === "inactive-clinic") f.rows("Clinic").get(f.a).active = false;
      await f.call(action).expect(scenario === "missing-profile" ? 404 : scenario === "inactive-user" ? 401 : 403);
      // A previously valid actor is not sufficient: resolve current eligibility in the service.
      await assert.rejects(f.values.AppointmentsService[action](f.a, f.appointment.id, payload(action), principal), {
        status: 404,
      });
      unchanged();
    });
  }

  for (const status of ["CANCELLED", "COMPLETED", "IN_PROGRESS", "NO_SHOW"]) test(`${action} rejects appointment status ${status}`, async t => {
    const f = await setup(t); f.appointment.status = status;
    const unchanged = checkpoint(f);
    await f.call(action).expect(400); unchanged();
  });

  for (const status of ["IN_PROGRESS", "COMPLETED", "CANCELLED"]) test(`${action} rejects any linked encounter (${status}), even with a schedulable appointment`, async t => {
    const f = await setup(t);
    f.put("Encounter", { appointmentId: f.appointment.id, clinicId: f.a, status });
    const unchanged = checkpoint(f);
    await f.call(action).expect(400); unchanged();
  });

  test(`${action} rejects body assignment/tenant changes and restores the transaction if audit fails`, async t => {
    const f = await setup(t), unchanged = checkpoint(f);
    for (const extra of [{ professionalId: f.profile.id }, { clinicId: f.b }, { patientId: f.patientA.id }]) {
      await f.call(action, f.actors.doctor, { ...payload(action), ...extra }).expect(400); unchanged();
    }
    f.failNextAudit();
    await assert.rejects(f.direct(action), /Synthetic audit write failure/);
    unchanged();
    // The rolled-back lock is released and a subsequent valid request can succeed.
    await f.call(action).expect(200);
  });

  test(`${action} remains denied to unlinked users and global administrators without a local role`, async t => {
    const f = await setup(t), unchanged = checkpoint(f);
    for (const actor of [f.actors.unlinked, f.actors.global]) {
      await f.call(action, actor).expect(403);
      await assert.rejects(f.values.AppointmentsService[action](f.a, f.appointment.id, payload(action), f.principal(actor)), { status: 403 });
    }
    unchanged();
  });
}

test("reschedule preserves global professional conflicts, exclusion handling and future/DTO validation", async t => {
  const f = await setup(t), unchanged = checkpoint(f);
  const body = payload("reschedule");
  const conflict = f.put("Appointment", { clinicId: f.b, professionalId: f.profile.id, status: "SCHEDULED",
    scheduledAt: new Date(body.scheduledAt), endsAt: new Date(Date.parse(body.scheduledAt) + 1800000) });
  const response = await f.call("reschedule", f.actors.doctor, body).expect(409);
  assert.equal(JSON.stringify(response.body).includes(conflict.id), false); unchanged();
  f.rows("Appointment").delete(conflict.id);
  for (const durationMinutes of [0, 4, 481, 30.5, "invalid"]) {
    await f.call("reschedule", f.actors.doctor, { ...body, durationMinutes }).expect(400); unchanged();
  }
  for (const scheduledAt of ["invalid", "2020-01-01T12:00:00Z", "2040-01-01T12:00:00"]) {
    await f.call("reschedule", f.actors.doctor, { ...body, scheduledAt }).expect(400); unchanged();
  }
  const service = f.values.AppointmentsService, original = service.ensureNoConflict;
  service.ensureNoConflict = async () => { throw { code: "23P01" }; };
  await f.call("reschedule").expect(409); unchanged();
  service.ensureNoConflict = original;
});

test("cancel requires a meaningful reason and trims it, preserving the appointment history", async t => {
  const f = await setup(t), unchanged = checkpoint(f);
  for (const body of [{}, { reason: "" }, { reason: "   " }, { reason: "ab" }, { reason: "a".repeat(501) }]) {
    await f.call("cancel", f.actors.doctor, body).expect(400); unchanged();
  }
  const response = await f.call("cancel", f.actors.doctor, { reason: "  Motivo sintético  " }).expect(200);
  assert.equal(response.body.cancellationReason, "Motivo sintético");
});

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
async function until(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) await new Promise(r => setTimeout(r, 5));
  assert.ok(predicate(), "Expected deterministic lock interleaving");
}
for (const action of operations) for (const first of ["encounter", "change"]) {
  test(`serialized ${action}/encounter race: ${first} obtains the appointment lock first`, async t => {
    const f = await setup(t), gate = deferred(), entered = deferred();
    const audit = f.values.AuditService, original = audit.record.bind(audit);
    const firstAction = first === "encounter" ? "ENCOUNTER_STARTED" : action === "cancel" ? "APPOINTMENT_CANCELLED" : "APPOINTMENT_RESCHEDULED";
    audit.record = async (entry, manager) => {
      if (entry.action === firstAction) { entered.resolve(); await gate.promise; }
      return original(entry, manager);
    };
    const start = () => f.values.EncountersService.start(f.a, { appointmentId: f.appointment.id }, f.principal(f.actors.doctor));
    const lead = first === "encounter" ? start() : f.direct(action);
    await entered.promise;
    const follower = (first === "encounter" ? f.direct(action) : start()).then(value => ({ value }), error => ({ error }));
    try {
      await until(() => f.lockEvents.filter(e => e.phase === "waiting").length === 2);
      assert.equal(f.lockEvents.filter(e => e.phase === "acquired").length, 1);
    } finally { gate.resolve(); }
    await lead;
    const result = await follower;
    const row = f.rows("Appointment").get(f.appointment.id);
    if (first === "encounter" || action === "cancel") {
      assert.equal(result.error?.status, 400);
      assert.equal(row.status, first === "encounter" ? "IN_PROGRESS" : "CANCELLED");
    } else {
      assert.equal(result.error, undefined);
      assert.equal(row.status, "IN_PROGRESS");
      assert.equal(row.durationMinutes, 45);
    }
    assert.equal(f.rows("Encounter").size, first === "change" && action === "cancel" ? 3 : 4);
    assert.deepEqual(f.lockEvents.filter(e => e.phase === "acquired").map(e => e.id), [f.appointment.id, f.appointment.id]);
    const changes = [...f.rows("AuditLog").values()].filter(e => ["APPOINTMENT_RESCHEDULED", "APPOINTMENT_CANCELLED", "ENCOUNTER_STARTED"].includes(e.action));
    assert.equal(changes[0].action, firstAction);
    assert.equal(changes.length, first === "change" && action === "reschedule" ? 2 : 1);
  });
}
