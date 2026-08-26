import { readFileSync } from "node:fs";
import type { KafkaConfig, ProducerConfig } from "kafkajs";

const production = process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Kafka`);
  return value;
}

function brokers(): string[] {
  const values = (
    process.env.KAFKA_BOOTSTRAP_SERVERS ?? (production ? "" : "localhost:9092")
  )
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (values.length === 0)
    throw new Error("KAFKA_BOOTSTRAP_SERVERS must contain a broker");
  return values;
}

function tlsOptions(): KafkaConfig["ssl"] {
  const ca = readFileSync(required("KAFKA_SSL_CA_FILE"));
  const cert = readFileSync(required("KAFKA_SSL_CERT_FILE"));
  const key = readFileSync(required("KAFKA_SSL_KEY_FILE"));
  return { ca: [ca], cert, key, rejectUnauthorized: true };
}

export function createKafkaClientConfig(clientId: string): KafkaConfig {
  const localSaslPlaintext =
    !production && process.env.KAFKA_LOCAL_MODE === "sasl-plaintext";
  const config: KafkaConfig = {
    clientId,
    brokers: brokers(),
    ssl: localSaslPlaintext ? false : tlsOptions(),
    sasl: {
      mechanism: "plain",
      username: required("KAFKA_SASL_USERNAME"),
      password: required("KAFKA_SASL_PASSWORD"),
    },
  };
  return config;
}

export function createKafkaProducerConfig(): ProducerConfig {
  return {
    allowAutoTopicCreation: false,
    idempotent: true,
    maxInFlightRequests: 5,
  };
}
