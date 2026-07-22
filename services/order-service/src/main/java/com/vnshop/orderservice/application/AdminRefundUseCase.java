package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

/** Admin refund orchestration that reuses the durable return/refund path. */
public class AdminRefundUseCase {
    private static final String ACTOR_ROLE = "ADMIN";

    private final OrderRepositoryPort orderRepository;
    private final ReturnRepositoryPort returnRepository;
    private final ApproveReturnUseCase approveReturnUseCase;
    private final CompleteReturnUseCase completeReturnUseCase;

    public AdminRefundUseCase(
            OrderRepositoryPort orderRepository,
            ReturnRepositoryPort returnRepository,
            ApproveReturnUseCase approveReturnUseCase,
            CompleteReturnUseCase completeReturnUseCase
    ) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.returnRepository = Objects.requireNonNull(returnRepository, "returnRepository is required");
        this.approveReturnUseCase = Objects.requireNonNull(approveReturnUseCase, "approveReturnUseCase is required");
        this.completeReturnUseCase = Objects.requireNonNull(completeReturnUseCase, "completeReturnUseCase is required");
    }

    @Transactional
    public AdminRefundResult refund(UUID orderId, String reason) {
        requireNonBlank(reason, "reason");
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("order not found: " + orderId));
        if (order.paymentStatus() != PaymentStatus.COMPLETED) {
            throw new IllegalStateException("only payment-completed orders can be refunded");
        }

        List<UUID> completedReturns = new ArrayList<>();
        order.subOrders().forEach(subOrder -> {
            Return orderReturn = returnRepository.findBySubOrderId(subOrder.id())
                    .orElseGet(() -> returnRepository.save(new Return(
                            UUID.randomUUID(), order.id().toString(), subOrder.id(), order.buyerId(), reason)));
            if (orderReturn.status() == ReturnStatus.REQUESTED) {
                orderReturn = approveReturnUseCase.approve(orderReturn.returnId(), null, ACTOR_ROLE);
            }
            if (orderReturn.status() == ReturnStatus.APPROVED) {
                orderReturn = completeReturnUseCase.complete(orderReturn.returnId(), null, ACTOR_ROLE);
            }
            if (orderReturn.status() == ReturnStatus.COMPLETED || orderReturn.status() == ReturnStatus.REFUNDED) {
                completedReturns.add(orderReturn.returnId());
            } else {
                throw new IllegalStateException("cannot refund return in state " + orderReturn.status());
            }
        });
        return new AdminRefundResult(order.id(), completedReturns);
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }

    public record AdminRefundResult(UUID orderId, List<UUID> returnIds) {
        public AdminRefundResult {
            returnIds = List.copyOf(returnIds);
        }
    }
}
