import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableCors({
    origin: (
      process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173"
    ).split(","),
    credentials: true,
  });

  if (process.env.OPENAPI_ENABLED !== "false") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("VNShop Backend API")
      .setDescription(
        "Internal operator documentation for gateway-routed HTTP APIs",
      )
      .setVersion(process.env.OPENAPI_DOCUMENT_VERSION ?? "1.0.0")
      .addBearerAuth()
      .build();
    const bootstrapDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("monitoring/docs", app, bootstrapDocument, {
      customSiteTitle: "VNShop Backend API",
      swaggerOptions: {
        url: "/monitoring/openapi.json",
      },
    });
  }

  const port = process.env.PORT ?? 8096;
  await app.listen(port);
  console.log(`Monitoring service running on port ${port}`);
}

void bootstrap();
