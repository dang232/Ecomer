import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Kafka, Producer } from "kafkajs";
import { MessagePublisher, PublishMessageInput } from "./message-publisher";
import { createKafkaClientConfig, createKafkaProducerConfig } from "../infrastructure/kafka-client.config";

export const MESSAGING_TOPIC = "messaging.message.sent";

/**
 * Kafka producer for outgoing message events. Other pods of messaging-service
 * (or any other service that wants to consume the firehose) subscribe to
 * `messaging.message.sent`. Failures here are logged but never fail the user
 * request — the message is already persisted and the per-pod WS gateway can
 * still deliver to clients connected to *this* pod.
 */
@Injectable()
export class KafkaMessagePublisher
  implements MessagePublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaMessagePublisher.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private connected = false;

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka(createKafkaClientConfig("messaging-service-producer"));
    this.producer = this.kafka.producer(createKafkaProducerConfig());
    try {
      await this.producer.connect();
      this.connected = true;
    } catch (err) {
      this.logger.warn(
        `Kafka producer failed to connect; messages will not be fanned out: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer && this.connected) {
      try {
        await this.producer.disconnect();
      } catch {
        // Ignore disconnect failures during shutdown.
      }
    }
  }

  async publish(input: PublishMessageInput): Promise<void> {
    if (!this.producer || !this.connected) return;
    const payload = {
      threadId: input.threadId,
      messageId: input.message.id,
      senderId: input.message.senderId,
      recipientId: input.recipientId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      body: input.message.body,
      sentAt: input.message.sentAt.toISOString(),
    };
    try {
      await this.producer.send({
        topic: MESSAGING_TOPIC,
        acks: -1,
        // Partition by thread so messages within a thread stay ordered when
        // consumers parallelise across partitions.
        messages: [{ key: input.threadId, value: JSON.stringify(payload) }],
      });
    } catch (err) {
      this.logger.warn(
        `Kafka publish failed for thread ${input.threadId}: ${(err as Error).message}`,
      );
    }
  }
}

@Injectable()
export class NoopMessagePublisher implements MessagePublisher {
  async publish(): Promise<void> {
    return Promise.resolve();
  }
}
