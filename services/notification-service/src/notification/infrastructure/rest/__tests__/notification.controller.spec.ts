import { Test } from '@nestjs/testing';
import { NotificationRestController } from '../notification.controller';
import { FindUserNotificationsUseCase } from '../../../application/query/find-user-notifications.use-case';
import { FindNotificationThreadsUseCase } from '../../../application/query/find-notification-threads.use-case';
import { FindThreadNotificationsUseCase } from '../../../application/query/find-thread-notifications.use-case';
import { CountUnreadUseCase } from '../../../application/query/count-unread.use-case';
import { GetNotificationUseCase } from '../../../application/query/get-notification.use-case';
import { MarkNotificationReadUseCase } from '../../../application/command/mark-notification-read.use-case';
import { MarkAllReadUseCase } from '../../../application/command/mark-all-read.use-case';
import { SendNotificationUseCase } from '../../../application/command/send-notification.use-case';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Notification } from '../../../domain/model/notification';
import { NotificationType } from '../../../domain/model/notification-type.enum';

describe('NotificationRestController', () => {
  let controller: NotificationRestController;

  const mockFindNotifications = {
    execute: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 0,
      limit: 20,
      totalPages: 0,
    }),
  };
  const mockFindThreads = {
    execute: jest.fn().mockResolvedValue({
      threads: [],
      total: 0,
      page: 0,
      limit: 20,
      totalPages: 0,
    }),
  };
  const mockFindThreadNotifs = { execute: jest.fn().mockResolvedValue([]) };
  const mockCountUnread = { execute: jest.fn().mockResolvedValue(5) };
  const mockGetNotification = {
    execute: jest.fn().mockImplementation(() => {
      return Notification.create({
        userId: 'u1',
        type: NotificationType.ORDER_CREATED,
        title: 'T',
        body: 'B',
      });
    }),
  };
  const mockMarkRead = {
    execute: jest.fn().mockImplementation(() => {
      return Notification.create({
        userId: 'u1',
        type: NotificationType.ORDER_CREATED,
        title: 'T',
        body: 'B',
      });
    }),
  };
  const mockMarkAllRead = { execute: jest.fn().mockResolvedValue(3) };
  const mockSendNotification = {
    execute: jest.fn().mockImplementation(() => {
      return Notification.create({
        userId: 'u1',
        type: NotificationType.ORDER_CREATED,
        title: 'Test',
        body: 'Test body',
      });
    }),
  };

  const mockReq = { user: { sub: 'user-1' } } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [NotificationRestController],
      providers: [
        {
          provide: FindUserNotificationsUseCase,
          useValue: mockFindNotifications,
        },
        { provide: FindNotificationThreadsUseCase, useValue: mockFindThreads },
        {
          provide: FindThreadNotificationsUseCase,
          useValue: mockFindThreadNotifs,
        },
        { provide: CountUnreadUseCase, useValue: mockCountUnread },
        { provide: GetNotificationUseCase, useValue: mockGetNotification },
        { provide: MarkNotificationReadUseCase, useValue: mockMarkRead },
        { provide: MarkAllReadUseCase, useValue: mockMarkAllRead },
        { provide: SendNotificationUseCase, useValue: mockSendNotification },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(NotificationRestController);
  });

  it('GET / returns paginated response', async () => {
    const result = await controller.list(mockReq, undefined, undefined, 0, 20);
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('totalElements', 0);
    expect(result).toHaveProperty('totalPages', 0);
    expect(result).toHaveProperty('number', 0);
    expect(result).toHaveProperty('size', 20);
  });

  it('GET / passes type filter to use case', async () => {
    await controller.list(mockReq, 'ORDER_CREATED', undefined, 0, 20);
    expect(mockFindNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.ORDER_CREATED }),
    );
  });

  it('GET / ignores invalid type filter', async () => {
    await controller.list(mockReq, 'INVALID_TYPE', undefined, 0, 20);
    expect(mockFindNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined }),
    );
  });

  it('GET /unread-count returns count', async () => {
    const result = await controller.unreadCount(mockReq);
    expect(result).toEqual({ count: 5 });
    expect(mockCountUnread.execute).toHaveBeenCalledWith('user-1');
  });

  it('GET /:id returns an owner-scoped notification', async () => {
    const result = await controller.getNotificationById(mockReq, 'notif-123');
    expect(result).toHaveProperty('id');
    expect(mockGetNotification.execute).toHaveBeenCalledWith('notif-123', 'user-1');
  });

  it('GET /threads returns paginated threads', async () => {
    const result = await controller.threads(mockReq, undefined, 0, 20);
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('totalElements');
  });

  it('POST /mark-all-read returns updated count', async () => {
    const result = await controller.markAllNotificationsRead(mockReq);
    expect(result).toEqual({ updated: 3 });
    expect(mockMarkAllRead.execute).toHaveBeenCalledWith('user-1');
  });

  it('POST /:id/read returns notification DTO', async () => {
    const result = await controller.markNotificationRead(mockReq, 'notif-123');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('type', 'ORDER_CREATED');
    expect(mockMarkRead.execute).toHaveBeenCalledWith('notif-123', 'user-1');
  });

  it('POST /test returns notification DTO in non-production env', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const result = await controller.createTestNotification(mockReq);
    process.env.NODE_ENV = origEnv;
    expect(result).toHaveProperty('id');
    expect(mockSendNotification.execute).toHaveBeenCalled();
  });

  it('POST /test throws ForbiddenException in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await expect(controller.createTestNotification(mockReq)).rejects.toThrow(
      'Test endpoint disabled in production',
    );
    process.env.NODE_ENV = origEnv;
  });

  it('POST /test returns suppressed response when sendNotification returns null', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    mockSendNotification.execute.mockResolvedValueOnce(null);

    const result = await controller.createTestNotification(mockReq);
    process.env.NODE_ENV = origEnv;
    expect(result).toEqual({
      suppressed: true,
      message: 'All channels disabled for this type',
    });
  });

  it('GET / sets first=true when page=0', async () => {
    const result = await controller.list(mockReq, undefined, undefined, 0, 20);
    expect(result.first).toBe(true);
  });

  it('GET / sets last=true when on last page', async () => {
    mockFindNotifications.execute.mockResolvedValueOnce({
      items: [],
      total: 5,
      page: 0,
      limit: 20,
      totalPages: 1,
    });

    const result = await controller.list(mockReq, undefined, undefined, 0, 20);
    expect(result.last).toBe(true);
  });

  it('GET / caps size at 100', async () => {
    await controller.list(mockReq, undefined, undefined, 0, 999);
    expect(mockFindNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('GET /threads filters by valid type', async () => {
    await controller.threads(mockReq, 'ORDER_CREATED', 0, 20);
    expect(mockFindThreads.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.ORDER_CREATED }),
    );
  });

  it('GET /threads ignores invalid type', async () => {
    await controller.threads(mockReq, 'BOGUS', 0, 20);
    expect(mockFindThreads.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined }),
    );
  });

  it('GET /threads/:threadId returns thread notifications', async () => {
    const result = await controller.threadNotifications(mockReq, 'order:123');
    expect(Array.isArray(result)).toBe(true);
    expect(mockFindThreadNotifs.execute).toHaveBeenCalledWith(
      'order:123',
      'user-1',
    );
  });
});
