const assert = require("node:assert/strict");
const { test } = require("node:test");
require("reflect-metadata");
const { Reflector } = require("@nestjs/core");
const { AuthorizationGuard } = require("../dist/auth/guards/authorization.guard");
const { Public } = require("../dist/common/decorators/public.decorator");
const { Authenticated } = require("../dist/common/decorators/authenticated.decorator");
const { SystemAdmin } = require("../dist/common/decorators/system-admin.decorator");
const { ClinicRoles, Roles } = require("../dist/common/decorators/roles.decorator");
const guard = new AuthorizationGuard(new Reflector());

function fixture(classDecorators = [], methodDecorators = [], user, params = {}, headerClinic) {
  class Controller { endpoint() {} }
  classDecorators.forEach(decorator => decorator(Controller));
  methodDecorators.forEach(decorator => decorator(Controller.prototype, "endpoint", Object.getOwnPropertyDescriptor(Controller.prototype, "endpoint")));
  return {
    getClass: () => Controller, getHandler: () => Controller.prototype.endpoint,
    switchToHttp: () => ({ getRequest: () => ({ user, params, header: () => headerClinic }) }),
  };
}
const actor = (role = "OPHTHALMOLOGIST", clinicId = "clinic") => ({
  sub: "synthetic-user", isSystemAdmin: false, clinicRoles: [{ role, clinicId }],
});
const deny = context => assert.throws(() => guard.canActivate(context), { status: 403 });

test("missing policy denies every actor including system admin", () => {
  for (const user of [undefined, actor(), { isSystemAdmin: true, clinicRoles: [] }]) deny(fixture([], [], user));
});
test("Public permits unauthenticated access, Authenticated requires an authenticated identity", () => {
  assert.equal(guard.canActivate(fixture([], [Public()])), true);
  deny(fixture([], [Authenticated()]));
  assert.equal(guard.canActivate(fixture([], [Authenticated()], actor())), true);
});
test("SystemAdmin continues requiring the global flag", () => {
  deny(fixture([], [SystemAdmin()], actor("ADMIN")));
  assert.equal(guard.canActivate(fixture([], [SystemAdmin()], { isSystemAdmin: true })), true);
});
test("clinic roles require the allowed role and URL clinic, ignoring a conflicting header", () => {
  const policy = [ClinicRoles("clinicId", "ADMIN", "RECEPTIONIST")];
  assert.equal(guard.canActivate(fixture([], policy, actor("RECEPTIONIST"), { clinicId: "clinic" })), true);
  deny(fixture([], policy, actor(), { clinicId: "clinic" }));
  deny(fixture([], policy, actor("ADMIN", "other"), { clinicId: "clinic" }, "other"));
  deny(fixture([], policy, { clinicRoles: [] }, { clinicId: "clinic" }));
});
test("standalone Roles continues using x-clinic-id", () => {
  assert.equal(guard.canActivate(fixture([], [Roles("ADMIN")], actor("ADMIN"), {}, "clinic")), true);
  deny(fixture([], [Roles("ADMIN")], actor("ADMIN")));
});
test("method role and clinic parameter override the same metadata keys from the class", () => {
  const parent = [ClinicRoles("classClinic", "ADMIN")], method = [ClinicRoles("methodClinic", "OPHTHALMOLOGIST")];
  assert.equal(guard.canActivate(fixture(parent, method, actor(), { classClinic: "other", methodClinic: "clinic" })), true);
  deny(fixture(parent, method, actor("ADMIN"), { methodClinic: "clinic" }));
});
test("Authenticated on a method does not remove class role/SystemAdmin requirements", () => {
  deny(fixture([SystemAdmin()], [Authenticated()], actor()));
  deny(fixture([ClinicRoles("clinicId", "ADMIN")], [Authenticated()], actor(), { clinicId: "clinic" }));
  assert.equal(guard.canActivate(fixture([Authenticated()], [], actor())), true);
});
test("different restrictive keys keep their existing semantics", () => {
  deny(fixture([SystemAdmin()], [ClinicRoles("clinicId", "ADMIN")], actor("ADMIN"), { clinicId: "clinic" }));
  assert.equal(guard.canActivate(fixture([SystemAdmin()], [Roles("ADMIN")], { isSystemAdmin: true })), true);
});
test("ambiguous Public/private policies and empty roles fail closed", () => {
  for (const [parent, method] of [
    [[Public()], [Authenticated()]], [[SystemAdmin()], [Public()]],
    [[ClinicRoles("clinicId", "ADMIN")], [Public()]], [[], [Roles()]],
  ]) deny(fixture(parent, method, { isSystemAdmin: true }));
});
test("A02 guard bypass remains, but does not permit unannotated routes", () => {
  assert.equal(guard.canActivate(fixture([], [ClinicRoles("clinicId", "OPHTHALMOLOGIST")], { isSystemAdmin: true, clinicRoles: [] })), true);
  deny(fixture([], [], { isSystemAdmin: true, clinicRoles: [] }));
});
