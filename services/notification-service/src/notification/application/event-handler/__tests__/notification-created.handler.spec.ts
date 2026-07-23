import { Test } from '@nestjs/testing';
import { NotificationCreatedHandler } from '../notification-created.handler';
import { NOTIFICATION_REPOSITORY } from '../../../domain/port/outbound/notification.repository';
import { REALTIME_CHANNEL_PORT } from '../../../domain/port/outbound/realtime-channel.port';
import { CONNECTION_REGISTRY_PORT } from '../../../domain/port/outbound/connection-registry.port';
import { NOTIFICATION_PREFERENCES_REPOSITORY } from '../../../domain/port/outbound/notification-preferences.repository';
import { EMAIL_CHANNEL_PORT } from '../../../domain/port/outbound/email-channel.port';
import { PUSH_CHANNEL_PORT } from '../../../domain/port/outbound/push-channel.port';
import { SMS_CHANNEL_PORT } from '../../../domain/port/outbound/sms-channel.port';
import { Notification } from '../../../domain/model/notification';
import { NotificationType } from '../../../domain/model/notification-type.enum';
import {
  NotificationChannel,
  NotificationPreferences,
} from '../../../domain/model/notification-preferences';
import { NotificationCreatedEvent } from '../../../domain/event/notification-created.event';

