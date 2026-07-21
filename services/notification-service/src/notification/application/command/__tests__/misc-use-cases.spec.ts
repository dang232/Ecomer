import { Test } from '@nestjs/testing';
import { RetryFailedDeliveriesUseCase } from '../retry-failed-deliveries.use-case';
import { MarkAllReadUseCase } from '../mark-all-read.use-case';
import { NOTIFICATION_REPOSITORY } from '../../../domain/port/outbound/notification.repository';
import { REALTIME_CHANNEL_PORT } from '../../../domain/port/outbound/realtime-channel.port';
import { CONNECTION_REGISTRY_PORT } from '../../../domain/port/outbound/connection-registry.port';
import { Notification } from '../../../domain/model/notification';
import { NotificationType } from '../../../domain/model/notification-type.enum';
import { Priority } from '../../../domain/model/priority.enum';
import { DeliveryStatusValue } from '../../../domain/model/delivery-status';

describe('RetryFailedDeliveriesUseCase', () => {
  let useCase: RetryFailedDeliveriesUseCase;

  const mockRepo = { save: jest.fn(), findDueRetries: jest.fn() };
  const mockChannel = { sendToUser: jest.fn() };
  const mockRegistry = { isOnline: jest.fn(), enqueueOffline: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RetryFailedDeliveriesUseCase,
        { provide: NOTIFICATION_REPOSITORY, useValue: mockRepo },
        { provide: REALTIME_CHANNEL_PORT, useValue: mockChannel },
        { provide: CONNECTION_REGISTRY_PORT, useValue: mockRegistry },
      ],
    }).compile();
    useCase = module.get(RetryFailedDeliveriesUseCase);
  });

  const failedNotification = (priority = Priority.MEDIUM): Notification => {
    const notification = Notification.create({
      userId: 'user-1',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
      priority,
    });
    notification.markFailed(new Date('2026-01-01T00:00:00.000Z'));
    return notification;
  };

  it('retries due failed deliveries and persists the successful retry', async () => {
    const notification = failedNotification();
    const now = new Date('2026-01-01T00:01:00.000Z');
    mockRepo.findDueRetries.mockResolvedValue([notification]);
    mockRegistry.isOnline.mockResolvedValue(true);
    mockChannel.sendToUser.mockResolvedValue(undefined);

    await expect(useCase.execute(now)).resolves.toEqual({
      retried: 1,
      movedToDlq: 0,
    });

    expect(mockRepo.findDueRetries).toHaveBeenCalledWith(now, 100);
    expect(mockChannel.sendToUser).toHaveBeenCalledWith('user-1', notification);
    expect(notification.retryCount).toBe(1);
    expect(notification.deliveryStatus.getValue()).toBe(DeliveryStatusValue.SENT);
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
  });

  it('moves exhausted failures to the DLQ without dispatching them again', async () => {
    const notification = failedNotification(Priority.LOW);
    notification.incrementRetry();
    mockRepo.findDueRetries.mockResolvedValue([notification]);

    await expect(useCase.execute()).resolves.toEqual({
      retried: 0,
      movedToDlq: 1,
    });

    expect(notification.deliveryStatus.getValue()).toBe(DeliveryStatusValue.DLQ);
    expect(mockChannel.sendToUser).not.toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalledWith(notification);
  });

  it('returns a failed retry to the DLQ when its final attempt fails', async () => {
    const notification = failedNotification(Priority.LOW);
    mockRepo.findDueRetries.mockResolvedValue([notification]);
    mockRegistry.isOnline.mockResolvedValue(true);
    mockChannel.sendToUser.mockRejectedValue(new Error('socket unavailable'));

    await expect(useCase.execute()).resolves.toEqual({
      retried: 1,
      movedToDlq: 1,
    });

    expect(notification.deliveryStatus.getValue()).toBe(DeliveryStatusValue.DLQ);
    expect(notification.nextRetryAt).toBeNull();
  });

  it('caps retry sweeps to 100 notifications', async () => {
    mockRepo.findDueRetries.mockResolvedValue([]);

    await useCase.execute(new Date(), 1_000);

    expect(mockRepo.findDueRetries).toHaveBeenCalledWith(expect.any(Date), 100);
  });
});

describe('MarkAllReadUseCase', () => {
  let useCase: MarkAllReadUseCase;

  const mockRepo = {
    markAllReadForUser: jest.fn().mockResolvedValue(3),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MarkAllReadUseCase,
        { provide: NOTIFICATION_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();
    useCase = module.get(MarkAllReadUseCase);
  });

  it('delegates to repo.markAllReadForUser and returns count', async () => {
    const result = await useCase.execute('user-1');
    expect(result).toBe(3);
    expect(mockRepo.markAllReadForUser).toHaveBeenCalledWith('user-1');
  });

  it('returns 0 when no notifications were updated', async () => {
    mockRepo.markAllReadForUser.mockResolvedValue(0);
    const result = await useCase.execute('user-no-notifs');
    expect(result).toBe(0);
  });
});
