package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class RequestReturnUseCase {
    private final OrderRepositoryPort orderRepository;
    private final ReturnRepositoryPort returnRepository;
    private final SettlementHoldPublisherPort settlementHoldPublisher;

    public RequestReturnUseCase(OrderRepositoryPort orderRepository, ReturnRepositoryPort returnRepository) {
        this(orderRepository, returnRepository, null);
    }

    public RequestReturnUseCase(OrderRepositoryPort orderRepository, ReturnRepositoryPort returnRepository,
                                SettlementHoldPublisherPort settlementHoldPublisher) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.returnRepository = Objects.requireNonNull(returnRepository, "returnRepository is required");
        this.settlementHoldPublisher = settlementHoldPublisher;
    }

    @Transactional
    public Return request(String buyerId, Long subOrderId, String reason) {
        requireNonBlank(buyerId, "buyerId");
        Objects.requireNonNull(subOrderId, "subOrderId is required");
        requireNonBlank(reason, "reason");
        // Pt38 audit (extends pt37): the prior code surfaced two different
        // 400 responses depending on whether the subOrderId existed at all
        // vs existed-but-belonged-to-someone-else. That's an existence-
        // probe oracle: a malicious buyer iterating subOrderIds gets
        // distinct error bodies for "exists" vs "doesn't exist." Collapse
        // both into a single OAD with a constant message so the response
        // is identical regardless of which condition tripped.
        Order order = orderRepository.findBySubOrderId(subOrderId)
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to request return on this order"));
        if (!order.buyerId().equals(buyerId)) {
            throw new OrderAccessDeniedException("not authorized to request return on this order");
        }
        SubOrder subOrder = order.subOrders().stream()
                .filter(candidate -> subOrderId.equals(candidate.id()))
                .findFirst()
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to request return on this order"));
        if (subOrder.carrier() == null || subOrder.trackingNumber() == null) {
            throw new IllegalStateException("return can be requested after shipment");
        }

        // BIZ-09: Prevent duplicate return requests for the same sub-order.
        returnRepository.findBySubOrderId(subOrderId).ifPresent(existing -> {
            throw new IllegalStateException("a return already exists for sub-order " + subOrderId);
        });

        Return saved = returnRepository.save(new Return(UUID.randomUUID(), order.id().toString(), subOrderId, buyerId, reason));
        if (settlementHoldPublisher != null) {
            settlementHoldPublisher.publish(order.id(), subOrderId, "RETURN", true);
        }
        return saved;
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
