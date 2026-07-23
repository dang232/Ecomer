import { Notification } from '../notification';
import { NotificationType } from '../notification-type.enum';
import { Priority } from '../priority.enum';
import { DeliveryStatusValue } from '../delivery-status';
import { NotificationThread } from '../notification-thread';

describe('Notification aggregate', () => {
  const baseProps = {
    userId: 'user-1',
    type: NotificationType.ORDER_CREATED,
    title: 'Đặt hàng thành công',
    body: 'Đơn hàng #VN2024-abc đã được đặt.',
  };

  it('creates with QUEUED delivery status and MEDIUM priority', () => {
    const n = Notification.create(baseProps);
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.QUEUED);
    expect(n.priority).toBe(Priority.MEDIUM);
    expect(n.read).toBe(false);
    expect(n.readAt).toBeNull();
  });

  it('emits NotificationCreatedEvent on create', () => {
    const n = Notification.create(baseProps);
    const events = n.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].notificationId).toBe(n.id);
    expect(events[0].userId).toBe('user-1');
    expect(events[0].type).toBe(NotificationType.ORDER_CREATED);
  });

  it('pulls events only once', () => {
    const n = Notification.create(baseProps);
    n.pullDomainEvents();
    expect(n.pullDomainEvents()).toHaveLength(0);
  });

  it('transitions QUEUED -> SENT -> DELIVERED -> OPENED', () => {
    const n = Notification.create(baseProps);
    n.markSent();
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.SENT);
    n.markDelivered();
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.DELIVERED);
    n.markOpened();
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.OPENED);
  });

  it('transitions QUEUED -> FAILED -> QUEUED (retry)', () => {
    const n = Notification.create(baseProps);
    n.markFailed();
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.FAILED);
    n.retry();
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.QUEUED);
  });

  it('persists a scheduled retry only while the notification is failed', () => {
    const n = Notification.create(baseProps);
    const nextRetryAt = new Date('2026-01-01T00:00:01.000Z');
    n.markFailed(nextRetryAt);
    expect(n.nextRetryAt).toEqual(nextRetryAt);

    n.retry();
    expect(n.nextRetryAt).toBeNull();
  });

  it('transitions FAILED -> DLQ', () => {
    const n = Notification.create(baseProps);
    n.markFailed();
    n.moveToDlq();
    expect(n.deliveryStatus.getValue()).toBe(DeliveryStatusValue.DLQ);
  });

  it('throws on invalid transition (QUEUED -> OPENED)', () => {
    const n = Notification.create(baseProps);
    expect(() => n.markOpened()).toThrow('Invalid delivery status transition');
  });

  it('markRead sets read flag and readAt', () => {
    const n = Notification.create(baseProps);
    n.markRead();
    expect(n.read).toBe(true);
    expect(n.readAt).toBeInstanceOf(Date);
  });

  it('markRead is idempotent', () => {
    const n = Notification.create(baseProps);
    n.markRead();
    const firstReadAt = n.readAt;
    n.markRead();
    expect(n.readAt).toBe(firstReadAt);
  });

  it('creates with thread when provided', () => {
    const thread = NotificationThread.create(
      'order:VN2024-abc',
      'Đơn hàng #VN2024-abc',
    );
    const n = Notification.create({ ...baseProps, thread });
    expect(n.thread).toBe(thread);
    expect(n.thread!.threadId).toBe('order:VN2024-abc');
  });

  it('creates with custom priority', () => {
    const n = Notification.create({ ...baseProps, priority: Priority.HIGH });
    expect(n.priority).toBe(Priority.HIGH);
  });
});
