import type { AppConfigDto } from './app-config.dto.js';

export type ProviderStatus = 'enabled' | 'disabled';
export type ProviderMode = 'stub' | 'demo' | 'sandbox' | 'disabled';

export interface ProviderConfigDto {
  id: 'cod' | 'vietqr' | 'stripe' | 'paypal' | 'vnpay' | 'momo' | 'sepay';
  status: ProviderStatus;
  mode: ProviderMode;
  reasonCode: string;
}
export class PublicConfigDto {
  schemaVersion!: '1.0';
  generatedAt!: string;
  expiresAt!: string;
  runtimeConfigUri!: string;
  webUri!: string;
  apiUri!: string;
  brand!: AppConfigDto['brand'];
  social!: AppConfigDto['social'];
  payment!: AppConfigDto['payment'];
  auth!: AppConfigDto['auth'] & {
    issuerUri: string;
    callbackUri: string;
    logoutUri: string;
    clientId: string;
  };
  features!: AppConfigDto['features'] & {
    checkout: boolean;
  };
  support!: AppConfigDto['support'];
  websocket!: AppConfigDto['websocket'] & {
    notificationsUri: string;
    messagingUri: string;
  };
  providers!: ProviderConfigDto[];
}
