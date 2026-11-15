// Standalone local integration suite. Never uses the configured Supabase DS.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { randomBytes, randomUUID } = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
process.env.NODE_PATH = path.join(root, "dist");
require("node:module")._initPaths();
require("reflect-metadata");
const { DataSource } = require("typeorm");
const { connectionOptions } = require("../dist/database/connection-options");
const {
  adminIdentity,
  bootstrapMode,
  bootstrapSystemAdmin,
  PRODUCTION_AUTHORIZATION,
} = require("../dist/database/seeds/system-admin.seed");
const { BcryptService } = require("../dist/common/hashing/bcrypt.service");
const { User } = require("../dist/users/entities/user.entity");
const { Clinic } = require("../dist/clinics/entities/clinic.entity");
const {
  ClinicUser,
} = require("../dist/clinic-users/entities/clinic-user.entity");
const {
  ProfessionalProfile,
} = require("../dist/professionals/entities/professional-profile.entity");
const { Patient } = require("../dist/patients/entities/patient.entity");

function run(file, args) {
  return execFileSync(file, args, { stdio: "pipe", timeout: 30000 });
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function httpPermissions(source, identity) {
  const { Test } = require("@nestjs/testing");
  const { Reflector } = require("@nestjs/core");
  const { ConfigService } = require("@nestjs/config");
  const { JwtService } = require("@nestjs/jwt");
  const {
    ValidationPipe,
    ClassSerializerInterceptor,
  } = require("@nestjs/common");
  const request = require("supertest");
  const { AuthController } = require("../dist/auth/auth.controller");
  const { AuthService } = require("../dist/auth/auth.service");
  const { JwtStrategy } = require("../dist/auth/strategies/jwt.strategy");
  const { JwtAuthGuard } = require("../dist/auth/guards/jwt-auth.guard");
  const {
    AuthorizationGuard,
  } = require("../dist/auth/guards/authorization.guard");
  const { UserService } = require("../dist/users/user.service");
  const { UsersController } = require("../dist/users/users.controller");
  const { HashingService } = require("../dist/common/hashing/hashing.service");
  const { ClinicService } = require("../dist/clinics/clinics.service");
  const { ClinicController } = require("../dist/clinics/clinics.controller");
  const {
    ClinicUsersService,
  } = require("../dist/clinic-users/clinic-users.service");
  const {
    ClinicUsersController,
  } = require("../dist/clinic-users/clinic-users.controller");
  const { PatientsService } = require("../dist/patients/patients.service");
  const {
    PatientsController,
  } = require("../dist/patients/patients.controller");
  const { ExamsService } = require("../dist/exams/exams.service");
  const { Exam } = require("../dist/exams/entities/exam.entity");
  const { AuditService } = require("../dist/audit/audit.service");
  const { AuditLog } = require("../dist/audit/entities/audit-log.entity");
  const { AuthSession } = require("../dist/auth/entities/auth-session.entity");
  const {
    RevokedToken,
  } = require("../dist/auth/entities/revoked-token.entity");
  const secret = randomBytes(32).toString("hex"),
    issuer = "urn:medvita:bootstrap-test";
  const config = new ConfigService({
    NODE_ENV: "test",
    JWT_SECRET: secret,
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    JWT_TOKEN_ISSUER: issuer,
    JWT_TOKEN_AUDIENCE: issuer,
  });
  const jwt = new JwtService({
    secret,
    signOptions: { expiresIn: 900, issuer, audience: issuer },
  });
  const hashing = new BcryptService();
  const users = new UserService(source.getRepository(User), hashing);
  const clinics = new ClinicService(source.getRepository(Clinic));
  const audit = new AuditService(source.getRepository(AuditLog));
  const members = new ClinicUsersService(
    source.getRepository(ClinicUser),
    clinics,
    users,
    audit,
  );
  const patients = new PatientsService(
    source.getRepository(Patient),
    clinics,
    audit,
  );
  const sessions = source.getRepository(AuthSession),
    revoked = source.getRepository(RevokedToken);
  const auth = new AuthService(
    users,
    hashing,
    jwt,
    config,
    sessions,
    revoked,
    audit,
  );
  new JwtStrategy(config, users, sessions, revoked);
  const values = [
    [AuthService, auth],
    [UserService, users],
    [HashingService, hashing],
    [ClinicService, clinics],
    [ClinicUsersService, members],
    [PatientsService, patients],
  ];
  const moduleRef = await Test.createTestingModule({
    controllers: [
      AuthController,
      UsersController,
      ClinicController,
      ClinicUsersController,
      PatientsController,
    ],
    providers: values.map(([provide, useValue]) => ({ provide, useValue })),
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new AuthorizationGuard(reflector),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  await app.init();
  try {
    const server = app.getHttpServer();
    assert.equal((await request(server).get("/users")).status, 401);
    const login = await request(server)
      .post("/auth/login")
      .set("X-Medvita-Session", "1")
      .send({
        email: identity.email.toUpperCase(),
        password: identity.password,
      });
    assert.equal(login.status, 201);
    assert.equal(login.body.user.isSystemAdmin, true);
    assert.deepEqual(login.body.user.clinicRoles, []);
    assert.ok(login.body.accessToken);
    assert.equal(login.body.refreshToken, undefined);
    const cookie = login.headers["set-cookie"].find((value) =>
      value.startsWith("medvita_session="),
    );
    assert.ok(cookie.includes("HttpOnly"));
    const refreshed = await request(server)
      .post("/auth/refresh")
      .set("X-Medvita-Session", "1")
      .set("Cookie", cookie.split(";")[0]);
    assert.equal(refreshed.status, 201);
    assert.equal(refreshed.body.user.isSystemAdmin, true);
    assert.deepEqual(refreshed.body.user.clinicRoles, []);
    const token = refreshed.body.accessToken,
      adminId = login.body.user.id;
    assert.equal(
      (await request(server).get("/users").auth(token, { type: "bearer" }))
        .status,
      200,
    );
    const ownMemberships = await request(server)
      .get(`/users/${adminId}/clinics`)
      .auth(token, { type: "bearer" });
    assert.equal(ownMemberships.status, 200);
    assert.deepEqual(ownMemberships.body, []);
    const normalPassword = randomBytes(16).toString("hex");
    const createUser = {
      name: "Operador de teste local",
      email: "operator@example.com",
      password: normalPassword,
    };
    assert.equal(
      (
        await request(server)
          .post("/users")
          .auth(token, { type: "bearer" })
          .send({ ...createUser, isSystemAdmin: true })
      ).status,
      400,
    );
    const ordinary = await request(server)
      .post("/users")
      .auth(token, { type: "bearer" })
      .send(createUser);
    assert.equal(ordinary.status, 201);
    assert.equal(ordinary.body.isSystemAdmin, false);
    assert.equal(ordinary.body.passwordHash, undefined);
    const normalLogin = await request(server)
      .post("/auth/login")
      .set("X-Medvita-Session", "1")
      .send({ email: createUser.email, password: normalPassword });
    assert.equal(normalLogin.status, 201);
    const normalToken = normalLogin.body.accessToken;
    assert.equal(
      (
        await request(server)
          .get("/users")
          .auth(normalToken, { type: "bearer" })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(server)
          .get("/clinics")
          .auth(normalToken, { type: "bearer" })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(server)
          .post("/users")
          .auth(normalToken, { type: "bearer" })
          .send({ ...createUser, email: "forbidden@example.com" })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(server)
          .patch(`/users/${ordinary.body.id}`)
          .auth(normalToken, { type: "bearer" })
          .send({ isSystemAdmin: true })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(server)
          .patch(`/users/${ordinary.body.id}`)
          .auth(token, { type: "bearer" })
          .send({ name: "Operador local editado" })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(server)
          .get(`/users/${ordinary.body.id}`)
          .auth(token, { type: "bearer" })
      ).status,
      200,
    );
    const clinicData = {
      name: "Clínica exclusiva do teste local",
      document: "DEMOBOOT000001",
      city: "Caxias do Sul",
      state: "RS",
    };
    assert.equal(
      (
        await request(server)
          .post("/clinics")
          .auth(normalToken, { type: "bearer" })
          .send(clinicData)
      ).status,
      403,
    );
    const clinic = await request(server)
      .post("/clinics")
      .auth(token, { type: "bearer" })
      .send(clinicData);
    assert.equal(clinic.status, 201);
    const clinicId = clinic.body.id;
    for (const url of ["/clinics", `/clinics/${clinicId}`])
      assert.equal(
        (await request(server).get(url).auth(token, { type: "bearer" })).status,
        200,
      );
    assert.equal(
      (
        await request(server)
          .patch(`/clinics/${clinicId}`)
          .auth(token, { type: "bearer" })
          .send({ name: "Clínica teste editada" })
      ).status,
      200,
    );
    for (const active of [false, true])
      assert.equal(
        (
          await request(server)
            .patch(`/clinics/${clinicId}/active`)
            .auth(token, { type: "bearer" })
            .send({ active })
        ).status,
        200,
      );
    // The bootstrap does not bypass the existing first-clinic-admin rule.
    assert.equal(
      (
        await request(server)
          .post(`/clinics/${clinicId}/users`)
          .auth(token, { type: "bearer" })
          .send({ userId: ordinary.body.id, role: "RECEPTIONIST" })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(server)
          .post(`/clinics/${clinicId}/users`)
          .auth(token, { type: "bearer" })
          .send({ userId: ordinary.body.id, role: "ADMIN" })
      ).status,
      201,
    );
    const other = await request(server)
      .post("/users")
      .auth(token, { type: "bearer" })
      .send({
        name: "Outro operador local",
        email: "other@example.com",
        password: randomBytes(16).toString("hex"),
      });
    assert.equal(other.status, 201);
    assert.equal(
      (
        await request(server)
          .post(`/clinics/${clinicId}/users`)
          .auth(token, { type: "bearer" })
          .send({ userId: other.body.id, role: "OPHTHALMOLOGIST" })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(server)
          .get(`/clinics/${clinicId}/users`)
          .auth(token, { type: "bearer" })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(server)
          .patch(`/clinics/${clinicId}/users/${other.body.id}/role`)
          .auth(token, { type: "bearer" })
          .send({ role: "RECEPTIONIST" })
      ).status,
      200,
    );
    for (const active of [false, true])
      assert.equal(
        (
          await request(server)
            .patch(`/clinics/${clinicId}/users/${other.body.id}/active`)
            .auth(token, { type: "bearer" })
            .send({ active })
        ).status,
        200,
      );
    assert.equal(
      (
        await request(server)
          .get(`/clinics/${clinicId}/patients`)
          .auth(token, { type: "bearer" })
      ).status,
      403,
    );
    await assert.rejects(
      () =>
        new ExamsService(source.getRepository(Exam), audit).types(clinicId, {
          ...login.body.user,
          sub: adminId,
        }),
      (error) => error.getStatus() === 403,
    );
    assert.equal(
      await source.getRepository(ClinicUser).countBy({ userId: adminId }),
      0,
    );
    console.log(
      "PASS: login/refresh global sem clínica; CRUD administrativo; vínculos e papéis; usuário comum bloqueado; pacientes/exames sem privilégio clínico automático.",
    );
  } finally {
    await app.close();
  }
}

async function main() {
  const environment = {
    SYSTEM_ADMIN_NAME: "Administrador do teste local",
    SYSTEM_ADMIN_EMAIL: " FIRST-ADMIN@EXAMPLE.COM ",
    SYSTEM_ADMIN_PASSWORD: randomBytes(16).toString("hex"),
  };
  const identity = adminIdentity(environment, "create");
  assert.equal(identity.email, "first-admin@example.com");
  assert.throws(() => adminIdentity({}, "create"));
  assert.throws(() =>
    adminIdentity({ ...environment, SYSTEM_ADMIN_EMAIL: "invalid" }, "create"),
  );
  assert.throws(() =>
    adminIdentity(
      { ...environment, SYSTEM_ADMIN_PASSWORD: "á".repeat(40) },
      "create",
    ),
  );
  assert.throws(() => bootstrapMode({}, ["--create"]));
  assert.throws(() =>
    bootstrapMode({ NODE_ENV: "production" }, [
      "--create",
      "--confirm-bootstrap",
    ]),
  );
  assert.equal(
    bootstrapMode(
      {
        NODE_ENV: "production",
        SYSTEM_ADMIN_ALLOW_PRODUCTION: PRODUCTION_AUTHORIZATION,
      },
      ["--create", "--confirm-bootstrap"],
    ),
    "create",
  );
  assert.throws(() =>
    bootstrapMode({}, ["--create", "--validate", "--confirm-bootstrap"]),
  );
  assert.equal(
    adminIdentity({ SYSTEM_ADMIN_EMAIL: identity.email }, "validate").email,
    identity.email,
  );
  const refused = spawnSync(
    process.execPath,
    [path.join(root, "dist/database/seeds/system-admin.cli.js"), "--create"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "invalid",
        DB_SSL_CA_PATH: "/missing/cert",
      },
    },
  );
  assert.equal(refused.status, 1);
  assert.ok(refused.stderr.includes("--confirm-bootstrap"));
  assert.ok(!refused.stderr.includes("DATABASE_URL"));
  console.log(
    "PASS: DTOs, normalização, limite bcrypt e bloqueios anteriores à conexão.",
  );

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "medvita-admin-"));
  let source,
    started = false,
    pgctl;
  try {
    const bin =
      process.env.PG_TEST_BIN ||
      run("pg_config", ["--bindir"]).toString().trim();
    pgctl = path.join(bin, "pg_ctl");
    const data = path.join(temp, "data"),
      ca = path.join(temp, "ca.crt"),
      key = path.join(temp, "key.pem");
    run("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      key,
      "-out",
      ca,
    ]);
    fs.chmodSync(key, 0o600);
    run(path.join(bin, "initdb"), [
      "-D",
      data,
      "-U",
      "admin_test",
      "--auth=trust",
      "--no-locale",
      "--encoding=UTF8",
    ]);
    const port = await freePort();
    fs.appendFileSync(
      path.join(data, "postgresql.conf"),
      `\nssl=on\nssl_cert_file='${ca}'\nssl_key_file='${key}'\n`,
    );
    run(pgctl, [
      "-D",
      data,
      "-l",
      path.join(temp, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -k ${temp}`,
      "-w",
      "start",
    ]);
    started = true;
    source = new DataSource({
      ...connectionOptions({
        DB_HOST: "127.0.0.1",
        DB_PORT: port,
        DB_USERNAME: "admin_test",
        DB_NAME: "postgres",
        DB_SSL_CA_PATH: ca,
      }),
      entities: [path.join(root, "dist/**/*.entity.js")],
      migrations: [path.join(root, "dist/database/migrations/*.js")],
      logging: false,
    });
    assert.equal(source.options.host, "127.0.0.1");
    assert.equal(source.options.url, undefined);
    await source.initialize();
    await source.runMigrations(); // Existing migrations, disposable local DB only.
    assert.equal(
      (
        await source.query(
          "SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
        )
      )[0].ssl,
      true,
    );
    assert.equal(
      (await bootstrapSystemAdmin(source, "check", identity)).canBootstrap,
      true,
    );
    assert.equal(await source.getRepository(User).count(), 0);
    await assert.rejects(() =>
      bootstrapSystemAdmin(source, "validate", { email: identity.email }),
    );
    const hashing = new BcryptService();
    const outsider = await source
      .getRepository(User)
      .save({
        id: randomUUID(),
        name: "Conta comum preexistente",
        email: identity.email.toUpperCase(),
        passwordHash: await hashing.hash(randomBytes(16).toString("hex")),
        active: true,
        isSystemAdmin: false,
      });
    const snapshot = await source
      .getRepository(User)
      .findOneByOrFail({ id: outsider.id });
    await assert.rejects(
      () => bootstrapSystemAdmin(source, "create", identity),
      /email já pertence/,
    );
    assert.deepEqual(
      await source.getRepository(User).findOneByOrFail({ id: outsider.id }),
      snapshot,
    );
    await source.getRepository(User).delete(outsider.id);
    const inactive = await source
      .getRepository(User)
      .save({
        id: randomUUID(),
        name: "Administrador inativo preexistente",
        email: "inactive@example.com",
        passwordHash: await hashing.hash(randomBytes(16).toString("hex")),
        active: false,
        isSystemAdmin: true,
      });
    await assert.rejects(
      () => bootstrapSystemAdmin(source, "create", identity),
      /já existe administrador/,
    );
    await source.getRepository(User).delete(inactive.id);
    await source.query(
      "ALTER TABLE users ADD CONSTRAINT bootstrap_test_reject CHECK (is_system_admin = false)",
    );
    await assert.rejects(() =>
      bootstrapSystemAdmin(source, "create", identity),
    );
    assert.equal(await source.getRepository(User).count(), 0);
    await source.query(
      "ALTER TABLE users DROP CONSTRAINT bootstrap_test_reject",
    );
    const second = {
      ...identity,
      email: "second-admin@example.com",
      password: randomBytes(16).toString("hex"),
    };
    const outcomes = await Promise.allSettled([
      bootstrapSystemAdmin(source, "create", identity),
      bootstrapSystemAdmin(source, "create", second),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(await source.getRepository(User).count(), 1);
    const administrator = await source
      .getRepository(User)
      .findOneByOrFail({ isSystemAdmin: true });
    const createdIdentity =
      administrator.email === identity.email ? identity : second;
    assert.equal(administrator.active, true);
    assert.equal(
      await hashing.compare(
        createdIdentity.password,
        administrator.passwordHash,
      ),
      true,
    );
    assert.ok(administrator.passwordHash.startsWith("$2b$10$"));
    assert.equal(
      (
        await bootstrapSystemAdmin(source, "validate", {
          email: createdIdentity.email,
        })
      ).administratorExists,
      true,
    );
    await assert.rejects(
      () => bootstrapSystemAdmin(source, "check", identity),
      /já existe administrador/,
    );
    await assert.rejects(
      () =>
        bootstrapSystemAdmin(source, "create", {
          ...identity,
          password: randomBytes(16).toString("hex"),
        }),
      /já existe administrador/,
    );
    assert.deepEqual(
      await source
        .getRepository(User)
        .findOneByOrFail({ id: administrator.id }),
      administrator,
    );
    for (const entity of [Clinic, ClinicUser, ProfessionalProfile, Patient])
      assert.equal(await source.getRepository(entity).count(), 0);
    console.log(
      "PASS: TLS local, checagem sem escrita, colisão sem promoção, inativo bloqueado, rollback, concorrência, bcrypt e criação somente de um User.",
    );
    await httpPermissions(source, createdIdentity);
  } finally {
    try {
      if (source?.isInitialized) await source.destroy();
    } finally {
      try {
        if (started)
          run(pgctl, [
            "-D",
            path.join(temp, "data"),
            "-m",
            "immediate",
            "-w",
            "stop",
          ]);
      } finally {
        fs.rmSync(temp, { recursive: true, force: true });
      }
    }
  }
}
void main().catch((error) => {
  console.error("FAIL: teste local de bootstrap:", error.name);
  console.error(
    error.stack
      ?.split("\n")
      .find(
        (line) =>
          line.trimStart().startsWith("at ") &&
          line.includes("system-admin-bootstrap.test.cjs"),
      ) ?? "Sem localização disponível.",
  );
  process.exitCode = 1;
});
