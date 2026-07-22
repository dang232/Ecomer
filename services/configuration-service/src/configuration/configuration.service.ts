import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigDto } from './dto/app-config.dto.js';
import {
  PublicConfigDto,
  type ProviderConfigDto,
} from './dto/public-config.dto.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { isIP } from 'node:net';

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
    const publicConfig = this.getPublicConfig();
    return {
      brand: publicConfig.brand,
      social: publicConfig.social,
      payment: publicConfig.payment,
      auth: { oauthProviders: publicConfig.auth.oauthProviders },
      features: publicConfig.features,
      support: publicConfig.support,
      websocket: publicConfig.websocket,
    };
  }

  getPublicConfig(): PublicConfigDto {
    const web = this.requireOrigin('WEB_ORIGIN');
    const api = this.requireOrigin('API_ORIGIN');
    const auth = this.requireOrigin('AUTH_ORIGIN');
    const generatedAt = new Date();
    const providers = this.providerConfigs();
    const enabledProviders = providers
      .filter((provider) => provider.status === 'enabled')
      .map((provider) => this.displayProviderName(provider.id));

    return {
      schemaVersion: '1.0',
      generatedAt: generatedAt.toISOString(),
      expiresAt: new Date(generatedAt.getTime() + 5 * 60 * 1000).toISOString(),
      runtimeConfigUri: `${web.origin}/runtime-config.json`,
      webUri: `${web.origin}/`,
      apiUri: `${api.origin}/`,
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
        providers: enabledProviders,
        defaultMethod: enabledProviders.includes('COD') ? 'COD' : enabledProviders[0] ?? '',
      },
      auth: {
        oauthProviders: [
          ...(process.env.GOOGLE_OAUTH_ENABLED === 'true' ? ['google'] : []),
          ...(process.env.FACEBOOK_OAUTH_ENABLED === 'true' ? ['facebook'] : []),
        ],
        issuerUri: `${auth.origin}/realms/vnshop`,
        callbackUri: `${web.origin}/auth/callback`,
        logoutUri: `${web.origin}/`,
        clientId: process.env.OIDC_CLIENT_ID ?? 'vnshop-web',
      },
      features: {
        checkout: enabledProviders.length > 0,
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
        notificationsPath: '/ws/notifications',
        messagingPath: '/ws/messaging',
        notificationsUri: `${api.protocol === 'https:' ? 'wss' : 'ws'}://${api.host}/ws/notifications`,
        messagingUri: `${api.protocol === 'https:' ? 'wss' : 'ws'}://${api.host}/ws/messaging`,
        maxReconnectAttempts: this.positiveInteger('WS_MAX_RECONNECT', 5),
        reconnectBaseMs: this.positiveInteger('WS_RECONNECT_BASE_MS', 2000),
        reconnectCapMs: this.positiveInteger('WS_RECONNECT_CAP_MS', 30000),
      },
      providers,
    };
  }

  assertReady(): void {
    this.getPublicConfig();
  }

  private requireOrigin(name: string): URL {
    const raw = process.env[name];
    if (!raw?.trim()) {
      throw new ServiceUnavailableException(`Missing ${name}`);
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new ServiceUnavailableException(`Invalid ${name}`);
    }

    const hostname = url.hostname.toLowerCase();
    const allowInsecureLocal = process.env.RUNTIME_CONFIG_ALLOW_INSECURE === 'true';
    const localHttp = allowInsecureLocal && hostname === 'localhost' && url.protocol === 'http:';
    const invalid =
      (url.protocol !== 'https:' && !localHttp) ||
      (url.protocol === 'https:' ? url.port !== '' && url.port !== '443' : !localHttp || url.port === '') ||
      url.pathname !== '/' ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== '' ||
      hostname.includes('*') ||
      (!localHttp && (hostname === 'localhost' || hostname.endsWith('.localhost'))) ||
      isIP(hostname) !== 0;

    if (invalid) {
      throw new ServiceUnavailableException(`Invalid ${name}`);
    }
    return url;
  }

  private providerConfigs(): ProviderConfigDto[] {
    const stripeEnabled = process.env.STRIPE_ENABLED === 'true';
    const paypalEnabled = process.env.PAYPAL_ENABLED === 'true';

    return [
      { id: 'cod', status: 'enabled', mode: 'stub', reasonCode: 'PORTFOLIO_STUB' },
      { id: 'vietqr', status: 'enabled', mode: 'demo', reasonCode: 'PORTFOLIO_DEMO' },
      this.optionalSandboxProvider(
        'stripe',
        stripeEnabled,
        process.env.STRIPE_PUBLISHABLE_KEY,
      ),
      this.optionalSandboxProvider(
        'paypal',
        paypalEnabled,
        process.env.PAYPAL_CLIENT_ID,
      ),
      { id: 'vnpay', status: 'disabled', mode: 'disabled', reasonCode: 'DISABLED_BY_POLICY' },
      { id: 'momo', status: 'disabled', mode: 'disabled', reasonCode: 'DISABLED_BY_POLICY' },
      { id: 'sepay', status: 'disabled', mode: 'disabled', reasonCode: 'DISABLED_BY_POLICY' },
    ];
  }

  private optionalSandboxProvider(
    id: 'stripe' | 'paypal',
    enabled: boolean,
    publicCredential: string | undefined,
  ): ProviderConfigDto {
    if (!enabled) {
      return { id, status: 'disabled', mode: 'sandbox', reasonCode: 'DISABLED_BY_CONFIGURATION' };
    }
    if (!publicCredential?.trim()) {
      return { id, status: 'disabled', mode: 'sandbox', reasonCode: 'MISSING_PUBLIC_CREDENTIAL' };
    }
    return { id, status: 'enabled', mode: 'sandbox', reasonCode: 'SANDBOX_ONLY' };
  }

  private displayProviderName(id: ProviderConfigDto['id']): string {
    const names: Record<ProviderConfigDto['id'], string> = {
      cod: 'COD',
      vietqr: 'VietQR',
      stripe: 'Stripe',
      paypal: 'PayPal',
      vnpay: 'VNPay',
      momo: 'MoMo',
      sepay: 'SePay',
    };
    return names[id];
  }

  private positiveInteger(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
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
