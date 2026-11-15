import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { configureApplication } from "./configure-app";

export async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApplication(app);
  await app.listen(process.env.PORT ?? 3000);
  return app;
}
if (require.main === module) void bootstrap();
