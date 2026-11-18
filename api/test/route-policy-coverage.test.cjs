// Build first. Inspect source/compiled controllers without booting AppModule.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
require("reflect-metadata");
const { MetadataScanner, Reflector } = require("@nestjs/core");
const { METHOD_METADATA } = require("@nestjs/common/constants");
const { AuthorizationGuard } = require("../dist/auth/guards/authorization.guard");
const { DataSource } = require("typeorm");
const { SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY } = require("../dist/common/decorators/system-admin-or-clinic-roles.decorator");
DataSource.prototype.initialize = async () => { throw new Error("Database forbidden in policy coverage"); };

function checkController(controller) {
  assert.notEqual(Reflect.getMetadata(SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY, controller), true, "Global exceptions must be per endpoint");
  const administrativeExceptions = new Set([
    "ClinicController.findById", "ClinicController.update",
    "ClinicUsersController.create", "ClinicUsersController.findByClinic", "ClinicUsersController.updateRole", "ClinicUsersController.updateActive",
    "ProfessionalsController.create", "ProfessionalsController.findByClinic", "ProfessionalsController.findByUser", "ProfessionalsController.findByCrm", "ProfessionalsController.findById",
  ]);
  const guard = new AuthorizationGuard(new Reflector());
  const routes = new MetadataScanner().getAllMethodNames(controller.prototype)
    .filter(name => Reflect.hasMetadata(METHOD_METADATA, controller.prototype[name]));
  for (const name of routes) {
    const handler = controller.prototype[name];
    const reflector = new Reflector();
    const targets = [handler, controller];
    const roles = reflector.getAllAndOverride("clinicRoles", targets);
    const clinicParam = reflector.getAllAndOverride("clinicIdParam", targets);
    const exception = Reflect.getMetadata(SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY, handler);
    if (exception) assert.ok(administrativeExceptions.has(`${controller.name}.${name}`), "Unexpected global exception; review A02 policy");
    const context = {
      getClass: () => controller, getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({
        user: { isSystemAdmin: true, clinicRoles: roles?.length ? [{ clinicId: "synthetic-clinic", role: roles[0] }] : [] },
        params: clinicParam ? { [clinicParam]: "synthetic-clinic" } : {},
        header: () => "synthetic-clinic",
      }) }),
    };
    assert.doesNotThrow(() => guard.canActivate(context), `${controller.name}.${name}: missing/invalid authorization policy`);
    if (roles?.length && !exception && !reflector.getAllAndOverride("requiresSystemAdmin", targets)) {
      const withoutMembership = { ...context, switchToHttp: () => ({ getRequest: () => ({ user: { isSystemAdmin: true, clinicRoles: [] }, params: {} }) }) };
      assert.throws(() => guard.canActivate(withoutMembership), { status: 403 }, "Local roles must not permit a universal global bypass");
    }
  }
  return routes.length;
}

test("every source controller endpoint has an explicit valid authorization policy", t => {
  const root = path.resolve(__dirname, "../src");
  let controllerCount = 0, routeCount = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!file.endsWith(".ts") || file.endsWith(".d.ts")) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      const imports = new Map(), namespaces = new Set();
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== "@nestjs/common") continue;
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const item of bindings.elements) imports.set(item.name.text, (item.propertyName ?? item.name).text);
        if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      }
      function decoratorNames(node) {
        return (ts.getDecorators(node) ?? []).map(d => {
          const expression = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
          if (ts.isIdentifier(expression)) return imports.get(expression.text);
          if (ts.isPropertyAccessExpression(expression) && namespaces.has(expression.expression.getText(source))) return expression.name.text;
          return undefined;
        });
      }
      function visit(node) {
        if (ts.isClassDeclaration(node) && decoratorNames(node).includes("Controller")) {
          const compiledFile = path.join(__dirname, "../dist", path.relative(root, file)).replace(/\.ts$/, ".js");
          const exports = require(compiledFile);
          const controller = exports[node.name?.text] ?? exports.default;
          assert.equal(typeof controller, "function", `Rebuild required for ${file}`);
          // Catch a newly added source route even if an old dist is accidentally used.
          for (const member of node.members) {
            if (!decoratorNames(member).some(n => ["Get", "Post", "Put", "Patch", "Delete", "Options", "Head", "All", "RequestMapping"].includes(n))) continue;
            const name = member.name?.getText(source).replace(/^['"]|['"]$/g, "");
            assert.ok(Reflect.hasMetadata(METHOD_METADATA, controller.prototype[name] ?? {}), `Rebuild required for ${controller.name}.${name}`);
          }
          controllerCount++;
          routeCount += checkController(controller);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  walk(root);
  assert.ok(controllerCount > 0 && routeCount > 0, "Coverage must not silently inspect zero routes");
  t.diagnostic(`Covered ${routeCount} endpoints in ${controllerCount} source controllers`);
});

test("route coverage detects a future unannotated route, even for System Admin", () => {
  class FutureController { unprotected() {} }
  Reflect.defineMetadata(METHOD_METADATA, 0, FutureController.prototype.unprotected);
  assert.throws(() => checkController(FutureController), /missing\/invalid authorization policy/);
});
