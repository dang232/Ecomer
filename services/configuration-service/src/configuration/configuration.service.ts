import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigDto } from './dto/app-config.dto.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

@Injectable()
export class ConfigurationService {
  private serviceConfigs: Record<string, Record<string, unknown>>;
  private globalConfig: Record<string, unknown>;

  constructor() {
    this.loadServiceConfigs();
  }

  private loadServiceConfigs(): void {
    const configPath = path.resolve(
      process.env.CONFIG_FILE_PATH ?? path.join(__dirname, '../../config/services.yml'),
    );
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const parsed = yaml.load(fileContent) as Record<string, unknown>;
      this.globalConfig = (parsed.global as Record<string, unknown>) ?? {};
      this.serviceConfigs = (parsed.services as Record<string, Record<string, unknown>>) ?? {};
    } catch (err) {
      console.warn(`Failed to load service configs from ${configPath}: ${err}`);
      this.globalConfig = {};
      this.serviceConfigs = {};
    }
  }

  getConfig(): AppConfigDto {
    return {
      brand: {
        name: process.env.BRAND_NAME ?? 'VNShop',
        tagline: process.env.BRAND_TAGLINE ?? 'MARKETPLACE',
        logoUrl: process.env.BRAND_LOGO_URL ?? '',
      },
      social: {
        facebook: process.env.SOCIAL_FACEBOOK ?? 'https://facebook.com',
        instagram: process.env.SOCIAL_INSTAGRAM ?? 'https://instagram.com',
        twitter: process.env.SOCIAL_TWITTER ?? 'https://x.com',
        youtube: process.env.SOCIAL_YOUTUBE ?? 'https://youtube.com',
      },
      payment: {
        providers: (
          process.env.PAYMENT_PROVIDERS ?? 'VNPay,MoMo,COD,Visa,Mastercard'
        ).split(','),
        defaultMethod: process.env.PAYMENT_DEFAULT ?? 'COD',
      },
      auth: {
        oauthProviders: [
          ...(process.env.GOOGLE_OAUTH_ENABLED === 'true' ? ['google'] : []),
          ...(process.env.FACEBOOK_OAUTH_ENABLED === 'true'
            ? ['facebook']
            : []),
        ],
      },
      features: {
        flashSale: process.env.FEATURE_FLASH_SALE !== 'false',
        messaging: process.env.FEATURE_MESSAGING !== 'false',
        notifications: process.env.FEATURE_NOTIFICATIONS !== 'false',
        reviews: process.env.FEATURE_REVIEWS !== 'false',
      },
      support: {
        phone: process.env.SUPPORT_PHONE ?? '1900-0000',
        email: process.env.SUPPORT_EMAIL ?? 'support@vnshop.vn',
        hours: process.env.SUPPORT_HOURS ?? '24/7',
      },
      websocket: {
        notificationsPath:
          process.env.WS_NOTIFICATIONS_PATH ?? '/ws/notifications',
        messagingPath: process.env.WS_MESSAGING_PATH ?? '/ws/messaging',
        maxReconnectAttempts: parseInt(
          process.env.WS_MAX_RECONNECT ?? '5',
          10,
        ),
        reconnectBaseMs: parseInt(
          process.env.WS_RECONNECT_BASE_MS ?? '2000',
          10,
        ),
        reconnectCapMs: parseInt(
          process.env.WS_RECONNECT_CAP_MS ?? '30000',
          10,
        ),
      },
    };
  }

  getServiceConfig(serviceName: string): Record<string, unknown> {
    const config = this.serviceConfigs[serviceName];
    if (!config) {
      throw new NotFoundException(`No configuration found for service: ${serviceName}`);
    }
    return { ...this.globalConfig, ...config };
  }

  getAllServiceConfigs(): Record<string, Record<string, unknown>> {
    return this.serviceConfigs;
  }

  getGlobalConfig(): Record<string, unknown> {
    return this.globalConfig;
  }

  reloadConfigs(): void {
    this.loadServiceConfigs();
  }
}
