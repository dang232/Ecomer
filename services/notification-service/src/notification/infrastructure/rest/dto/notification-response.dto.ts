import { Notification } from '../../../domain/model/notification';

export class NotificationResponseDto {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly deepLink: string | null;
  readonly priority: string;
  readonly threadId: string | null;
  readonly threadTitle: string | null;
  readonly read: boolean;
  readonly readAt: string | null;
  readonly deliveryStatus: string;
  readonly retryCount: number;
  readonly nextRetryAt: string | null;
  readonly createdAt: string;

  private constructor(props: NotificationResponseDto) {
    Object.assign(this, props);
  }

  static from(n: Notification): NotificationResponseDto {
    return new NotificationResponseDto({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      deepLink: n.deepLink,
      priority: n.priority,
      threadId: n.thread?.threadId ?? null,
      threadTitle: n.thread?.threadTitle ?? null,
      read: n.read,
      readAt: n.readAt?.toISOString() ?? null,
      deliveryStatus: n.deliveryStatus.getValue(),
      retryCount: n.retryCount,
      nextRetryAt: n.nextRetryAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    });
  }
}
