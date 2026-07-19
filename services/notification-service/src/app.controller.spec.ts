import type Redis from 'ioredis';
import type { Connection } from 'mongoose';

import { AppController } from './app.controller';

describe('AppController', () => {
  const mongo = { readyState: 1 };
  const redis = { ping: jest.fn() };
  const controller = new AppController(
    mongo as unknown as Connection,
    redis as unknown as Redis,
  );

  beforeEach(() => {
    mongo.readyState = 1;
    redis.ping.mockResolvedValue('PONG');
  });

  it('returns health response', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('returns readiness response when MongoDB and Redis are connected', async () => {
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });

  it('fails readiness when MongoDB is disconnected', async () => {
    mongo.readyState = 0;

    await expect(controller.ready()).rejects.toThrow('mongodb unavailable');
  });

  it('fails readiness when Redis is unavailable', async () => {
    redis.ping.mockRejectedValue(new Error('connection lost'));

    await expect(controller.ready()).rejects.toThrow('redis unavailable');
  });
});
