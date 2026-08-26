import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/port/outbound/notification.repository';
import {
  REALTIME_CHANNEL_PORT,
  RealtimeChannelPort,
} from '../../domain/port/outbound/realtime-channel.port';
import {
  CONNECTION_REGISTRY_PORT,
  ConnectionRegistryPort,
} from '../../domain/port/outbound/connection-registry.port';
import { Notification } from '../../domain/model/notification';
import { DefaultDeliveryPolicy } from '../../domain/service/delivery-policy';

@Injectable()
export class RetryFailedDeliveriesUseCase {
  private readonly logger = new Logger(RetryFailedDeliveriesUseCase.name);
  private readonly deliveryPolicy = new DefaultDeliveryPolicy();
  private static readonly MAX_BATCH_SIZE = 100;

  /* istanbul ignore next */
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: NotificationRepository,
    @Inject(REALTIME_CHANNEL_PORT)
    private readonly channel: RealtimeChannelPort,
    @Inject(CONNECTION_REGISTRY_PORT)
    private readonly registry: ConnectionRegistryPort,
  ) {}

  async execute(
    now = new Date(),
    requestedBatchSize = RetryFailedDeliveriesUseCase.MAX_BATCH_SIZE,
  ): Promise<{ retried: number; movedToDlq: number }> {
    const batchSize = Math.min(
      Math.max(requestedBatchSize, 1),
      RetryFailedDeliveriesUseCase.MAX_BATCH_SIZE,
    );
    const failedNotifications = await this.repo.findDueRetries(now, batchSize);
    let retried = 0;
    let movedToDlq = 0;

    for (const notification of failedNotifications) {
      const result = await this.retry(notification);
      retried += result.retried;
      movedToDlq += result.movedToDlq;
    }

    return { retried, movedToDlq };
  }

  private async retry(
    notification: Notification,
  ): Promise<{ retried: number; movedToDlq: number }> {
    const maxRetries = this.deliveryPolicy.getMaxRetries(notification.priority);
    if (!notification.canRetry(maxRetries)) {
      notification.moveToDlq();
      await this.repo.save(notification);
      return { retried: 0, movedToDlq: 1 };
    }

    // Persist QUEUED before invoking the provider so another retry sweep cannot
    // select the same failed notification while this attempt is in flight.
    notification.retry();
    notification.incrementRetry();
    await this.repo.save(notification);

    try {
      if (await this.registry.isOnline(notification.userId)) {
        notification.markSent();
        await this.channel.sendToUser(notification.userId, notification);
        await this.repo.save(notification);
      } else {
        notification.markSent();
        await this.repo.save(notification);
        await this.registry.enqueueOffline(
          notification.userId,
          notification.id,
        );
      }
      return { retried: 1, movedToDlq: 0 };
    } catch (error) {
      const canRetryAgain = notification.canRetry(maxRetries);
      const nextRetryAt = canRetryAgain
        ? new Date(
            Date.now() +
              this.deliveryPolicy.getRetryDelayMs(notification.retryCount),
          )
        : null;
      notification.markFailed(nextRetryAt);
      if (!canRetryAgain) notification.moveToDlq();
      await this.repo.save(notification);
      this.logger.warn(`Retry failed for ${notification.id}: ${String(error)}`);
      return { retried: 1, movedToDlq: canRetryAgain ? 0 : 1 };
    }
  }
}
