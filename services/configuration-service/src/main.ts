import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GatewayAuthGuard } from './common/guards/gateway-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.OPENAPI_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Configuration Service')
      .setVersion(process.env.OPENAPI_DOCUMENT_VERSION ?? '1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api-docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new GatewayAuthGuard(reflector), new RolesGuard(reflector));

  await app.listen(Number(process.env.SERVER_PORT ?? 8097));
}
void bootstrap();
