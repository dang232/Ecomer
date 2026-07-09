import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OneSignal Push Notification Adapter
 *
 * Uses OneSignal REST API to send push notifications.
 * Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to enable.
 */
@Injectable()
export class OneSignalPushChannelAdapter {
  private readonly logger = new Logger(OneSignalPushChannelAdapter.name);
  private readonly enabled: boolean;
  private readonly appId: string;
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.onesignal.com/notifications';

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.get<string>('ONESIGNAL_APP_ID') ?? '';
    this.apiKey = this.config.get<string>('ONESIGNAL_REST_API_KEY') ?? '';
    this.enabled = Boolean(this.appId && this.apiKey);

    if (this.enabled) {
      this.logger.log('OneSignal push adapter ENABLED');
    } else {
      this.logger.log(
        'OneSignal push adapter DISABLED (stub mode — set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to activate)',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Send push notification via OneSignal REST API
   * Uses player_id (OneSignal user ID) as the target
   */
  async send(
    recipient: { userId: string; deviceToken: string },
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug(
        `[STUB] Would push to user=${recipient.userId}: "${title}"`,
      );
      return false;
    }

    // OneSignal requires player_id (OneSignal ID), not the push token
    // The deviceToken in our system maps to the OneSignal player_id
    const playerId = recipient.deviceToken;

    try {
      const payload = {
        app_id: this.appId,
        include_player_ids: [playerId],
        headings: { en: title },
        contents: { en: body },
        data: data ?? {},
        priority: 10,
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OneSignal API error: ${response.status} ${errorText}`,
        );
        return false;
      }

      const result = (await response.json()) as {
        id?: string;
        recipients?: number;
        errors?: { invalid_player_ids?: string[] };
      };

      if (result.errors?.invalid_player_ids?.length) {
        this.logger.warn(
          `Invalid player IDs: ${result.errors.invalid_player_ids.join(', ')}`,
        );
      }

      this.logger.log(
        `Push sent to user=${recipient.userId}, onesignal_id=${result.id}, recipients=${result.recipients}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push to user=${recipient.userId}`, error);
      return false;
    }
  }

  /**
   * Send notification to a segment (all users with specific tag)
   * Useful for broadcasting order updates to all customers
   */
  async sendToSegment(
    segment: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug(
        `[STUB] Would push to segment="${segment}": "${title}"`,
      );
      return false;
    }

    try {
      const payload = {
        app_id: this.appId,
        included_segments: [segment],
        headings: { en: title },
        contents: { en: body },
        data: data ?? {},
        priority: 10,
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OneSignal API error: ${response.status} ${errorText}`,
        );
        return false;
      }

      this.logger.log(`Push sent to segment="${segment}": "${title}"`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send push to segment="${segment}"`,
        error,
      );
      return false;
    }
  }
}
