package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentMethod;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.application.tax.TaxResult;
import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.transaction.annotation.Transactional;

public class CreateOrderUseCase {
    private final OrderRepositoryPort orderRepository;
    private final InventoryReservationPort inventoryReservationPort;
    private final PaymentRequestPort paymentRequestPort;
    private final ShippingRequestPort shippingRequestPort;
    private final OrderEventPublisherPort orderEventPublisherPort;
    private final CommissionTierLookupPort commissionTierLookupPort;
    private final CartRepositoryPort cartRepositoryPort;
    private final MetricsPort metricsPort;
    private final SagaOrchestrator sagaOrchestrator;
    private final TaxCalculationService taxCalculationService;
    private final CouponRedemptionService couponRedemptionService;
    private final AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase;

    public CreateOrderUseCase(
            OrderRepositoryPort orderRepository,
            InventoryReservationPort inventoryReservationPort,
            PaymentRequestPort paymentRequestPort,
            ShippingRequestPort shippingRequestPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CommissionTierLookupPort commissionTierLookupPort,
            CartRepositoryPort cartRepositoryPort,
            MetricsPort metricsPort,
            SagaOrchestrator sagaOrchestrator,
            TaxCalculationService taxCalculationService,
            CouponRedemptionService couponRedemptionService,
            AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase
    ) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.inventoryReservationPort = Objects.requireNonNull(inventoryReservationPort, "inventoryReservationPort is required");
        this.paymentRequestPort = Objects.requireNonNull(paymentRequestPort, "paymentRequestPort is required");
        this.shippingRequestPort = Objects.requireNonNull(shippingRequestPort, "shippingRequestPort is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
        this.commissionTierLookupPort = Objects.requireNonNull(commissionTierLookupPort, "commissionTierLookupPort is required");
        this.cartRepositoryPort = Objects.requireNonNull(cartRepositoryPort, "cartRepositoryPort is required");
        this.metricsPort = Objects.requireNonNull(metricsPort, "metricsPort is required");
        this.sagaOrchestrator = Objects.requireNonNull(sagaOrchestrator, "sagaOrchestrator is required");
        this.taxCalculationService = Objects.requireNonNull(taxCalculationService, "taxCalculationService is required");
        this.couponRedemptionService = couponRedemptionService;
        this.allocateOrderFinancialsUseCase = Objects.requireNonNull(
                allocateOrderFinancialsUseCase, "allocateOrderFinancialsUseCase is required");
    }

    @Transactional
    public Order create(CreateOrderCommand command) {
        requireNonBlank(command.buyerId(), "buyerId");
        requireNonBlank(command.idempotencyKey(), "idempotencyKey");
        Objects.requireNonNull(command.shippingAddress(), "shippingAddress is required");
        if (command.items() == null || command.items().isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }

        orderRepository.lockIdempotencyKey(command.idempotencyKey());
        return orderRepository.findByIdempotencyKey(command.idempotencyKey())
                .orElseGet(() -> createNewOrder(
                        command.buyerId(),
                        command.shippingAddress(),
                        command.shippingDetails(),
                        command.items(),
                        command.idempotencyKey(),
                        command.paymentMethod(),
                        command.couponCode()));
    }

