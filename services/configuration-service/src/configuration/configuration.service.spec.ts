import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigurationService } from './configuration.service.js';

const productionOrigins = {
  WEB_ORIGIN: 'https://shop.vnshop.invalid',
  API_ORIGIN: 'https://api.vnshop.invalid',
  AUTH_ORIGIN: 'https://auth.vnshop.invalid',
};

describe('ConfigurationService public runtime contract', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...productionOrigins };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('publishes exact HTTPS and WSS runtime URIs', () => {
    const config = new ConfigurationService().getPublicConfig();

    expect(config).toMatchObject({
      schemaVersion: '1.0',
      runtimeConfigUri: 'https://shop.vnshop.invalid/runtime-config.json',
      webUri: 'https://shop.vnshop.invalid/',
      apiUri: 'https://api.vnshop.invalid/',
      auth: {
        issuerUri: 'https://auth.vnshop.invalid/realms/vnshop',
        callbackUri: 'https://shop.vnshop.invalid/auth/callback',
        logoutUri: 'https://shop.vnshop.invalid/',
      },
      websocket: {
        notificationsUri: 'wss://api.vnshop.invalid/ws/notifications',
        messagingUri: 'wss://api.vnshop.invalid/ws/messaging',
      },
    });
    expect(Date.parse(config.generatedAt)).not.toBeNaN();
    expect(Date.parse(config.expiresAt)).toBeGreaterThan(Date.parse(config.generatedAt));
  });

  it('defaults to portfolio-safe provider modes', () => {
    const config = new ConfigurationService().getPublicConfig();
    const providers = Object.fromEntries(config.providers.map((provider) => [provider.id, provider]));

    expect(providers.cod).toMatchObject({ status: 'enabled', mode: 'stub' });
    expect(providers.vietqr).toMatchObject({ status: 'enabled', mode: 'demo' });
    expect(providers.stripe).toMatchObject({ status: 'disabled', mode: 'sandbox' });
    expect(providers.paypal).toMatchObject({ status: 'disabled', mode: 'sandbox' });
    expect(providers.vnpay).toMatchObject({ status: 'disabled', mode: 'disabled' });
    expect(providers.momo).toMatchObject({ status: 'disabled', mode: 'disabled' });
    expect(providers.sepay).toMatchObject({ status: 'disabled', mode: 'disabled' });
    expect(config.payment).toEqual({ providers: ['COD', 'VietQR'], defaultMethod: 'COD' });
  });

  it('enables optional sandbox providers only when their public credential exists', () => {
    process.env.STRIPE_ENABLED = 'true';
    process.env.PAYPAL_ENABLED = 'true';
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_redacted';

    const config = new ConfigurationService().getPublicConfig();
    const providers = Object.fromEntries(config.providers.map((provider) => [provider.id, provider]));

    expect(providers.stripe).toMatchObject({ status: 'enabled', mode: 'sandbox' });
    expect(providers.paypal).toMatchObject({
      status: 'disabled',
      mode: 'sandbox',
      reasonCode: 'MISSING_PUBLIC_CREDENTIAL',
    });
    expect(JSON.stringify(config)).not.toContain('pk_test_redacted');
  });

  it.each([
    ['WEB_ORIGIN', 'http://shop.vnshop.invalid'],
    ['WEB_ORIGIN', 'https://localhost'],
    ['API_ORIGIN', 'https://127.0.0.1'],
    ['API_ORIGIN', 'https://api.vnshop.invalid:8443'],
    ['AUTH_ORIGIN', 'https://user:pass@auth.vnshop.invalid'],
    ['AUTH_ORIGIN', 'https://auth.vnshop.invalid?realm=vnshop'],
    ['WEB_ORIGIN', 'https://*.vnshop.invalid'],
  ])('fails closed for invalid %s value %s', (name, value) => {
    process.env[name] = value;

    expect(() => new ConfigurationService().getPublicConfig()).toThrow(
      ServiceUnavailableException,
    );
  });

  it.each(Object.keys(productionOrigins))('reports not ready when %s is missing', (name) => {
    delete process.env[name];

    expect(() => new ConfigurationService().assertReady()).toThrow(
      new ServiceUnavailableException(`Missing ${name}`),
    );
  });
});
