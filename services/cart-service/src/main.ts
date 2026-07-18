import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MikroORM } from '@mikro-orm/core';
import { AppModule } from './app.module';
import { startTracing } from './tracing';

async function bootstrap() {
  await startTracing();
  const app = await NestFactory.create(AppModule);
  if (process.env.OPENAPI_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Cart Service')
      .setVersion(process.env.OPENAPI_DOCUMENT_VERSION ?? '1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api-docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
  const orm = app.get(MikroORM);
  await orm.getMigrator().up();
  const configService = app.get(ConfigService);
  await app.listen(Number(configService.get<string>('SERVER_PORT') ?? 8084));
}
void bootstrap();
