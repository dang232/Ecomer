import { Notification } from '../../domain/model/notification';
import { NotificationThread } from '../../domain/model/notification-thread';
import { DeliveryStatus } from '../../domain/model/delivery-status';
import { NotificationSchemaClass } from './mongo-notification.schema';

export class NotificationMapper {
  static toDomain(doc: NotificationSchemaClass): Notification {
    const thread =
      doc.threadId && doc.threadTitle
        ? NotificationThread.reconstitute(doc.threadId, doc.threadTitle)
        : null;

    return Notification.reconstitute({
      id: doc.id,
      userId: doc.userId,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      deepLink: doc.deepLink,
      priority: doc.priority,
      thread,
      metadata: doc.metadata ?? {},
      idempotencyKey: doc.idempotencyKey,
      read: doc.read,
      readAt: doc.readAt,
      deliveryStatus: DeliveryStatus.fromValue(doc.deliveryStatus),
      createdAt: doc.createdAt,
      retryCount: doc.retryCount ?? 0,
      nextRetryAt: doc.nextRetryAt ?? null,
    });
  }

  static toPersistence(notification: Notification): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      deepLink: notification.deepLink,
      priority: notification.priority,
      deliveryStatus: notification.deliveryStatus.getValue(),
      threadId: notification.thread?.threadId ?? null,
      threadTitle: notification.thread?.threadTitle ?? null,
      metadata: notification.metadata,
      read: notification.read,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      retryCount: notification.retryCount,
      nextRetryAt: notification.nextRetryAt,
      expiresAt: new Date(
        notification.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000,
      ), // 90 days TTL
    };
    // Only persist idempotencyKey when non-null; omitting it lets the
    // sparse unique index skip the document instead of conflicting on null.
    if (notification.idempotencyKey) {
      doc.idempotencyKey = notification.idempotencyKey;
    }
    return doc;
  }
}
