import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { createKafkaClientConfig } from './kafka-client.config';
import { startTracing } from './tracing';

export async function bootstrap(): Promise<void> {
  startTracing();
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
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
        client: createKafkaClientConfig('notification-service'),
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

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
