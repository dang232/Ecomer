import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { FindUserNotificationsUseCase } from '../../application/query/find-user-notifications.use-case';
import { FindNotificationThreadsUseCase } from '../../application/query/find-notification-threads.use-case';
import { FindThreadNotificationsUseCase } from '../../application/query/find-thread-notifications.use-case';
import { CountUnreadUseCase } from '../../application/query/count-unread.use-case';
import { MarkNotificationReadUseCase } from '../../application/command/mark-notification-read.use-case';
import { MarkAllReadUseCase } from '../../application/command/mark-all-read.use-case';
import { SendNotificationUseCase } from '../../application/command/send-notification.use-case';
import { NotificationType } from '../../domain/model/notification-type.enum';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ThreadResponseDto } from './dto/thread-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationRestController {
  /* istanbul ignore next */
  constructor(
    private readonly findUserNotifications: FindUserNotificationsUseCase,
    private readonly findThreads: FindNotificationThreadsUseCase,
    private readonly findThreadNotifications: FindThreadNotificationsUseCase,
    private readonly countUnread: CountUnreadUseCase,
    private readonly markRead: MarkNotificationReadUseCase,
    private readonly markAllRead: MarkAllReadUseCase,
    private readonly sendNotification: SendNotificationUseCase,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('type') type?: string,
    @Query('threadId') threadId?: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page?: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size?: number,
  ) {
    const userId = req.user.sub;
    const notificationType =
      type && Object.values(NotificationType).includes(type as NotificationType)
        ? (type as NotificationType)
        : undefined;

    const safePage = Math.max(page ?? 0, 0);
    const safeSize = Math.min(Math.max(size ?? 20, 1), 100);

    const result = await this.findUserNotifications.execute({
      userId,
      type: notificationType,
      threadId,
      page: safePage,
      limit: safeSize,
    });

    return {
      content: result.items.map((n) => NotificationResponseDto.from(n)),
      totalElements: result.total,
      totalPages: result.totalPages,
      number: result.page,
      size: result.limit,
      first: result.page === 0,
      last: result.page >= result.totalPages - 1,
    };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const count = await this.countUnread.execute(userId);
    return { count };
  }

  @Get('threads')
  async threads(
    @Req() req: AuthenticatedRequest,
    @Query('type') type?: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page?: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size?: number,
  ) {
    const userId = req.user.sub;
    const notificationType =
      type && Object.values(NotificationType).includes(type as NotificationType)
        ? (type as NotificationType)
        : undefined;

    const safePage = Math.max(page ?? 0, 0);
    const safeSize = Math.min(Math.max(size ?? 20, 1), 100);

    const result = await this.findThreads.execute({
      userId,
      type: notificationType,
      page: safePage,
      limit: safeSize,
    });

    return {
      content: result.threads.map((t) => ThreadResponseDto.from(t)),
      totalElements: result.total,
      totalPages: result.totalPages,
      number: result.page,
      size: result.limit,
      first: result.page === 0,
      last: result.page >= result.totalPages - 1,
    };
  }

  @Get('threads/:threadId')
  async threadNotifications(
    @Req() req: AuthenticatedRequest,
    @Param('threadId') threadId: string,
  ) {
    const userId = req.user.sub;
    const items = await this.findThreadNotifications.execute(threadId, userId);
    return items.map((n) => NotificationResponseDto.from(n));
  }

  @Post(':id/read')
  async markNotificationRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user.sub;
    const notification = await this.markRead.execute(id, userId);
    return NotificationResponseDto.from(notification);
  }

  @Post('mark-all-read')
  async markAllNotificationsRead(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const updated = await this.markAllRead.execute(userId);
    return { updated };
  }

  @Post('test')
  async createTestNotification(@Req() req: AuthenticatedRequest) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Test endpoint disabled in production');
    }
    const userId = req.user.sub;
    const notification = await this.sendNotification.execute({
      userId,
      type: NotificationType.ORDER_CREATED,
      title: 'Test notification',
      body: 'This is a test notification.',
      metadata: { source: 'manual-test' },
      idempotencyKey: `test:${userId}:${Date.now()}`,
    });
    if (!notification) {
      return {
        suppressed: true,
        message: 'All channels disabled for this type',
      };
    }
    return NotificationResponseDto.from(notification);
  }
}
