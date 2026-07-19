import { ConfigurationController } from './configuration.controller.js';
import { ConfigurationService } from './configuration.service.js';
import { HealthController } from './health.controller.js';

describe('ConfigurationController health contract', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WEB_ORIGIN: 'https://shop.vnshop.invalid',
      API_ORIGIN: 'https://api.vnshop.invalid',
      AUTH_ORIGIN: 'https://auth.vnshop.invalid',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exposes the public contract and live/ready endpoints', () => {
    const service = new ConfigurationService();
    const controller = new ConfigurationController(service);
    const healthController = new HealthController(service);

    expect(controller.getPublicConfig().schemaVersion).toBe('1.0');
    expect(healthController.getHealth()).toEqual({ status: 'ok' });
    expect(healthController.getReady()).toEqual({ status: 'ready' });
  });
});
