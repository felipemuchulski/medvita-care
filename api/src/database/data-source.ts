import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { join } from "path";
import { connectionOptions } from "./connection-options";

dotenv.config({ path: join(__dirname, "../../.env") });

export default new DataSource({
  ...connectionOptions(process.env),
  entities: [join(__dirname, "../**/*.entity.{ts,js}")],
  migrations: [join(__dirname, "migrations/*.{ts,js}")],
});
