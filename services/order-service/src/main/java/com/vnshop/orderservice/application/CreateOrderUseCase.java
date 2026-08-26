package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import org.springframework.transaction.annotation.Transactional;
import io.github.resilience4j.bulkhead.Bulkhead;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class CreateOrderUseCase {
    private final OrderRepositoryPort orderRepository;
    private final OrderDraftFactory draftFactory;
    private final OrderCreationFulfillmentService fulfillment;

    public CreateOrderUseCase(OrderRepositoryPort orderRepository, InventoryReservationPort inventoryReservationPort,
            PaymentRequestPort paymentRequestPort, ShippingRequestPort shippingRequestPort,
            OrderEventPublisherPort orderEventPublisherPort, CommissionTierLookupPort commissionTierLookupPort,
            CartRepositoryPort ignoredCartRepositoryPort, MetricsPort metricsPort, SagaOrchestrator sagaOrchestrator,
            TaxCalculationService taxCalculationService, CouponRedemptionService couponRedemptionService,
            AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase) {
        this(orderRepository, inventoryReservationPort, paymentRequestPort, shippingRequestPort,
                orderEventPublisherPort, commissionTierLookupPort, ignoredCartRepositoryPort, metricsPort,
                 sagaOrchestrator, taxCalculationService, couponRedemptionService, allocateOrderFinancialsUseCase,
                 new OrderCreationPersistenceService(orderRepository, orderEventPublisherPort, sagaOrchestrator,
                         Objects.requireNonNull(allocateOrderFinancialsUseCase,
                                 "allocateOrderFinancialsUseCase is required")),
                 Bulkhead.ofDefaults("inventory"), Bulkhead.ofDefaults("payment"), Bulkhead.ofDefaults("shipping"));
    }

    public CreateOrderUseCase(OrderRepositoryPort orderRepository, InventoryReservationPort inventoryReservationPort,
            PaymentRequestPort paymentRequestPort, ShippingRequestPort shippingRequestPort,
            OrderEventPublisherPort orderEventPublisherPort, CommissionTierLookupPort commissionTierLookupPort,
            CartRepositoryPort ignoredCartRepositoryPort, MetricsPort metricsPort, SagaOrchestrator sagaOrchestrator,
            TaxCalculationService taxCalculationService, CouponRedemptionService couponRedemptionService,
             AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase,
             OrderCreationPersistenceService persistence,
             Bulkhead inventoryBulkhead, Bulkhead paymentBulkhead, Bulkhead shippingBulkhead) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        Objects.requireNonNull(inventoryReservationPort, "inventoryReservationPort is required");
        Objects.requireNonNull(paymentRequestPort, "paymentRequestPort is required");
        Objects.requireNonNull(shippingRequestPort, "shippingRequestPort is required");
        Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
        Objects.requireNonNull(commissionTierLookupPort, "commissionTierLookupPort is required");
        Objects.requireNonNull(ignoredCartRepositoryPort, "cartRepositoryPort is required");
        Objects.requireNonNull(metricsPort, "metricsPort is required");
        Objects.requireNonNull(sagaOrchestrator, "sagaOrchestrator is required");
        Objects.requireNonNull(taxCalculationService, "taxCalculationService is required");
        this.draftFactory = new OrderDraftFactory(commissionTierLookupPort, taxCalculationService, couponRedemptionService);
        this.fulfillment = new OrderCreationFulfillmentService(persistence, inventoryReservationPort,
                 paymentRequestPort, shippingRequestPort, orderEventPublisherPort, metricsPort, sagaOrchestrator,
                 Objects.requireNonNull(allocateOrderFinancialsUseCase, "allocateOrderFinancialsUseCase is required"),
                 inventoryBulkhead, paymentBulkhead, shippingBulkhead);
    }

    public CreateOrderUseCase(OrderRepositoryPort orderRepository, InventoryReservationPort inventoryReservationPort,
            PaymentRequestPort paymentRequestPort, ShippingRequestPort shippingRequestPort,
            OrderEventPublisherPort orderEventPublisherPort, CommissionTierLookupPort commissionTierLookupPort,
            CartRepositoryPort ignoredCartRepositoryPort, MetricsPort metricsPort, SagaOrchestrator sagaOrchestrator,
            TaxCalculationService taxCalculationService, CouponRedemptionService couponRedemptionService,
            AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase,
            OrderCreationPersistenceService persistence) {
        this(orderRepository, inventoryReservationPort, paymentRequestPort, shippingRequestPort,
                orderEventPublisherPort, commissionTierLookupPort, ignoredCartRepositoryPort, metricsPort,
                sagaOrchestrator, taxCalculationService, couponRedemptionService, allocateOrderFinancialsUseCase,
                persistence, Bulkhead.ofDefaults("inventory"), Bulkhead.ofDefaults("payment"),
                Bulkhead.ofDefaults("shipping"));
    }

    @Transactional
    public Optional<Order> findExistingOrderForBuyer(String idempotencyKey, String buyerId) {
        requireNonBlank(buyerId, "buyerId");
        requireNonBlank(idempotencyKey, "idempotencyKey");
        orderRepository.lockIdempotencyKey(idempotencyKey);
        return reconcileExistingOrder(idempotencyKey, buyerId);
    }

    public Order create(CreateOrderCommand command) {
        requireNonBlank(command.buyerId(), "buyerId");
        requireNonBlank(command.idempotencyKey(), "idempotencyKey");
        Optional<Order> existing = reconcileExistingOrder(command.idempotencyKey(), command.buyerId());
        if (existing.isPresent()) {
            return existing.get();
        }
        Objects.requireNonNull(command.shippingAddress(), "shippingAddress is required");
        if (command.items() == null || command.items().isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }
        validateTrustedParcels(command.items(), command.shippingDetails());
        return fulfillment.execute(draftFactory.create(command.buyerId(), command.shippingAddress(),
                command.shippingDetails(), command.items(), command.idempotencyKey(), command.paymentMethod(),
                command.couponCode()));
    }

    private Optional<Order> reconcileExistingOrder(String idempotencyKey, String buyerId) {
        Optional<Order> existing = orderRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent() && !buyerId.equals(existing.get().buyerId())) {
            throw new OrderAccessDeniedException("not authorized for this order");
        }
        return existing;
    }

    private static void validateTrustedParcels(List<OrderItem> items, ShippingDetails shippingDetails) {
        if (shippingDetails == null) {
            return;
        }
        items.stream().collect(java.util.stream.Collectors.groupingBy(OrderItem::sellerId))
                .forEach((sellerId, sellerItems) -> com.vnshop.orderservice.domain.ParcelDimensions.aggregate(sellerItems, sellerId));
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
