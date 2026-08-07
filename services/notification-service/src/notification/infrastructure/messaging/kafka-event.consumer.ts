import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  SendNotificationCommand,
  SendNotificationUseCase,
} from '../../application/command/send-notification.use-case';
import { NotificationType } from '../../domain/model/notification-type.enum';
import { Priority } from '../../domain/model/priority.enum';

interface OrderEventPayload {
  orderId?: string;
  buyerId?: string;
  sellerId?: string;
  productId?: string;
  productName?: string;
  reviewId?: string;
  returnId?: string;
  payoutId?: string;
  amount?: string;
  reason?: string;
  [key: string]: unknown;
}

interface UserEventPayload {
  userId?: string;
  email?: string;
  phoneNumber?: string;
  resetLink?: string;
  [key: string]: unknown;
}

interface VideoEventPayload {
  videoId?: string;
  uploaderId?: string;
  ownerType?: string; // 'PRODUCT' | 'REVIEW'
  ownerId?: string;
  reason?: string;
  [key: string]: unknown;
}

@Controller()
export class KafkaEventConsumer {
  private readonly logger = new Logger(KafkaEventConsumer.name);

  /* istanbul ignore next */
  constructor(private readonly sendNotification: SendNotificationUseCase) {}

  @MessagePattern('order.created')
  async handleOrderCreated(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.ORDER_CREATED,
        title: 'Đặt hàng thành công',
        body: `Đơn hàng #${p.orderId} đã được đặt thành công.`,
        deepLink: `/orders/${p.orderId}`,
        priority: Priority.HIGH,
        threadId: `order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `order.created:${p.orderId}:ORDER_CREATED`,
      });
    }
    if (p.sellerId) {
      await this.send({
        userId: p.sellerId,
        type: NotificationType.SELLER_NEW_ORDER,
        title: 'Đơn hàng mới',
        body: `Bạn có đơn hàng mới #${p.orderId}.`,
        deepLink: p.orderId ? `/seller/orders?selected=${encodeURIComponent(p.orderId)}` : '/seller/orders',
        priority: Priority.HIGH,
        threadId: `seller-order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `order.created:${p.orderId}:SELLER_NEW_ORDER`,
      });
    }
  }

  @MessagePattern('order.cancelled')
  async handleOrderCancelled(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.ORDER_CANCELLED,
        title: 'Đơn hàng đã hủy',
        body: `Đơn hàng #${p.orderId} đã bị hủy.`,
        deepLink: `/orders/${p.orderId}`,
        priority: Priority.HIGH,
        threadId: `order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `order.cancelled:${p.orderId}:ORDER_CANCELLED`,
      });
    }
  }

  @MessagePattern('order.shipped')
  async handleOrderShipped(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.ORDER_SHIPPED,
        title: 'Đơn hàng đang vận chuyển',
        body: `Đơn hàng #${p.orderId} đã được giao cho đơn vị vận chuyển.`,
        deepLink: `/orders/${p.orderId}`,
        priority: Priority.HIGH,
        threadId: `order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `order.shipped:${p.orderId}:ORDER_SHIPPED`,
      });
    }
  }

  @MessagePattern('order.delivered')
  async handleOrderDelivered(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.ORDER_DELIVERED,
        title: 'Đơn hàng đã giao',
        body: `Đơn hàng #${p.orderId} đã được giao thành công.`,
        deepLink: `/orders/${p.orderId}`,
        priority: Priority.HIGH,
        threadId: `order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `order.delivered:${p.orderId}:ORDER_DELIVERED`,
      });
    }
  }

  @MessagePattern('payment.completed')
  async handlePaymentCompleted(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.PAYMENT_COMPLETED,
        title: 'Thanh toán thành công',
        body: `Thanh toán cho đơn hàng #${p.orderId} thành công.`,
        deepLink: `/orders/${p.orderId}`,
        priority: Priority.HIGH,
        threadId: `order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `payment.completed:${p.orderId}:PAYMENT_COMPLETED`,
      });
    }
  }

  @MessagePattern('payment.refunded')
  async handlePaymentRefunded(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.PAYMENT_REFUNDED,
        title: 'Hoàn tiền thành công',
        body: `Đơn hàng #${p.orderId} đã được hoàn tiền.`,
        deepLink: `/orders/${p.orderId}`,
        priority: Priority.HIGH,
        threadId: `order:${p.orderId}`,
        threadTitle: `Đơn hàng #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `payment.refunded:${p.orderId}:PAYMENT_REFUNDED`,
      });
    }
  }

  @MessagePattern('product.approved')
  async handleProductApproved(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.sellerId) {
      await this.send({
        userId: p.sellerId,
        type: NotificationType.PRODUCT_APPROVED,
        title: 'Sản phẩm đã được duyệt',
        body: `Sản phẩm "${p.productName}" đã được duyệt và đang hiển thị.`,
        deepLink: p.productId
          ? `/seller/products?selected=${encodeURIComponent(p.productId)}&mode=edit`
          : '/seller/products',
        priority: Priority.MEDIUM,
        threadId: `product:${p.productId}`,
        threadTitle: `${p.productName}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `product.approved:${p.productId}:PRODUCT_APPROVED`,
      });
    }
  }

  @MessagePattern('product.rejected')
  async handleProductRejected(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.sellerId) {
      await this.send({
        userId: p.sellerId,
        type: NotificationType.PRODUCT_REJECTED,
        title: 'Sản phẩm bị từ chối',
        body: `Sản phẩm "${p.productName}" bị từ chối. Lý do: ${p.reason ?? 'Không rõ'}.`,
        deepLink: p.productId
          ? `/seller/products?selected=${encodeURIComponent(p.productId)}&mode=edit`
          : '/seller/products',
        priority: Priority.MEDIUM,
        threadId: `product:${p.productId}`,
        threadTitle: `${p.productName}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `product.rejected:${p.productId}:PRODUCT_REJECTED`,
      });
    }
  }

  @MessagePattern('review.replied')
  async handleReviewReplied(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.buyerId) {
      await this.send({
        userId: p.buyerId,
        type: NotificationType.REVIEW_REPLIED,
        title: 'Người bán đã trả lời đánh giá',
        body: `Đánh giá của bạn về "${p.productName}" đã có phản hồi.`,
        deepLink: `/product/${p.productId}#reviews`,
        priority: Priority.LOW,
        threadId: `review:${p.reviewId}`,
        threadTitle: `Đánh giá "${p.productName}"`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `review.replied:${p.reviewId}:REVIEW_REPLIED`,
      });
    }
  }

  @MessagePattern('return.requested')
  async handleReturnRequested(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.sellerId) {
      await this.send({
        userId: p.sellerId,
        type: NotificationType.RETURN_REQUESTED,
        title: 'Yêu cầu trả hàng mới',
        body: `Đơn hàng #${p.orderId} có yêu cầu trả hàng.`,
        deepLink: '/seller/returns',
        priority: Priority.HIGH,
        threadId: `return:${p.returnId}`,
        threadTitle: `Trả hàng đơn #${p.orderId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `return.requested:${p.returnId}:RETURN_REQUESTED`,
      });
    }
  }

  @MessagePattern('payout.completed')
  async handlePayoutCompleted(@Payload() p: OrderEventPayload): Promise<void> {
    if (p.sellerId) {
      await this.send({
        userId: p.sellerId,
        type: NotificationType.PAYOUT_COMPLETED,
        title: 'Đã chuyển khoản',
        body: `Số tiền ${p.amount} VND đã được chuyển vào tài khoản.`,
        deepLink: '/seller/wallet',
        priority: Priority.MEDIUM,
        threadId: `payout:${p.payoutId}`,
        threadTitle: `Chuyển khoản #${p.payoutId}`,
        metadata: this.sanitizeMetadata(p),
        idempotencyKey: `payout.completed:${p.payoutId}:PAYOUT_COMPLETED`,
      });
    }
  }

  @MessagePattern('user.registered')
  async handleUserRegistered(@Payload() p: UserEventPayload): Promise<void> {
    if (p.userId) {
      await this.send({
        userId: p.userId,
        type: NotificationType.USER_REGISTERED,
        title: 'Chào mừng đến VNShop!',
        body: 'Tài khoản của bạn đã được tạo thành công. Bắt đầu mua sắm ngay hôm nay!',
        deepLink: '/search',
        priority: Priority.MEDIUM,
        threadId: `user:${p.userId}`,
        threadTitle: 'Tài khoản',
        metadata: { email: p.email },
        idempotencyKey: `user.registered:${p.userId}:USER_REGISTERED`,
        recipientEmail: p.email,
      });
    }
  }

  @MessagePattern('user.password-reset')
  async handleUserPasswordReset(@Payload() p: UserEventPayload): Promise<void> {
    if (p.userId) {
      await this.send({
        userId: p.userId,
        type: NotificationType.USER_PASSWORD_RESET,
        title: 'Đặt lại mật khẩu',
        body: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
        deepLink: p.resetLink ?? '/password-reset',
        priority: Priority.HIGH,
        threadId: `user:${p.userId}`,
        threadTitle: 'Tài khoản',
        metadata: { email: p.email },
        idempotencyKey: `user.password-reset:${p.userId}:USER_PASSWORD_RESET`,
        recipientEmail: p.email,
      });
    }
  }

  @MessagePattern('video.published')
  async handleVideoPublished(@Payload() p: VideoEventPayload): Promise<void> {
    if (!p.uploaderId) {
      this.logger.warn('video.published missing uploaderId');
      return;
    }
    await this.send({
      userId: p.uploaderId,
      type: NotificationType.VIDEO_PUBLISHED,
      title: 'Video đã được duyệt',
      body: 'Video của bạn đã được duyệt và đang hiển thị.',
      deepLink: p.videoId ? `/videos/${p.videoId}` : '/seller/videos',
      priority: Priority.MEDIUM,
      threadId: p.videoId ? `video:${p.videoId}` : undefined,
      threadTitle: p.videoId ? `Video #${p.videoId.slice(0, 8)}` : undefined,
      metadata: this.sanitizeMetadata(p),
      idempotencyKey: p.videoId
        ? `video.published:${p.videoId}:VIDEO_PUBLISHED`
        : undefined,
    });
  }

  @MessagePattern('video.rejected')
  async handleVideoRejected(@Payload() p: VideoEventPayload): Promise<void> {
    if (!p.uploaderId) {
      this.logger.warn('video.rejected missing uploaderId');
      return;
    }
    await this.send({
      userId: p.uploaderId,
      type: NotificationType.VIDEO_REJECTED,
      title: 'Video bị từ chối',
      body: `Video của bạn đã bị từ chối. Lý do: ${p.reason ?? 'Không có lý do được cung cấp'}.`,
      deepLink: p.videoId ? `/videos/${p.videoId}/appeal` : '/seller/videos',
      priority: Priority.HIGH,
      threadId: p.videoId ? `video:${p.videoId}` : undefined,
      threadTitle: p.videoId ? `Video #${p.videoId.slice(0, 8)}` : undefined,
      metadata: this.sanitizeMetadata(p),
      idempotencyKey: p.videoId
        ? `video.rejected:${p.videoId}:VIDEO_REJECTED`
        : undefined,
    });
  }

  private sanitizeMetadata(p: OrderEventPayload): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { buyerId: _b, sellerId: _s, ...displayFields } = p;
    return displayFields;
  }

  private async send(command: SendNotificationCommand): Promise<void> {
    try {
      await this.sendNotification.execute(command);
    } catch (error) {
      this.logger.error(
        `Failed to send notification: type=${command.type} user=${command.userId} error=${error}`,
      );
    }
  }
}
