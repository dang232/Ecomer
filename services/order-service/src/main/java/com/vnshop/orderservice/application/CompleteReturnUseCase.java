package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.RefundRequestPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;

import java.util.Objects;
import java.util.UUID;

public class CompleteReturnUseCase {
    private final ReturnRepositoryPort returnRepository;
    private final OrderRepositoryPort orderRepository;
    private final RefundRequestPort refundRequestPort;
    private final SubOrderFinancialAllocationRepositoryPort allocationRepository;
    private final SellerFinanceAdjustmentPublisherPort sellerFinancePublisher;

    public CompleteReturnUseCase(ReturnRepositoryPort returnRepository, OrderRepositoryPort orderRepository, RefundRequestPort refundRequestPort) {
        this(returnRepository, orderRepository, refundRequestPort, null, null);
    }

    public CompleteReturnUseCase(ReturnRepositoryPort returnRepository, OrderRepositoryPort orderRepository,
                                 RefundRequestPort refundRequestPort,
                                 SubOrderFinancialAllocationRepositoryPort allocationRepository,
                                 SellerFinanceAdjustmentPublisherPort sellerFinancePublisher) {
        this.returnRepository = Objects.requireNonNull(returnRepository, "returnRepository is required");
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.refundRequestPort = Objects.requireNonNull(refundRequestPort, "refundRequestPort is required");
        this.allocationRepository = allocationRepository;
        this.sellerFinancePublisher = sellerFinancePublisher;
    }

    /**
     * Pt14 audit fix: only the seller who owns the SubOrder being returned
     * may complete. ADMIN role bypasses the seller-ownership check so the
     * saga compensation flow (admin approves + completes to issue the
     * refund) works without needing a per-seller admin shim.
     */
    public Return complete(UUID returnId, String sellerId, String actorRole) {
        Return orderReturn = returnRepository.findById(returnId)
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to act on this return"));
        if (!"ADMIN".equalsIgnoreCase(actorRole)) {
            ReturnAuthorization.requireSellerOwnsReturn(orderRepository, orderReturn, sellerId);
        }
        Order order = orderRepository.findById(UUID.fromString(orderReturn.orderId()))
                .orElseThrow(() -> new IllegalStateException("return points at missing order"));
        SubOrder targetSubOrder = order.subOrders().stream()
                .filter(subOrder -> orderReturn.subOrderId().equals(subOrder.id()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("return points at missing subOrder"));
        Money refundAmount = targetSubOrder.itemsTotal();
        orderReturn.complete();
        Return savedReturn = returnRepository.save(orderReturn);
        publishReversal(targetSubOrder, order, savedReturn, refundAmount);
        refundRequestPort.requestRefund(savedReturn, targetSubOrder.sellerId(), refundAmount, targetSubOrder.commissionTier());
        return savedReturn;
    }

    private void publishReversal(SubOrder targetSubOrder, Order order, Return orderReturn, Money refundAmount) {
        if (allocationRepository == null || sellerFinancePublisher == null) return;
        allocationRepository.findByOrderId(order.id()).stream()
                .filter(allocation -> targetSubOrder.id().equals(allocation.subOrderId()))
                .findFirst()
                .ifPresent(allocation -> sellerFinancePublisher.publishReversal(
                        allocation, orderReturn.returnId(),
                        allocation.components().reversalForBuyerAmount(refundAmount.amount())));
    }
}
