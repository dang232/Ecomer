import { ConfigurationController } from './configuration.controller.js';
import { ConfigurationService } from './configuration.service.js';
import { HealthController } from './health.controller.js';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';

describe('ConfigurationController health contract', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WEB_ORIGIN: 'https://shop.vnshop.invalid',
      API_ORIGIN: 'https://api.vnshop.invalid',
      AUTH_ORIGIN: 'https://api.vnshop.invalid',
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

  it('marks internal configuration reads as administrator-only', () => {
    for (const method of ['getAllServiceConfigs', 'getServiceConfig', 'getGlobalConfig', 'reloadConfigs'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, ConfigurationController.prototype[method]))
        .toEqual(['ADMIN']);
    }
  });

  it('reloads configuration through the administrator endpoint', () => {
    const service = new ConfigurationService();
    const reload = jest.spyOn(service, 'reloadConfigs');
    const controller = new ConfigurationController(service);

    expect(controller.reloadConfigs()).toEqual({ status: 'reloaded' });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
