import type { DataSource } from 'typeorm';

import { PUBLIC_ROUTE_KEY } from '../auth/public.decorator.js';
import { ProbeController } from './probe.controller.js';

describe('ProbeController', () => {
  const dataSource = { isInitialized: true, query: jest.fn() };
  const controller = new ProbeController(dataSource as unknown as DataSource);

  beforeEach(() => {
    dataSource.isInitialized = true;
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('returns liveness without authentication', () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, controller.health)).toBe(true);
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('returns readiness without authentication when TimescaleDB responds', async () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, controller.ready)).toBe(true);
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });

  it('fails readiness when TimescaleDB is disconnected', async () => {
    dataSource.isInitialized = false;

    await expect(controller.ready()).rejects.toThrow('timescaledb unavailable');
  });
});