describe('NotificationCreatedHandler', () => {
  let handler: NotificationCreatedHandler;
  const mockRepo = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const mockChannel = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendBatchToUser: jest.fn().mockResolvedValue(undefined),
  };
  const mockRegistry = {
    isOnline: jest.fn(),
    enqueueOffline: jest.fn().mockResolvedValue(undefined),
  };
  const mockPrefsRepo = {
    findByUserId: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const mockEmailChannel = {
    send: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockReturnValue(false),
  };
  const mockPushChannel = {
    send: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockReturnValue(false),
  };
  const mockSmsChannel = {
    send: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationCreatedHandler,
        { provide: NOTIFICATION_REPOSITORY, useValue: mockRepo },
        { provide: REALTIME_CHANNEL_PORT, useValue: mockChannel },
        { provide: CONNECTION_REGISTRY_PORT, useValue: mockRegistry },
        {
          provide: NOTIFICATION_PREFERENCES_REPOSITORY,
          useValue: mockPrefsRepo,
        },
        { provide: EMAIL_CHANNEL_PORT, useValue: mockEmailChannel },
        { provide: PUSH_CHANNEL_PORT, useValue: mockPushChannel },
        { provide: SMS_CHANNEL_PORT, useValue: mockSmsChannel },
      ],
    }).compile();
    handler = module.get(NotificationCreatedHandler);
  });

  it('delivers via realtime channel when user is online', async () => {
    const notification = Notification.create({
      userId: 'user-1',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-1',
        NotificationType.ORDER_CREATED,
      ),
    );

    expect(mockChannel.sendToUser).toHaveBeenCalledWith('user-1', notification);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('enqueues offline when user is not connected', async () => {
    const notification = Notification.create({
      userId: 'user-2',
      type: NotificationType.ORDER_SHIPPED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-2',
        NotificationType.ORDER_SHIPPED,
      ),
    );

    expect(mockChannel.sendToUser).not.toHaveBeenCalled();
    expect(mockRegistry.enqueueOffline).toHaveBeenCalledWith(
      'user-2',
      notification.id,
    );
  });

  it('marks failed and enqueues offline on delivery error', async () => {
    const notification = Notification.create({
      userId: 'user-3',
      type: NotificationType.PAYMENT_COMPLETED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(true);
    mockChannel.sendToUser.mockRejectedValue(new Error('Socket timeout'));

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-3',
        NotificationType.PAYMENT_COMPLETED,
      ),
    );

    expect(mockRegistry.enqueueOffline).toHaveBeenCalledWith(
      'user-3',
      notification.id,
    );
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('dispatches email when channel is enabled and recipientEmail is provided', async () => {
    const notification = Notification.create({
      userId: 'user-4',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockEmailChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-4',
        NotificationType.ORDER_CREATED,
        [],
        'user4@example.com',
      ),
    );

    expect(mockEmailChannel.send).toHaveBeenCalledWith(
      { userId: 'user-4', email: 'user4@example.com' },
      notification,
    );
  });

  it('skips email dispatch when recipientEmail is absent', async () => {
    const notification = Notification.create({
      userId: 'user-5',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockEmailChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-5',
        NotificationType.ORDER_CREATED,
      ),
    );

    expect(mockEmailChannel.send).not.toHaveBeenCalled();
  });

  it('dispatches push when channel is enabled and deviceToken is provided', async () => {
    const notification = Notification.create({
      userId: 'user-6',
      type: NotificationType.ORDER_SHIPPED,
      title: 'Shipped',
      body: 'On the way',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockPushChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-6',
        NotificationType.ORDER_SHIPPED,
        [],
        undefined,
        'device-token-abc',
      ),
    );

    expect(mockPushChannel.send).toHaveBeenCalledWith(
      { userId: 'user-6', deviceToken: 'device-token-abc' },
      'Shipped',
      'On the way',
      undefined,
    );
  });

  it('skips push dispatch when push channel is disabled', async () => {
    const notification = Notification.create({
      userId: 'user-7',
      type: NotificationType.ORDER_SHIPPED,
      title: 'Shipped',
      body: 'On the way',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockPushChannel.isEnabled.mockReturnValue(false);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-7',
        NotificationType.ORDER_SHIPPED,
        [],
        undefined,
        'device-token-xyz',
      ),
    );

    expect(mockPushChannel.send).not.toHaveBeenCalled();
  });

  it('dispatches SMS when channel is enabled and phoneNumber is provided', async () => {
    const notification = Notification.create({
      userId: 'user-8',
      type: NotificationType.ORDER_CREATED,
      title: 'Order',
      body: 'Created',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockSmsChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-8',
        NotificationType.ORDER_CREATED,
        [],
        undefined,
        undefined,
        '+84900000001',
      ),
    );

    expect(mockSmsChannel.send).toHaveBeenCalledWith(
      { userId: 'user-8', phoneNumber: '+84900000001' },
      notification,
    );
  });

  it('skips SMS dispatch when SMS channel is disabled', async () => {
    const notification = Notification.create({
      userId: 'user-9',
      type: NotificationType.ORDER_CREATED,
      title: 'Order',
      body: 'Created',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockSmsChannel.isEnabled.mockReturnValue(false);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-9',
        NotificationType.ORDER_CREATED,
        [],
        undefined,
        undefined,
        '+84900000002',
      ),
    );

    expect(mockSmsChannel.send).not.toHaveBeenCalled();
  });

  it('skips SMS dispatch when phoneNumber is absent', async () => {
    const notification = Notification.create({
      userId: 'user-10',
      type: NotificationType.ORDER_CREATED,
      title: 'Order',
      body: 'Created',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockSmsChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-10',
        NotificationType.ORDER_CREATED,
        // no phoneNumber
      ),
    );

    expect(mockSmsChannel.send).not.toHaveBeenCalled();
  });

  it('does not throw when email dispatch throws an error', async () => {
    const notification = Notification.create({
      userId: 'user-11',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockEmailChannel.isEnabled.mockReturnValue(true);
    mockEmailChannel.send.mockRejectedValue(new Error('SES down'));

    await expect(
      handler.handle(
        new NotificationCreatedEvent(
          notification.id,
          'user-11',
          NotificationType.ORDER_CREATED,
          [],
          'user11@example.com',
        ),
      ),
    ).resolves.not.toThrow();
  });

  it('does not throw when push dispatch throws an error', async () => {
    const notification = Notification.create({
      userId: 'user-12',
      type: NotificationType.ORDER_SHIPPED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockPushChannel.isEnabled.mockReturnValue(true);
    mockPushChannel.send.mockRejectedValue(new Error('FCM down'));

    await expect(
      handler.handle(
        new NotificationCreatedEvent(
          notification.id,
          'user-12',
          NotificationType.ORDER_SHIPPED,
          [],
          undefined,
          'device-token-err',
        ),
      ),
    ).resolves.not.toThrow();
  });

  it('does not throw when SMS dispatch throws an error', async () => {
    const notification = Notification.create({
      userId: 'user-13',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockSmsChannel.isEnabled.mockReturnValue(true);
    mockSmsChannel.send.mockRejectedValue(new Error('Twilio down'));

    await expect(
      handler.handle(
        new NotificationCreatedEvent(
          notification.id,
          'user-13',
          NotificationType.ORDER_CREATED,
          [],
          undefined,
          undefined,
          '+84900000099',
        ),
      ),
    ).resolves.not.toThrow();
  });

  it('skips in-app delivery when IN_APP channel is in suppressedChannels', async () => {
    const notification = Notification.create({
      userId: 'user-14',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-14',
        NotificationType.ORDER_CREATED,
        [NotificationChannel.IN_APP],
      ),
    );

    expect(mockChannel.sendToUser).not.toHaveBeenCalled();
    expect(notification.deliveryStatus.getValue()).toBe('QUEUED');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('does not report success when every channel is disabled', async () => {
    const notification = Notification.create({
      userId: 'user-disabled',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        notification.userId,
        notification.type,
        [
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
          NotificationChannel.PUSH,
          NotificationChannel.SMS,
        ],
        'user@example.com',
        'device-token',
        '+84900000000',
      ),
    );

    expect(notification.deliveryStatus.getValue()).toBe('QUEUED');
    expect(mockChannel.sendToUser).not.toHaveBeenCalled();
    expect(mockEmailChannel.send).not.toHaveBeenCalled();
    expect(mockPushChannel.send).not.toHaveBeenCalled();
    expect(mockSmsChannel.send).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('returns early when notification is not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      handler.handle(
        new NotificationCreatedEvent(
          'non-existent-id',
          'user-15',
          NotificationType.ORDER_CREATED,
        ),
      ),
    ).resolves.not.toThrow();

    expect(mockChannel.sendToUser).not.toHaveBeenCalled();
  });

  it('skips channel when prefs exist and channel is disabled for type', async () => {
    const notification = Notification.create({
      userId: 'user-16',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(true);

    // Prefs with IN_APP disabled for ORDER_CREATED
    const prefs = NotificationPreferences.createDefault('user-16');
    prefs.setTypeChannels(NotificationType.ORDER_CREATED, []);
    mockPrefsRepo.findByUserId.mockResolvedValue(prefs);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-16',
        NotificationType.ORDER_CREATED,
      ),
    );

    // IN_APP was disabled by prefs so no realtime delivery
    expect(mockChannel.sendToUser).not.toHaveBeenCalled();
  });

  it('delivers in-app when prefs exist and channel is enabled for type', async () => {
    const notification = Notification.create({
      userId: 'user-17',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(true);
    mockChannel.sendToUser.mockResolvedValue(undefined);

    // Prefs with IN_APP enabled for ORDER_CREATED
    const prefs = NotificationPreferences.createDefault('user-17');
    prefs.setTypeChannels(NotificationType.ORDER_CREATED, [
      NotificationChannel.IN_APP,
    ]);
    mockPrefsRepo.findByUserId.mockResolvedValue(prefs);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-17',
        NotificationType.ORDER_CREATED,
      ),
    );

    expect(mockChannel.sendToUser).toHaveBeenCalledWith(
      'user-17',
      notification,
    );
  });

  it('skips email when emailChannel.isEnabled() returns false even with enabled=true and recipientEmail', async () => {
    const notification = Notification.create({
      userId: 'user-22',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockPrefsRepo.findByUserId.mockResolvedValue(null);
    // isChannelActive(EMAIL) = true (not suppressed, prefs=null → allow all)
    // but emailChannel.isEnabled() = false → should skip at line 135
    mockEmailChannel.isEnabled.mockReturnValue(false);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-22',
        NotificationType.ORDER_CREATED,
        [], // no suppressed channels
        'user22@example.com',
      ),
    );

    expect(mockEmailChannel.send).not.toHaveBeenCalled();
  });

  it('skips email dispatch when EMAIL channel is in suppressedChannels', async () => {
    const notification = Notification.create({
      userId: 'user-18',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockEmailChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-18',
        NotificationType.ORDER_CREATED,
        [NotificationChannel.EMAIL], // EMAIL suppressed
        'user18@example.com',
      ),
    );

    expect(mockEmailChannel.send).not.toHaveBeenCalled();
  });

  it('dispatches push with deepLink data when notification has a deepLink', async () => {
    const notification = Notification.create({
      userId: 'user-19',
      type: NotificationType.ORDER_SHIPPED,
      title: 'Shipped',
      body: 'On the way',
      deepLink: '/orders/123',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockPushChannel.isEnabled.mockReturnValue(true);
    mockPrefsRepo.findByUserId.mockResolvedValue(null);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-19',
        NotificationType.ORDER_SHIPPED,
        [],
        undefined,
        'device-token-dl',
      ),
    );

    expect(mockPushChannel.send).toHaveBeenCalledWith(
      { userId: 'user-19', deviceToken: 'device-token-dl' },
      'Shipped',
      'On the way',
      { deepLink: '/orders/123' },
    );
  });

  it('uses default prefs (null) and allows all channels when prefsRepo returns null', async () => {
    const notification = Notification.create({
      userId: 'user-20',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(true);
    mockPrefsRepo.findByUserId.mockResolvedValue(null); // null prefs → default allow-all

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-20',
        NotificationType.ORDER_CREATED,
        [], // no suppressedChannels
      ),
    );

    // With null prefs, IN_APP is active → realtime delivery attempted
    expect(mockChannel.sendToUser).toHaveBeenCalledWith(
      'user-20',
      notification,
    );
  });

  it('skips SMS dispatch when SMS channel is in suppressedChannels', async () => {
    const notification = Notification.create({
      userId: 'user-21',
      type: NotificationType.ORDER_CREATED,
      title: 'T',
      body: 'B',
    });
    mockRepo.findById.mockResolvedValue(notification);
    mockRegistry.isOnline.mockResolvedValue(false);
    mockSmsChannel.isEnabled.mockReturnValue(true);

    await handler.handle(
      new NotificationCreatedEvent(
        notification.id,
        'user-21',
        NotificationType.ORDER_CREATED,
        [NotificationChannel.SMS], // SMS suppressed
        undefined,
        undefined,
        '+84900000099',
      ),
    );

    expect(mockSmsChannel.send).not.toHaveBeenCalled();
  });
});
