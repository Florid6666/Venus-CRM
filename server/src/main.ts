import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Venus CRM API listening on http://localhost:${port}`);
}

bootstrap();
