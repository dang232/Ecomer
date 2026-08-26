import { readFileSync } from 'node:fs';
import type { KafkaConfig } from 'kafkajs';

const production = process.env.NODE_ENV === 'production';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Kafka`);
  return value;
}

export function createKafkaClientConfig(clientId: string): KafkaConfig {
  const brokers = (
    process.env.KAFKA_BOOTSTRAP_SERVERS ?? (production ? '' : 'localhost:9092')
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (brokers.length === 0)
    throw new Error('KAFKA_BOOTSTRAP_SERVERS must contain a broker');
  const localSaslPlaintext =
    !production && process.env.KAFKA_LOCAL_MODE === 'sasl-plaintext';
  const ssl = localSaslPlaintext
    ? false
    : {
        ca: [readFileSync(required('KAFKA_SSL_CA_FILE'))],
        cert: readFileSync(required('KAFKA_SSL_CERT_FILE')),
        key: readFileSync(required('KAFKA_SSL_KEY_FILE')),
        rejectUnauthorized: true,
      };
  return {
    clientId,
    brokers,
    ssl,
    sasl: {
      mechanism: 'plain',
      username: required('KAFKA_SASL_USERNAME'),
      password: required('KAFKA_SASL_PASSWORD'),
    },
  };
}