    private Order createNewOrder(
            String buyerId,
            Address shippingAddress,
            ShippingDetails shippingDetails,
            List<OrderItem> items,
            String idempotencyKey,
            PaymentMethod paymentMethod,
            String couponCode) {
        var timerSample = metricsPort.startTimer();
        List<OrderItem> itemSnapshot = List.copyOf(items);
        TaxResult taxResult = taxCalculationService.calculate(itemSnapshot);
        List<OrderItem> taxedItemSnapshot = applyLineItemTaxes(itemSnapshot, taxResult);
        List<SubOrder> subOrders = splitBySeller(taxedItemSnapshot);
        Order order = new Order(
                UUID.randomUUID(),
                buyerId,
                shippingAddress,
                shippingDetails,
                subOrders,
                paymentMethod == null ? PaymentMethod.COD.name() : paymentMethod.name(),
                idempotencyKey);

        if (couponCode != null && !couponCode.isBlank()) {
            if (couponRedemptionService == null) {
                throw new IllegalStateException("coupon redemption is not configured");
            }
            order.applyDiscount(couponRedemptionService.consume(
                    couponCode, order.itemsTotal(), buyerId, order.id()));
        }

        order.applyTax(new Money(taxResult.totalTax()));

        String sagaId = UUID.randomUUID().toString();
        sagaOrchestrator.start(sagaId, order.id().toString());

        try {
            inventoryReservationPort.reserve(order.id().toString(), itemSnapshot);
            sagaOrchestrator.stepCompleted(sagaId, "INVENTORY");

            paymentRequestPort.requestPayment(
                    order.id().toString(),
                    order.buyerId(),
                    order.paymentMethod(),
                    order.finalAmount());
            sagaOrchestrator.stepCompleted(sagaId, "PAYMENT");

            for (SubOrder subOrder : order.subOrders()) {
                Money payable = order.payableFor(subOrder);
                Money codAmount = "COD".equalsIgnoreCase(order.paymentMethod()) ? payable : Money.ZERO;
                shippingRequestPort.requestShipping(order.id().toString(), subOrder, shippingAddress,
                        shippingDetails, codAmount, payable);
            }
            sagaOrchestrator.stepCompleted(sagaId, "SHIPPING");

            Order savedOrder = orderRepository.save(order);
            allocateOrderFinancialsUseCase.allocate(savedOrder);
            orderEventPublisherPort.publishOrderCreated(savedOrder);
            metricsPort.recordOrderCreated();
            metricsPort.stopTimer(timerSample);
            sagaOrchestrator.complete(sagaId);
            return savedOrder;
        } catch (RuntimeException failure) {
            metricsPort.recordOrderCreationFailed();
            metricsPort.stopTimer(timerSample);
            String failedStep = determineFailedStep(sagaId);
            sagaOrchestrator.compensate(sagaId, failedStep);
            throw failure;
        }
    }

    private String determineFailedStep(String sagaId) {
        return sagaOrchestrator.getLastCompletedStep(sagaId)
                .map(step -> switch (step) {
                    case "INVENTORY" -> "PAYMENT";
                    case "PAYMENT" -> "SHIPPING";
                    default -> "INVENTORY";
                })
                .orElse("INVENTORY");
    }

    private List<SubOrder> splitBySeller(List<OrderItem> items) {
        Map<String, List<OrderItem>> itemsBySeller = items.stream()
                .collect(Collectors.groupingBy(OrderItem::sellerId, Collectors.toList()));
        Map<String, CommissionTier> tiersBySeller =
                commissionTierLookupPort.findBySellerIds(itemsBySeller.keySet());
        List<SubOrder> subOrders = new ArrayList<>();
        for (Map.Entry<String, List<OrderItem>> entry : itemsBySeller.entrySet()) {
            CommissionTier tier = tiersBySeller.getOrDefault(entry.getKey(), CommissionTier.STANDARD);
            subOrders.add(new SubOrder(entry.getKey(), entry.getValue(), tier));
        }
        return List.copyOf(subOrders);
    }

    private static List<OrderItem> applyLineItemTaxes(List<OrderItem> items, TaxResult taxResult) {
        if (taxResult.lineItems().size() != items.size()) {
            throw new IllegalStateException("tax calculation must return one result per order item");
        }
        return IntStream.range(0, items.size()).mapToObj(index -> {
            OrderItem item = items.get(index);
            TaxResult.LineItemTax tax = taxResult.lineItems().get(index);
            return new OrderItem(item.productId(), item.variantSku(), item.sellerId(), item.name(), item.quantity(),
                    item.unitPrice(), item.imageUrl(), tax.rate(), BigDecimal.valueOf(tax.taxAmount()));
        }).toList();
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
