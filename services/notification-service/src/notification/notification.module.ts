import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Infrastructure — Persistence
import {
  NotificationSchemaClass,
  NotificationSchema,
} from './infrastructure/persistence/mongo-notification.schema';
import {
  NotificationPreferencesSchemaClass,
  NotificationPreferencesSchema,
} from './infrastructure/persistence/mongo-notification-preferences.schema';
import { MongoNotificationRepository } from './infrastructure/persistence/mongo-notification.repository';
import { MongoNotificationPreferencesRepository } from './infrastructure/persistence/mongo-notification-preferences.repository';

// Infrastructure — Cache
import { RedisModule } from './infrastructure/cache/redis.module';
import { RedisDeduplicationAdapter } from './infrastructure/cache/redis-deduplication.adapter';
import { RedisConnectionRegistryAdapter } from './infrastructure/cache/redis-connection-registry.adapter';

// Infrastructure — Realtime
import { SocketioNotificationGateway } from './infrastructure/realtime/socketio-notification.gateway';
import { SocketioRealtimeChannelAdapter } from './infrastructure/realtime/socketio-realtime-channel.adapter';

// Infrastructure — Email
import { SesEmailChannelAdapter } from './infrastructure/email/ses-email-channel.adapter';

// Infrastructure — Push
import { OneSignalPushChannelAdapter } from './infrastructure/push/onesignal-push-channel.adapter';

// Infrastructure — SMS
import { TwilioSmsChannelAdapter } from './infrastructure/sms/twilio-sms-channel.adapter';

// Infrastructure — Templates
import { TemplateService } from './infrastructure/templates/template.service';

// Infrastructure — Messaging
import { KafkaEventConsumer } from './infrastructure/messaging/kafka-event.consumer';

// Infrastructure — REST
import { NotificationRestController } from './infrastructure/rest/notification.controller';
import { NotificationPreferencesController } from './infrastructure/rest/notification-preferences.controller';

// Infrastructure — Auth
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';

// Application — Commands
import { SendNotificationUseCase } from './application/command/send-notification.use-case';
import { MarkNotificationReadUseCase } from './application/command/mark-notification-read.use-case';
import { MarkAllReadUseCase } from './application/command/mark-all-read.use-case';
import { RetryFailedDeliveriesUseCase } from './application/command/retry-failed-deliveries.use-case';
import { UpdatePreferencesUseCase } from './application/command/update-preferences.use-case';

// Application — Queries
import { FindUserNotificationsUseCase } from './application/query/find-user-notifications.use-case';
import { FindNotificationThreadsUseCase } from './application/query/find-notification-threads.use-case';
import { FindThreadNotificationsUseCase } from './application/query/find-thread-notifications.use-case';
import { CountUnreadUseCase } from './application/query/count-unread.use-case';
import { GetPreferencesUseCase } from './application/query/get-preferences.use-case';

// Application — Event Handlers
import { NotificationCreatedHandler } from './application/event-handler/notification-created.handler';

// Domain — Port Symbols
import { NOTIFICATION_REPOSITORY } from './domain/port/outbound/notification.repository';
import { REALTIME_CHANNEL_PORT } from './domain/port/outbound/realtime-channel.port';
import { DEDUPLICATION_PORT } from './domain/port/outbound/deduplication.port';
import { CONNECTION_REGISTRY_PORT } from './domain/port/outbound/connection-registry.port';
import { EMAIL_CHANNEL_PORT } from './domain/port/outbound/email-channel.port';
import { NOTIFICATION_PREFERENCES_REPOSITORY } from './domain/port/outbound/notification-preferences.repository';
import { PUSH_CHANNEL_PORT } from './domain/port/outbound/push-channel.port';
import { SMS_CHANNEL_PORT } from './domain/port/outbound/sms-channel.port';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationSchemaClass.name, schema: NotificationSchema },
      {
        name: NotificationPreferencesSchemaClass.name,
        schema: NotificationPreferencesSchema,
      },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    EventEmitterModule.forRoot(),
    RedisModule,
  ],
  controllers: [
    NotificationRestController,
    NotificationPreferencesController,
    KafkaEventConsumer,
  ],
  providers: [
    // Auth
    JwtStrategy,

    // Port → Adapter bindings
    { provide: NOTIFICATION_REPOSITORY, useClass: MongoNotificationRepository },
    {
      provide: REALTIME_CHANNEL_PORT,
      useClass: SocketioRealtimeChannelAdapter,
    },
    { provide: DEDUPLICATION_PORT, useClass: RedisDeduplicationAdapter },
    {
      provide: CONNECTION_REGISTRY_PORT,
      useClass: RedisConnectionRegistryAdapter,
    },
    { provide: EMAIL_CHANNEL_PORT, useClass: SesEmailChannelAdapter },
    { provide: PUSH_CHANNEL_PORT, useClass: OneSignalPushChannelAdapter },
    { provide: SMS_CHANNEL_PORT, useClass: TwilioSmsChannelAdapter },
    {
      provide: NOTIFICATION_PREFERENCES_REPOSITORY,
      useClass: MongoNotificationPreferencesRepository,
    },

    // Infrastructure (needed for DI resolution)
    SocketioNotificationGateway,
    SocketioRealtimeChannelAdapter,
    TemplateService,

    // Application — Commands
    SendNotificationUseCase,
    MarkNotificationReadUseCase,
    MarkAllReadUseCase,
    RetryFailedDeliveriesUseCase,
    UpdatePreferencesUseCase,

    // Application — Queries
    FindUserNotificationsUseCase,
    FindNotificationThreadsUseCase,
    FindThreadNotificationsUseCase,
    CountUnreadUseCase,
    GetPreferencesUseCase,

    // Application — Event Handlers
    NotificationCreatedHandler,
  ],
})
export class NotificationModule {}
