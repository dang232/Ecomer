jest.mock("kafkajs", () => ({
  Kafka: jest.fn(),
}));

import { KafkaMessagePublisher } from "./kafka-message.publisher";
import { Message } from "../domain/message";

it("requests all acknowledgements for every published message", async () => {
  process.env.NODE_ENV = "test";
  process.env.KAFKA_LOCAL_MODE = "plaintext";
  process.env.KAFKA_BOOTSTRAP_SERVERS = "localhost:9092";
  const send = jest.fn().mockResolvedValue(undefined);
  const connect = jest.fn().mockResolvedValue(undefined);
  const producer = { connect, send, disconnect: jest.fn() };
  const kafka = { producer: jest.fn().mockReturnValue(producer) };
  const { Kafka } = require("kafkajs") as { Kafka: jest.Mock };
  Kafka.mockImplementation(() => kafka);
  const publisher = new KafkaMessagePublisher();
  await publisher.onModuleInit();
  const message = new Message({ id: "message-1", threadId: "thread-1", senderId: "buyer-1", body: "hello", sentAt: new Date("2026-01-01T00:00:00Z") });
  await publisher.publish({ threadId: "thread-1", message, buyerId: "buyer-1", sellerId: "seller-1", recipientId: "seller-1" });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ acks: -1 }));
});
