import { Test } from '@nestjs/testing';
import { KafkaEventConsumer } from '../kafka-event.consumer';
import { SendNotificationUseCase } from '../../../application/command/send-notification.use-case';
import { NotificationType } from '../../../domain/model/notification-type.enum';
import { Priority } from '../../../domain/model/priority.enum';

describe('KafkaEventConsumer', () => {
  let consumer: KafkaEventConsumer;
  const mockSendNotification = {
    execute: jest.fn().mockResolvedValue({ id: 'n1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        KafkaEventConsumer,
        { provide: SendNotificationUseCase, useValue: mockSendNotification },
      ],
    }).compile();
    consumer = module.get(KafkaEventConsumer);
  });

  it('order.created sends to both buyer and seller', async () => {
    await consumer.handleOrderCreated({
      orderId: 'ORD-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledTimes(2);
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-1',
        type: NotificationType.ORDER_CREATED,
        threadId: 'order:ORD-1',
      }),
    );
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        type: NotificationType.SELLER_NEW_ORDER,
        threadId: 'seller-order:ORD-1',
      }),
    );
  });

  it('order.shipped sends to buyer only', async () => {
    await consumer.handleOrderShipped({ orderId: 'ORD-2', buyerId: 'buyer-2' });

    expect(mockSendNotification.execute).toHaveBeenCalledTimes(1);
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-2',
        type: NotificationType.ORDER_SHIPPED,
        title: 'Đơn hàng đang vận chuyển',
        priority: Priority.HIGH,
        idempotencyKey: 'order.shipped:ORD-2:ORDER_SHIPPED',
      }),
    );
  });

  it('product.approved sends to seller', async () => {
    await consumer.handleProductApproved({
      productId: 'P-1',
      productName: 'Áo thun',
      sellerId: 'seller-1',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        type: NotificationType.PRODUCT_APPROVED,
        deepLink: '/seller/products/P-1',
        threadId: 'product:P-1',
      }),
    );
  });

  it('payout.completed sends to seller', async () => {
    await consumer.handlePayoutCompleted({
      payoutId: 'PAY-1',
      amount: '5000000',
      sellerId: 'seller-2',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-2',
        type: NotificationType.PAYOUT_COMPLETED,

        body: expect.stringContaining('5000000'),
      }),
    );
  });

  it('skips when recipient is missing', async () => {
    await consumer.handleOrderShipped({ orderId: 'ORD-3' }); // no buyerId
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('does not throw on sendNotification failure', async () => {
    mockSendNotification.execute.mockRejectedValue(new Error('DB down'));
    await expect(
      consumer.handleOrderCreated({
        orderId: 'ORD-4',
        buyerId: 'b1',
        sellerId: 's1',
      }),
    ).resolves.not.toThrow();
  });

  it('order.cancelled sends to buyer only', async () => {
    await consumer.handleOrderCancelled({
      orderId: 'ORD-5',
      buyerId: 'buyer-5',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledTimes(1);
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-5',
        type: NotificationType.ORDER_CANCELLED,
        idempotencyKey: 'order.cancelled:ORD-5:ORDER_CANCELLED',
      }),
    );
  });

  it('return.requested sends to seller', async () => {
    await consumer.handleReturnRequested({
      orderId: 'ORD-6',
      returnId: 'RET-1',
      sellerId: 'seller-6',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-6',
        type: NotificationType.RETURN_REQUESTED,
        threadId: 'return:RET-1',
      }),
    );
  });

  it('review.replied sends to buyer', async () => {
    await consumer.handleReviewReplied({
      reviewId: 'REV-1',
      productId: 'P-2',
      productName: 'Giày thể thao',
      buyerId: 'buyer-7',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-7',
        type: NotificationType.REVIEW_REPLIED,
        threadId: 'review:REV-1',
      }),
    );
  });

  it('order.delivered sends to buyer', async () => {
    await consumer.handleOrderDelivered({
      orderId: 'ORD-20',
      buyerId: 'buyer-20',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-20',
        type: NotificationType.ORDER_DELIVERED,
        idempotencyKey: 'order.delivered:ORD-20:ORDER_DELIVERED',
      }),
    );
  });

  it('order.delivered skips when buyerId absent', async () => {
    await consumer.handleOrderDelivered({ orderId: 'ORD-20' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('payment.completed sends to buyer', async () => {
    await consumer.handlePaymentCompleted({
      orderId: 'ORD-21',
      buyerId: 'buyer-21',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-21',
        type: NotificationType.PAYMENT_COMPLETED,
        idempotencyKey: 'payment.completed:ORD-21:PAYMENT_COMPLETED',
      }),
    );
  });

  it('payment.completed skips when buyerId absent', async () => {
    await consumer.handlePaymentCompleted({ orderId: 'ORD-21' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('payment.refunded sends to buyer', async () => {
    await consumer.handlePaymentRefunded({
      orderId: 'ORD-22',
      buyerId: 'buyer-22',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-22',
        type: NotificationType.PAYMENT_REFUNDED,
        idempotencyKey: 'payment.refunded:ORD-22:PAYMENT_REFUNDED',
      }),
    );
  });

  it('payment.refunded skips when buyerId absent', async () => {
    await consumer.handlePaymentRefunded({ orderId: 'ORD-22' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('product.rejected sends to seller', async () => {
    await consumer.handleProductRejected({
      productId: 'P-3',
      productName: 'Tablet',
      sellerId: 'seller-23',
      reason: 'Ảnh không rõ',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-23',
        type: NotificationType.PRODUCT_REJECTED,

        body: expect.stringContaining('Ảnh không rõ'),
      }),
    );
  });

  it('product.rejected skips when sellerId absent', async () => {
    await consumer.handleProductRejected({
      productId: 'P-3',
      productName: 'Tablet',
    });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('user.registered sends to user with email', async () => {
    await consumer.handleUserRegistered({
      userId: 'user-24',
      email: 'user24@example.com',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-24',
        type: NotificationType.USER_REGISTERED,
        recipientEmail: 'user24@example.com',
        idempotencyKey: 'user.registered:user-24:USER_REGISTERED',
      }),
    );
  });

  it('user.registered skips when userId absent', async () => {
    await consumer.handleUserRegistered({ email: 'nobody@example.com' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('user.password-reset sends to user with resetLink', async () => {
    await consumer.handleUserPasswordReset({
      userId: 'user-25',
      resetLink: '/auth/reset?token=xyz',
    });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-25',
        type: NotificationType.USER_PASSWORD_RESET,
        deepLink: '/auth/reset?token=xyz',
        idempotencyKey: 'user.password-reset:user-25:USER_PASSWORD_RESET',
      }),
    );
  });

  it('user.password-reset uses default deepLink when resetLink absent', async () => {
    await consumer.handleUserPasswordReset({ userId: 'user-26' });

    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        deepLink: '/auth/reset-password',
      }),
    );
  });

  it('user.password-reset skips when userId absent', async () => {
    await consumer.handleUserPasswordReset({ email: 'nobody@example.com' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('return.requested skips when sellerId absent', async () => {
    await consumer.handleReturnRequested({
      orderId: 'ORD-27',
      returnId: 'RET-27',
    });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('payout.completed skips when sellerId absent', async () => {
    await consumer.handlePayoutCompleted({ payoutId: 'PAY-27' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('order.cancelled skips when buyerId absent', async () => {
    await consumer.handleOrderCancelled({ orderId: 'ORD-28' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('review.replied skips when buyerId absent', async () => {
    await consumer.handleReviewReplied({
      reviewId: 'REV-2',
      productId: 'P-4',
      productName: 'X',
    });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('product.approved skips when sellerId absent', async () => {
    await consumer.handleProductApproved({
      productId: 'P-5',
      productName: 'Y',
    });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('order.created skips both when neither buyerId nor sellerId present', async () => {
    await consumer.handleOrderCreated({ orderId: 'ORD-29' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('order.created sends only to seller when buyerId absent', async () => {
    await consumer.handleOrderCreated({
      orderId: 'ORD-30',
      sellerId: 'seller-30',
    });
    expect(mockSendNotification.execute).toHaveBeenCalledTimes(1);
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-30',
        type: NotificationType.SELLER_NEW_ORDER,
      }),
    );
  });

  it('order.shipped skips when buyerId absent', async () => {
    await consumer.handleOrderShipped({ orderId: 'ORD-31' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  // --- Video event handlers ---

  it('handleVideoPublished sends notification to uploader', async () => {
    await consumer.handleVideoPublished({
      videoId: 'VID-1',
      uploaderId: 'user-100',
    });
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-100',
        type: NotificationType.VIDEO_PUBLISHED,
      }),
    );
  });

  it('handleVideoPublished skips when uploaderId missing', async () => {
    await consumer.handleVideoPublished({ videoId: 'VID-1' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('handleVideoRejected sends notification with reason', async () => {
    await consumer.handleVideoRejected({
      videoId: 'VID-2',
      uploaderId: 'user-200',
      reason: 'NSFW content',
    });
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('NSFW content'),
        type: NotificationType.VIDEO_REJECTED,
      }),
    );
  });

  it('handleVideoRejected skips when uploaderId missing', async () => {
    await consumer.handleVideoRejected({ videoId: 'VID-2', reason: 'test' });
    expect(mockSendNotification.execute).not.toHaveBeenCalled();
  });

  it('handleVideoPublished without videoId uses fallback deepLink and no threadId', async () => {
    await consumer.handleVideoPublished({ uploaderId: 'user-300' });
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-300',
        deepLink: '/seller/videos',
        threadId: undefined,
        threadTitle: undefined,
        idempotencyKey: undefined,
      }),
    );
  });

  it('handleVideoRejected without videoId uses fallback deepLink', async () => {
    await consumer.handleVideoRejected({
      uploaderId: 'user-400',
      reason: 'Spam',
    });
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-400',
        deepLink: '/seller/videos',
        threadId: undefined,
      }),
    );
  });

  it('handleVideoRejected without reason uses default Vietnamese message', async () => {
    await consumer.handleVideoRejected({
      videoId: 'VID-3',
      uploaderId: 'user-500',
    });
    expect(mockSendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Không có lý do được cung cấp'),
      }),
    );
  });
});
