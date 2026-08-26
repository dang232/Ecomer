import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalEnvironment = { ...process.env };

function loadConfig() {
  jest.resetModules();
  return require('./kafka-client.config') as typeof import('./kafka-client.config');
}

function setSecureEnvironment(directory: string): void {
  process.env.NODE_ENV = 'production';
  process.env.KAFKA_BOOTSTRAP_SERVERS = 'kafka-0:9092';
  process.env.KAFKA_SASL_USERNAME = 'svc-notification';
  process.env.KAFKA_SASL_PASSWORD = 'password';
  process.env.KAFKA_SSL_CA_FILE = join(directory, 'ca.pem');
  process.env.KAFKA_SSL_CERT_FILE = join(directory, 'client.pem');
  process.env.KAFKA_SSL_KEY_FILE = join(directory, 'client.key');
  writeFileSync(process.env.KAFKA_SSL_CA_FILE, 'ca');
  writeFileSync(process.env.KAFKA_SSL_CERT_FILE, 'cert');
  writeFileSync(process.env.KAFKA_SSL_KEY_FILE, 'key');
}

afterEach(() => {
  process.env = { ...originalEnvironment };
});

it('builds a secure production client from PEM files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'notification-kafka-'));
  try {
    setSecureEnvironment(directory);
    const config = loadConfig().createKafkaClientConfig('notification-test');
    expect(config).toMatchObject({
      clientId: 'notification-test',
      brokers: ['kafka-0:9092'],
      sasl: {
        mechanism: 'plain',
        username: 'svc-notification',
        password: 'password',
      },
      ssl: { rejectUnauthorized: true },
    });
    expect(config.ssl).toMatchObject({
      ca: [Buffer.from('ca')],
      cert: Buffer.from('cert'),
      key: Buffer.from('key'),
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  'KAFKA_SASL_USERNAME',
  'KAFKA_SASL_PASSWORD',
  'KAFKA_SSL_CA_FILE',
  'KAFKA_SSL_CERT_FILE',
  'KAFKA_SSL_KEY_FILE',
])('fails closed when %s is absent', (name) => {
  const directory = mkdtempSync(join(tmpdir(), 'notification-kafka-'));
  try {
    setSecureEnvironment(directory);
    delete process.env[name];
    expect(() =>
      loadConfig().createKafkaClientConfig('notification-test'),
    ).toThrow(name);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('fails closed when the broker list is empty', () => {
  const directory = mkdtempSync(join(tmpdir(), 'notification-kafka-'));
  try {
    setSecureEnvironment(directory);
    process.env.KAFKA_BOOTSTRAP_SERVERS = ' , ';
    expect(() =>
      loadConfig().createKafkaClientConfig('notification-test'),
    ).toThrow('KAFKA_BOOTSTRAP_SERVERS');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('permits explicit non-production plaintext mode', () => {
  process.env.NODE_ENV = 'test';
  process.env.KAFKA_LOCAL_MODE = 'sasl-plaintext';
  process.env.KAFKA_BOOTSTRAP_SERVERS = 'localhost:9092';
  process.env.KAFKA_SASL_USERNAME = 'local-user';
  process.env.KAFKA_SASL_PASSWORD = 'local-password';
  const config = loadConfig().createKafkaClientConfig('notification-local');
  expect(config).toMatchObject({
    brokers: ['localhost:9092'],
    ssl: false,
    sasl: {
      mechanism: 'plain',
      username: 'local-user',
      password: 'local-password',
    },
  });
});
