import type { MikroORM } from '@mikro-orm/core';

import { AppController } from './app.controller';

describe('AppController', () => {
  const orm = { isConnected: jest.fn() };
  const controller = new AppController(orm as unknown as MikroORM);

  beforeEach(() => {
    orm.isConnected.mockResolvedValue(true);
  });

  it('returns the liveness response', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('returns the readiness response when PostgreSQL is connected', async () => {
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });

  it('fails readiness when PostgreSQL is disconnected', async () => {
    orm.isConnected.mockResolvedValue(false);

    await expect(controller.ready()).rejects.toThrow('database unavailable');
  });
});
