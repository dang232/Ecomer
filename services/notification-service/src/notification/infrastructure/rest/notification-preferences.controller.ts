import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { GetPreferencesUseCase } from '../../application/query/get-preferences.use-case';
import { UpdatePreferencesUseCase } from '../../application/command/update-preferences.use-case';
import { NotificationType } from '../../domain/model/notification-type.enum';
import { NotificationChannel } from '../../domain/model/notification-preferences';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { sub: string };
}

interface UpdatePreferencesBody {
  typePreferences: { type: string; channels: string[] }[];
  muted: boolean;
}

interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  errorCode: null;
  timestamp: string;
}

@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
  /* istanbul ignore next */
  constructor(
    private readonly getPreferences: GetPreferencesUseCase,
    private readonly updatePreferences: UpdatePreferencesUseCase,
  ) {}

  private ok<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      message: 'Success',
      data,
      errorCode: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async get(@Req() req: AuthenticatedRequest) {
    const prefs = await this.getPreferences.execute(req.user.sub);
    return this.ok({
      muted: prefs.muted,
      typePreferences: prefs.typePreferences.map((tp) => ({
        type: tp.type,
        channels: tp.channels,
      })),
      updatedAt: prefs.updatedAt.toISOString(),
    });
  }

  @Put()
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdatePreferencesBody,
  ) {
    const validTypes = Object.values(NotificationType) as string[];
    const validChannels = Object.values(NotificationChannel) as string[];

    const typePreferences = (body.typePreferences ?? [])
      .filter((tp) => validTypes.includes(tp.type))
      .map((tp) => ({
        type: tp.type as NotificationType,
        channels: (tp.channels ?? []).filter((ch) =>
          validChannels.includes(ch),
        ) as NotificationChannel[],
      }));

    const prefs = await this.updatePreferences.execute({
      userId: req.user.sub,
      typePreferences,
      muted: body.muted ?? false,
    });

    return this.ok({
      muted: prefs.muted,
      typePreferences: prefs.typePreferences.map((tp) => ({
        type: tp.type,
        channels: tp.channels,
      })),
      updatedAt: prefs.updatedAt.toISOString(),
    });
  }
}
