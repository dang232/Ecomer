export class AppConfigDto {
  brand!: {
    name: string;
    tagline: string;
    logoUrl: string;
  };
  social!: {
    facebook: string;
    instagram: string;
    twitter: string;
    youtube: string;
  };
  payment!: {
    providers: string[];
    defaultMethod: string;
  };
  auth!: {
    oauthProviders: string[];
  };
  features!: {
    flashSale: boolean;
    messaging: boolean;
    notifications: boolean;
    reviews: boolean;
  };
  support!: {
    phone: string;
    email: string;
    hours: string;
  };
  websocket!: {
    notificationsPath: string;
    messagingPath: string;
    maxReconnectAttempts: number;
    reconnectBaseMs: number;
    reconnectCapMs: number;
  };
}
