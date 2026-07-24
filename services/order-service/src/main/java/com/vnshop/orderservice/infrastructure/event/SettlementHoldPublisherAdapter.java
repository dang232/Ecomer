package com.vnshop.orderservice.infrastructure.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.port.out.OutboxPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class SettlementHoldPublisherAdapter implements SettlementHoldPublisherPort {
    private final OutboxPort outboxPort;
    private final ObjectMapper objectMapper;

    public SettlementHoldPublisherAdapter(OutboxPort outboxPort, ObjectMapper objectMapper) {
        this.outboxPort = outboxPort;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publish(UUID orderId, Long subOrderId, String holdType, boolean open) {
        try {
            outboxPort.publish("Order", orderId.toString(), "SETTLEMENT_HOLD",
                    objectMapper.writeValueAsString(new SettlementHold(orderId, subOrderId, holdType, open)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("settlement hold payload could not be serialized", exception);
        }
    }

    private record SettlementHold(UUID orderId, Long subOrderId, String holdType, boolean open) {
    }
}
