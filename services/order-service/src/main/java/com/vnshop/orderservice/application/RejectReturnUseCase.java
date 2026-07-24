package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class RejectReturnUseCase {
    private final ReturnRepositoryPort returnRepository;
    private final OrderRepositoryPort orderRepository;
    private final SettlementHoldPublisherPort settlementHoldPublisher;

    public RejectReturnUseCase(ReturnRepositoryPort returnRepository, OrderRepositoryPort orderRepository) {
        this(returnRepository, orderRepository, null);
    }

    public RejectReturnUseCase(ReturnRepositoryPort returnRepository, OrderRepositoryPort orderRepository,
                               SettlementHoldPublisherPort settlementHoldPublisher) {
        this.returnRepository = Objects.requireNonNull(returnRepository, "returnRepository is required");
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.settlementHoldPublisher = settlementHoldPublisher;
    }

    /**
     * Pt14 audit fix: only the seller who owns the SubOrder being returned
     * may reject. ADMIN role bypasses the seller-ownership check (mirrors
     * ApproveReturnUseCase / CompleteReturnUseCase).
     */
    @Transactional
    public Return reject(UUID returnId, String sellerId, String actorRole) {
        Return orderReturn = returnRepository.findById(returnId)
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to act on this return"));
        if (!"ADMIN".equalsIgnoreCase(actorRole)) {
            ReturnAuthorization.requireSellerOwnsReturn(orderRepository, orderReturn, sellerId);
        }
        orderReturn.reject();
        Return saved = returnRepository.save(orderReturn);
        if (settlementHoldPublisher != null) {
            settlementHoldPublisher.publish(UUID.fromString(saved.orderId()), saved.subOrderId(), "RETURN", false);
        }
        return saved;
    }
}
