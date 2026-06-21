package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;

import java.util.Objects;
import java.util.UUID;

public class ApproveReturnUseCase {
    private final ReturnRepositoryPort returnRepository;
    private final OrderRepositoryPort orderRepository;

    public ApproveReturnUseCase(ReturnRepositoryPort returnRepository, OrderRepositoryPort orderRepository) {
        this.returnRepository = Objects.requireNonNull(returnRepository, "returnRepository is required");
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
    }

    /**
     * Pt14 audit fix: only the seller who owns the SubOrder being returned
     * may approve. Without this check any authenticated seller could approve
     * any other seller's returns by guessing the returnId UUID.
     *
     * <p>ADMIN role bypasses the seller-ownership check (admins mediate
     * cross-seller disputes and the saga compensation flow).
     */
    public Return approve(UUID returnId, String sellerId, String actorRole) {
        Return orderReturn = returnRepository.findById(returnId)
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to act on this return"));
        if (!"ADMIN".equalsIgnoreCase(actorRole)) {
            ReturnAuthorization.requireSellerOwnsReturn(orderRepository, orderReturn, sellerId);
        }
        orderReturn.approve();
        return returnRepository.save(orderReturn);
    }
}
