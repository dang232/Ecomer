import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationRepository,
  FindUserNotificationsOptions,
  ThreadSummary,
} from '../../domain/port/outbound/notification.repository';
import { Notification } from '../../domain/model/notification';
import { NotificationType } from '../../domain/model/notification-type.enum';
import { DeliveryStatusValue } from '../../domain/model/delivery-status';
import { NotificationSchemaClass } from './mongo-notification.schema';
import { NotificationMapper } from './notification.mapper';

@Injectable()
export class MongoNotificationRepository implements NotificationRepository {
  /* istanbul ignore next */
  constructor(
    @InjectModel(NotificationSchemaClass.name)
    private readonly model: Model<NotificationSchemaClass>,
  ) {}

  async save(notification: Notification): Promise<void> {
    const doc = NotificationMapper.toPersistence(notification);
    await this.model.findOneAndUpdate(
      { id: notification.id },
      { $set: doc },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<Notification | null> {
    const doc = await this.model.findOne({ id }).lean();
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Notification[]> {
    if (ids.length === 0) return [];
    const docs = await this.model.find({ id: { $in: ids } }).lean();
    return docs.map((d) =>
      NotificationMapper.toDomain(d as unknown as NotificationSchemaClass),
    );
  }

  async findDueRetries(now: Date, limit: number): Promise<Notification[]> {
    const docs = await this.model
      .find({
        deliveryStatus: DeliveryStatusValue.FAILED,
        nextRetryAt: { $lte: now },
      })
      .sort({ nextRetryAt: 1 })
      .limit(limit)
      .lean();
    return docs.map((d) =>
      NotificationMapper.toDomain(d as unknown as NotificationSchemaClass),
    );
  }

  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<Notification | null> {
    const doc = await this.model.findOne({ id, userId }).lean();
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Notification | null> {
    const doc = await this.model.findOne({ idempotencyKey: key }).lean();
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByUser(
    options: FindUserNotificationsOptions,
  ): Promise<{ items: Notification[]; total: number }> {
    const { userId, type, threadId, page = 0, limit = 20 } = options;
    const filter: Record<string, unknown> = { userId };
    if (type) filter['type'] = type;
    if (threadId) filter['threadId'] = threadId;

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return {
      items: docs.map((d) =>
        NotificationMapper.toDomain(d as unknown as NotificationSchemaClass),
      ),
      total,
    };
  }

  async findThreadsByUser(
    userId: string,
    page: number,
    limit: number,
    type?: NotificationType,
  ): Promise<{ threads: ThreadSummary[]; total: number }> {
    const matchStage: Record<string, unknown> = {
      userId,
      threadId: { $ne: null },
    };
    if (type) matchStage['type'] = type;

    interface ThreadAggRow {
      _id: string;
      threadTitle: string;
      unreadCount: number;
      totalCount: number;
      latestAt: Date;
    }
    interface FacetResult {
      threads: ThreadAggRow[];
      count: Array<{ total: number }>;
    }

    const result = await this.model.aggregate<FacetResult>([
      { $match: matchStage },
      { $sort: { createdAt: -1 as const } },
      {
        $group: {
          _id: '$threadId',
          threadTitle: { $first: '$threadTitle' },
          unreadCount: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } },
          totalCount: { $sum: 1 },
          latestAt: { $max: '$createdAt' },
        },
      },
      { $sort: { latestAt: -1 as const } },
      {
        $facet: {
          threads: [{ $skip: page * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    ]);

    const facet: FacetResult = result[0] ?? { threads: [], count: [] };
    const total = facet.count[0]?.total ?? 0;
    const threads = facet.threads.map((t) => ({
      threadId: t._id,
      threadTitle: t.threadTitle,
      unreadCount: t.unreadCount,
      totalCount: t.totalCount,
      latestAt: t.latestAt,
    }));

    return { threads, total };
  }

  async findByThread(
    threadId: string,
    userId: string,
  ): Promise<Notification[]> {
    const docs = await this.model
      .find({ threadId, userId })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map((d) =>
      NotificationMapper.toDomain(d as unknown as NotificationSchemaClass),
    );
  }

  async countUnread(userId: string): Promise<number> {
    return this.model.countDocuments({ userId, read: false });
  }

  async markAllReadForUser(userId: string): Promise<number> {
    // Performance shortcut: bulk update bypasses Notification.markRead() domain method.
    // This is intentional — markRead() only sets read=true and readAt=now with no side effects.
    // If domain logic is added to markRead() in the future, this must be revisited.
    const result = await this.model.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return result.modifiedCount;
  }
}
