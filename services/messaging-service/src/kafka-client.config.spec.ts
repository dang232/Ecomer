import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalEnvironment = { ...process.env };

function loadConfig(): typeof import("./messaging/infrastructure/kafka-client.config") {
  jest.resetModules();
  return jest.requireActual("./messaging/infrastructure/kafka-client.config");
}

function setSecureEnvironment(directory: string): void {
  process.env.NODE_ENV = "production";
  process.env.KAFKA_BOOTSTRAP_SERVERS = "kafka-0:9092,kafka-1:9092";
  process.env.KAFKA_SASL_USERNAME = "svc-messaging";
  process.env.KAFKA_SASL_PASSWORD = "password";
  process.env.KAFKA_SSL_CA_FILE = join(directory, "ca.pem");
  process.env.KAFKA_SSL_CERT_FILE = join(directory, "client.pem");
  process.env.KAFKA_SSL_KEY_FILE = join(directory, "client.key");
  writeFileSync(process.env.KAFKA_SSL_CA_FILE, "ca");
  writeFileSync(process.env.KAFKA_SSL_CERT_FILE, "cert");
  writeFileSync(process.env.KAFKA_SSL_KEY_FILE, "key");
}

afterEach(() => {
  process.env = { ...originalEnvironment };
});

it("builds a hostname-verified SASL TLS client from real PEM files", () => {
  const directory = mkdtempSync(join(tmpdir(), "messaging-kafka-"));
  try {
    setSecureEnvironment(directory);
    const config = loadConfig().createKafkaClientConfig("messaging-test");
    expect(config).toMatchObject({
      clientId: "messaging-test",
      brokers: ["kafka-0:9092", "kafka-1:9092"],
      sasl: {
        mechanism: "plain",
        username: "svc-messaging",
        password: "password",
      },
      ssl: { rejectUnauthorized: true },
    });
    expect(config.ssl).toMatchObject({
      ca: [Buffer.from("ca")],
      cert: Buffer.from("cert"),
      key: Buffer.from("key"),
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  "KAFKA_SASL_USERNAME",
  "KAFKA_SASL_PASSWORD",
  "KAFKA_SSL_CA_FILE",
  "KAFKA_SSL_CERT_FILE",
  "KAFKA_SSL_KEY_FILE",
])("fails closed when %s is absent", (name) => {
  const directory = mkdtempSync(join(tmpdir(), "messaging-kafka-"));
  try {
    setSecureEnvironment(directory);
    delete process.env[name];
    const config = loadConfig();
    expect(() => config.createKafkaClientConfig("messaging-test")).toThrow(
      name,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("fails closed when the broker list is empty", () => {
  const directory = mkdtempSync(join(tmpdir(), "messaging-kafka-"));
  try {
    setSecureEnvironment(directory);
    process.env.KAFKA_BOOTSTRAP_SERVERS = " , ";
    const config = loadConfig();
    expect(() => config.createKafkaClientConfig("messaging-test")).toThrow(
      "KAFKA_BOOTSTRAP_SERVERS",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("permits explicit non-production plaintext mode", () => {
  process.env.NODE_ENV = "test";
  process.env.KAFKA_LOCAL_MODE = "sasl-plaintext";
  process.env.KAFKA_BOOTSTRAP_SERVERS = "localhost:9092";
  process.env.KAFKA_SASL_USERNAME = "local-user";
  process.env.KAFKA_SASL_PASSWORD = "local-password";
  const config = loadConfig().createKafkaClientConfig("messaging-local");
  expect(config).toMatchObject({
    brokers: ["localhost:9092"],
    ssl: false,
    sasl: {
      mechanism: "plain",
      username: "local-user",
      password: "local-password",
    },
  });
});
