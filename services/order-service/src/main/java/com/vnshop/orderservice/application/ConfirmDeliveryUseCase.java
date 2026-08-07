package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class ConfirmDeliveryUseCase {
    private final OrderRepositoryPort orderRepository;
    private final OrderEventPublisherPort orderEventPublisherPort;
    private final SubOrderFinancialAllocationRepositoryPort allocationRepository;
    private final SellerFinanceAdjustmentPublisherPort sellerFinanceAdjustmentPublisher;
    private final boolean sellerFinanceAdjustmentsEnabled;

    public ConfirmDeliveryUseCase(OrderRepositoryPort orderRepository,
                                  OrderEventPublisherPort orderEventPublisherPort) {
        this(orderRepository, orderEventPublisherPort, null, null, false);
    }

    public ConfirmDeliveryUseCase(OrderRepositoryPort orderRepository,
                                  OrderEventPublisherPort orderEventPublisherPort,
                                  SubOrderFinancialAllocationRepositoryPort allocationRepository,
                                  SellerFinanceAdjustmentPublisherPort sellerFinanceAdjustmentPublisher,
                                  boolean sellerFinanceAdjustmentsEnabled) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
        this.allocationRepository = allocationRepository;
        this.sellerFinanceAdjustmentPublisher = sellerFinanceAdjustmentPublisher;
        this.sellerFinanceAdjustmentsEnabled = sellerFinanceAdjustmentsEnabled;
    }

    @Transactional
    public void confirm(UUID orderId, Long subOrderId, String buyerId) {
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(subOrderId, "subOrderId is required");
        requireNonBlank(buyerId, "buyerId");

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to confirm delivery for this order"));

        if (!order.buyerId().equals(buyerId)) {
            throw new OrderAccessDeniedException("not authorized to confirm delivery for this order");
        }
        boolean codCollectionAtDelivery = "COD".equalsIgnoreCase(order.paymentMethod())
                && order.paymentStatus() == com.vnshop.orderservice.domain.PaymentStatus.PENDING;
        if (order.paymentStatus() != com.vnshop.orderservice.domain.PaymentStatus.COMPLETED
                && !codCollectionAtDelivery) {
            throw new IllegalStateException("delivery confirmation requires completed payment");
        }
        if (codCollectionAtDelivery) {
            order.markPaymentCompleted();
        }

        SubOrder subOrder = order.subOrders().stream()
                .filter(so -> subOrderId.equals(so.id()))
                .findFirst()
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to confirm delivery for this order"));

        subOrder.confirmDelivery();
        Order savedOrder = orderRepository.save(order);
        orderEventPublisherPort.publishOrderDelivered(savedOrder, subOrder);
        if (sellerFinanceAdjustmentsEnabled && allocationRepository != null && sellerFinanceAdjustmentPublisher != null) {
            allocationRepository.findByOrderId(orderId).stream()
                    .filter(allocation -> subOrderId.equals(allocation.subOrderId()))
                    .forEach(allocation -> sellerFinanceAdjustmentPublisher.publishRelease(allocation, buyerId));
        }
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
