import { Controller } from "@nestjs/common";
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from "@nestjs/microservices";
import { MessagingWsGateway } from "../infrastructure/messaging-ws.gateway";
import { MESSAGING_TOPIC } from "./kafka-message.publisher";
import { context } from "@opentelemetry/api";
import { extractKafkaContext } from "../infrastructure/kafka-trace-propagation";

interface MessageEventPayload {
  threadId: string;
  messageId: string;
  senderId: string;
  recipientId: string;
  buyerId: string;
  sellerId: string;
  body: string;
  sentAt: string;
}

/**
 * Kafka consumer for `messaging.message.sent`. Routes each event to the
 * WebSocket gateway, which forwards it to any clients connected to *this* pod
 * for the recipient/sender. Cross-pod fan-out is exactly what Kafka buys us.
 */
@Controller()
export class KafkaMessageConsumer {
  constructor(private readonly gateway: MessagingWsGateway) {}

  @MessagePattern(MESSAGING_TOPIC)
  handleMessageSent(
    @Payload() payload: MessageEventPayload,
    @Ctx() _ctx: KafkaContext,
  ): void {
    const extracted = extractKafkaContext(_ctx.getMessage());
    return context.with(extracted, () => {
      if (!payload?.threadId || !payload.recipientId) return;
      this.gateway.dispatch(payload.recipientId, payload);
      this.gateway.dispatch(payload.senderId, payload);
    });
  }
}
