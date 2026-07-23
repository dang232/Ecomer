import { Notification } from '../../model/notification';
import { NotificationType } from '../../model/notification-type.enum';

export interface FindUserNotificationsOptions {
  userId: string;
  type?: NotificationType;
  threadId?: string;
  page?: number;
  limit?: number;
}

export interface ThreadSummary {
  threadId: string;
  threadTitle: string;
  unreadCount: number;
  totalCount: number;
  latestAt: Date;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findByIds(ids: string[]): Promise<Notification[]>;
  findDueRetries(now: Date, limit: number): Promise<Notification[]>;
  findByIdAndUserId(id: string, userId: string): Promise<Notification | null>;
  findByIdempotencyKey(key: string): Promise<Notification | null>;
  findByUser(
    options: FindUserNotificationsOptions,
  ): Promise<{ items: Notification[]; total: number }>;
  findThreadsByUser(
    userId: string,
    page: number,
    limit: number,
    type?: NotificationType,
  ): Promise<{ threads: ThreadSummary[]; total: number }>;
  findByThread(threadId: string, userId: string): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAllReadForUser(userId: string): Promise<number>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
