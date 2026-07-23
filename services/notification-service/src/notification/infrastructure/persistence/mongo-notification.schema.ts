import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { NotificationType } from '../../domain/model/notification-type.enum';
import { Priority } from '../../domain/model/priority.enum';
import { DeliveryStatusValue } from '../../domain/model/delivery-status';

export type NotificationDocument = HydratedDocument<NotificationSchemaClass>;

@Schema({ collection: 'notifications', timestamps: false })
export class NotificationSchemaClass {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, type: String, enum: NotificationType })
  type!: NotificationType;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ type: String, default: null })
  deepLink!: string | null;

  @Prop({
    required: true,
    type: String,
    enum: Priority,
    default: Priority.MEDIUM,
  })
  priority!: Priority;

  @Prop({
    required: true,
    type: String,
    enum: DeliveryStatusValue,
    default: DeliveryStatusValue.QUEUED,
  })
  deliveryStatus!: DeliveryStatusValue;

  @Prop({ type: String, default: null })
  threadId!: string | null;

  @Prop({ type: String, default: null })
  threadTitle!: string | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  idempotencyKey!: string | null;

  @Prop({ default: false })
  read!: boolean;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ default: 0 })
  retryCount!: number;

  @Prop({ type: Date, default: null })
  nextRetryAt!: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(
  NotificationSchemaClass,
);

// Indexes per spec
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, threadId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ deliveryStatus: 1 });
NotificationSchema.index({ deliveryStatus: 1, nextRetryAt: 1 });
