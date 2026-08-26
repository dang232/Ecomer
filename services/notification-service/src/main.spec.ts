const createApp = jest.fn();
const startTracing = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: { create: createApp },
}));
jest.mock('@nestjs/platform-socket.io', () => ({
  IoAdapter: class IoAdapter {},
}));
jest.mock('@nestjs/microservices', () => ({
  Transport: { KAFKA: 'KAFKA' },
}));
jest.mock('./kafka-client.config', () => ({
  createKafkaClientConfig: jest.fn(() => ({})),
}));
jest.mock('./tracing', () => ({ startTracing }));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));

describe('notification bootstrap', () => {
  it('starts tracing before creating the Nest application', async () => {
    const callOrder: string[] = [];
    startTracing.mockImplementation(() => {
      callOrder.push('tracing');
    });
    createApp.mockImplementation(() => {
      callOrder.push('nest');
      return {
        connectMicroservice: jest.fn(),
        startAllMicroservices: jest.fn(),
        listen: jest.fn(),
        useWebSocketAdapter: jest.fn(),
      };
    });
    process.env.OPENAPI_ENABLED = 'false';

    const { bootstrap } = require('./main') as {
      bootstrap: () => Promise<void>;
    };
    await bootstrap();

    expect(callOrder).toEqual(['tracing', 'nest']);
  });
});
