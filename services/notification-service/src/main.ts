import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.OPENAPI_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Notification Service')
      .setVersion(process.env.OPENAPI_DOCUMENT_VERSION ?? '1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api-docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  // WebSocket adapter (socket.io)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Kafka microservice transport
  const brokers = (process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:9092')
    .split(',')
    .map((b: string) => b.trim())
    .filter((b: string) => b.length > 0);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'notification-service',
        brokers,
        ...(process.env.KAFKA_SASL_USERNAME && {
          sasl: {
            mechanism: 'plain',
            username: process.env.KAFKA_SASL_USERNAME,
            password: process.env.KAFKA_SASL_PASSWORD ?? '',
          },
        }),
        ssl: true,
      },
      consumer: {
        groupId: process.env.KAFKA_CONSUMER_GROUP ?? 'notification-service',
        allowAutoTopicCreation: false,
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT ?? 8087;
  await app.listen(port);
  console.log(`Notification service running on port ${port}`);
}

void bootstrap();
