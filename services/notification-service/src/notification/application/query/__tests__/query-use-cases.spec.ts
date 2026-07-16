import { Test } from '@nestjs/testing';
import { FindUserNotificationsUseCase } from '../find-user-notifications.use-case';
import { FindNotificationThreadsUseCase } from '../find-notification-threads.use-case';
import { FindThreadNotificationsUseCase } from '../find-thread-notifications.use-case';
import { CountUnreadUseCase } from '../count-unread.use-case';
import { GetNotificationUseCase } from '../get-notification.use-case';
import { NOTIFICATION_REPOSITORY } from '../../../domain/port/outbound/notification.repository';
import { Notification } from '../../../domain/model/notification';
import { NotificationType } from '../../../domain/model/notification-type.enum';
import { NotFoundException } from '@nestjs/common';

describe('Query Use Cases', () => {
  const mockRepo = {
    findByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findThreadsByUser: jest.fn().mockResolvedValue({ threads: [], total: 0 }),
    findByThread: jest.fn().mockResolvedValue([]),
    findByIdAndUserId: jest.fn(),
    countUnread: jest.fn().mockResolvedValue(5),
  };

  let findNotifications: FindUserNotificationsUseCase;
  let findThreads: FindNotificationThreadsUseCase;
  let findThreadNotifs: FindThreadNotificationsUseCase;
  let countUnread: CountUnreadUseCase;
  let getNotification: GetNotificationUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FindUserNotificationsUseCase,
        FindNotificationThreadsUseCase,
        FindThreadNotificationsUseCase,
        CountUnreadUseCase,
        GetNotificationUseCase,
        { provide: NOTIFICATION_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();

    findNotifications = module.get(FindUserNotificationsUseCase);
    findThreads = module.get(FindNotificationThreadsUseCase);
    findThreadNotifs = module.get(FindThreadNotificationsUseCase);
    countUnread = module.get(CountUnreadUseCase);
    getNotification = module.get(GetNotificationUseCase);
  });

  describe('FindUserNotificationsUseCase', () => {
    it('passes type filter to repository', async () => {
      await findNotifications.execute({
        userId: 'u1',
        type: NotificationType.ORDER_CREATED,
      });
      expect(mockRepo.findByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: NotificationType.ORDER_CREATED,
        }),
      );
    });

    it('caps limit at 100', async () => {
      await findNotifications.execute({ userId: 'u1', limit: 999 });
      expect(mockRepo.findByUser).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    it('defaults page to 0 and limit to 20', async () => {
      await findNotifications.execute({ userId: 'u1' });
      expect(mockRepo.findByUser).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, limit: 20 }),
      );
    });

    it('calculates totalPages', async () => {
      mockRepo.findByUser.mockResolvedValue({ items: [], total: 45 });
      const result = await findNotifications.execute({
        userId: 'u1',
        limit: 20,
      });
      expect(result.totalPages).toBe(3);
    });
  });

  describe('FindNotificationThreadsUseCase', () => {
    it('passes type filter and caps limit at 50', async () => {
      await findThreads.execute({
        userId: 'u1',
        type: NotificationType.ORDER_SHIPPED,
        limit: 100,
      });
      expect(mockRepo.findThreadsByUser).toHaveBeenCalledWith(
        'u1',
        0,
        50,
        NotificationType.ORDER_SHIPPED,
      );
    });
  });

  describe('FindThreadNotificationsUseCase', () => {
    it('delegates to repository', async () => {
      await findThreadNotifs.execute('order:123', 'u1');
      expect(mockRepo.findByThread).toHaveBeenCalledWith('order:123', 'u1');
    });
  });

  describe('CountUnreadUseCase', () => {
    it('returns unread count', async () => {
      const count = await countUnread.execute('u1');
      expect(count).toBe(5);
      expect(mockRepo.countUnread).toHaveBeenCalledWith('u1');
    });
  });

  describe('GetNotificationUseCase', () => {
    it('returns an owned notification', async () => {
      const notification = Notification.create({
        userId: 'u1',
        type: NotificationType.ORDER_CREATED,
        title: 'Order created',
        body: 'Your order was created.',
      });
      mockRepo.findByIdAndUserId.mockResolvedValue(notification);

      await expect(getNotification.execute(notification.id, 'u1')).resolves.toBe(
        notification,
      );
      expect(mockRepo.findByIdAndUserId).toHaveBeenCalledWith(
        notification.id,
        'u1',
      );
    });

    it('returns not found for a notification owned by another user', async () => {
      mockRepo.findByIdAndUserId.mockResolvedValue(null);

      await expect(getNotification.execute('notification-1', 'u2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('FindNotificationThreadsUseCase - branch coverage', () => {
    it('uses page=0 when page is not provided', async () => {
      await findThreads.execute({ userId: 'u1' });
      expect(mockRepo.findThreadsByUser).toHaveBeenCalledWith(
        'u1',
        0,
        20,
        undefined,
      );
    });

    it('uses limit=20 when limit is not provided', async () => {
      await findThreads.execute({ userId: 'u1' });
      expect(mockRepo.findThreadsByUser).toHaveBeenCalledWith(
        'u1',
        0,
        20,
        undefined,
      );
    });

    it('passes type=undefined when type not provided', async () => {
      await findThreads.execute({ userId: 'u1', page: 1, limit: 10 });
      expect(mockRepo.findThreadsByUser).toHaveBeenCalledWith(
        'u1',
        1,
        10,
        undefined,
      );
    });
  });

  describe('FindUserNotificationsUseCase - branch coverage', () => {
    it('uses page=0 and limit=20 as defaults', async () => {
      await findNotifications.execute({ userId: 'u1' });
      expect(mockRepo.findByUser).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, limit: 20 }),
      );
    });

    it('passes threadId filter when provided', async () => {
      await findNotifications.execute({ userId: 'u1', threadId: 'order:123' });
      expect(mockRepo.findByUser).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'order:123' }),
      );
    });
  });

  describe('FindThreadNotificationsUseCase - branch coverage', () => {
    it('returns empty array from repo', async () => {
      mockRepo.findByThread.mockResolvedValue([]);
      const result = await findThreadNotifs.execute('thread:1', 'u1');
      expect(result).toEqual([]);
    });
  });
});
