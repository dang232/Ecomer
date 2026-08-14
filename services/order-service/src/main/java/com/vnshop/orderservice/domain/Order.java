package com.vnshop.orderservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class Order {
    private static final DateTimeFormatter ORDER_DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    private final UUID id;
    private final String orderNumber;
    private final String buyerId;
    private final Address shippingAddress;
    private final ShippingDetails shippingDetails;
    private final List<SubOrder> subOrders;
    private Money itemsTotal;
    private Money shippingTotal;
    private Money discount;
    private Money taxTotal;
    private Money finalAmount;
    private final String paymentMethod;
    private PaymentStatus paymentStatus;
    private final String idempotencyKey;

    // FX fields — populated when payment is completed in a foreign currency
    private BigDecimal externalAmount;
    private String externalCurrency;
    private BigDecimal fxRate;
    private Instant fxRateAt;

    public Order(UUID id, String buyerId, Address shippingAddress, List<SubOrder> subOrders, String idempotencyKey) {
        this(id, buyerId, shippingAddress, subOrders, "COD", idempotencyKey);
    }

    public Order(
            UUID id,
            String buyerId,
            Address shippingAddress,
            List<SubOrder> subOrders,
            String paymentMethod,
            String idempotencyKey) {
        this(id, generateOrderNumber(), buyerId, shippingAddress, subOrders, Money.ZERO, Money.ZERO, Money.ZERO,
                Money.ZERO, paymentMethod, PaymentStatus.PENDING, idempotencyKey);
    }

    public Order(
            UUID id,
            String buyerId,
            Address shippingAddress,
            ShippingDetails shippingDetails,
            List<SubOrder> subOrders,
            String paymentMethod,
            String idempotencyKey) {
        this(id, generateOrderNumber(), buyerId, shippingAddress, shippingDetails, subOrders,
                Money.ZERO, Money.ZERO, Money.ZERO, Money.ZERO, paymentMethod, PaymentStatus.PENDING, idempotencyKey);
    }

    public Order(
            UUID id,
            String orderNumber,
            String buyerId,
            Address shippingAddress,
            ShippingDetails shippingDetails,
            List<SubOrder> subOrders,
            Money itemsTotal,
            Money shippingTotal,
            Money discount,
            String paymentMethod,
            PaymentStatus paymentStatus,
            String idempotencyKey
    ) {
        this(id, orderNumber, buyerId, shippingAddress, shippingDetails, subOrders, itemsTotal, shippingTotal, discount,
                Money.ZERO, paymentMethod, paymentStatus, idempotencyKey);
    }

    public Order(UUID id, String orderNumber, String buyerId, Address shippingAddress, List<SubOrder> subOrders,
                 Money itemsTotal, Money shippingTotal, Money discount, Money taxTotal, String paymentMethod,
                 PaymentStatus paymentStatus, String idempotencyKey) {
        this(id, orderNumber, buyerId, shippingAddress, null, subOrders, itemsTotal, shippingTotal, discount,
                taxTotal, paymentMethod, paymentStatus, idempotencyKey);
    }

    public Order(UUID id, String orderNumber, String buyerId, Address shippingAddress, List<SubOrder> subOrders,
                 Money itemsTotal, Money shippingTotal, Money discount, String paymentMethod,
                 PaymentStatus paymentStatus, String idempotencyKey) {
        this(id, orderNumber, buyerId, shippingAddress, null, subOrders, itemsTotal, shippingTotal, discount,
                Money.ZERO, paymentMethod, paymentStatus, idempotencyKey);
    }

    public Order(
            UUID id,
            String orderNumber,
            String buyerId,
            Address shippingAddress,
            ShippingDetails shippingDetails,
            List<SubOrder> subOrders,
            Money itemsTotal,
            Money shippingTotal,
            Money discount,
            Money taxTotal,
            String paymentMethod,
            PaymentStatus paymentStatus,
            String idempotencyKey
    ) {
        Objects.requireNonNull(id, "id is required");
        requireNonBlank(orderNumber, "orderNumber");
        requireNonBlank(buyerId, "buyerId");
        requireNonBlank(idempotencyKey, "idempotencyKey");
        if (subOrders == null || subOrders.isEmpty()) {
            throw new IllegalArgumentException("subOrders must not be empty");
        }
        this.id = id;
        this.orderNumber = orderNumber;
        this.buyerId = buyerId;
        this.shippingAddress = Objects.requireNonNull(shippingAddress, "shippingAddress is required");
        this.shippingDetails = shippingDetails;
        this.subOrders = List.copyOf(subOrders);
        this.itemsTotal = Objects.requireNonNull(itemsTotal, "itemsTotal is required");
        this.shippingTotal = Objects.requireNonNull(shippingTotal, "shippingTotal is required");
        this.discount = Objects.requireNonNull(discount, "discount is required");
        this.taxTotal = Objects.requireNonNull(taxTotal, "taxTotal is required");
        this.paymentMethod = paymentMethod == null || paymentMethod.isBlank() ? "COD" : paymentMethod;
        this.paymentStatus = Objects.requireNonNull(paymentStatus, "paymentStatus is required");
        this.idempotencyKey = idempotencyKey;
        calculateTotals();
    }

    public static String generateOrderNumber() {
        // BIZ-10: UUID-based generation eliminates cross-instance collisions.
        // The old AtomicInteger counter reset on every restart, causing duplicate
        // order numbers when multiple instances were running or after restarts.
        String datePart = LocalDate.now().format(ORDER_DATE_FORMAT);
        String uniquePart = UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        return "VNS-" + datePart + "-" + uniquePart;
    }

    public UUID id() {
        return id;
    }

    public String orderNumber() {
        return orderNumber;
    }

    public String buyerId() {
        return buyerId;
    }

    public Address shippingAddress() {
        return shippingAddress;
    }

    public ShippingDetails shippingDetails() {
        return shippingDetails;
    }

    public List<SubOrder> subOrders() {
        return subOrders;
    }

    public Money itemsTotal() {
        return itemsTotal;
    }

    public Money shippingTotal() {
        return shippingTotal;
    }

    public Money discount() {
        return discount;
    }

    public Money taxTotal() {
        return taxTotal;
    }

    public Money finalAmount() {
        return finalAmount;
    }

    public String paymentMethod() {
        return paymentMethod;
    }

    public PaymentStatus paymentStatus() {
        return paymentStatus;
    }

    public String idempotencyKey() {
        return idempotencyKey;
    }

    public void calculateTotals() {
        itemsTotal = subOrders.stream()
                .map(SubOrder::itemsTotal)
                .reduce(Money.ZERO, Money::add);
        shippingTotal = subOrders.stream()
                .map(SubOrder::shippingCost)
                .reduce(Money.ZERO, Money::add);
        Money grossAmount = itemsTotal.add(shippingTotal);
        if (discount.amount().compareTo(grossAmount.amount()) > 0) {
            throw new IllegalArgumentException("discount cannot exceed order total");
        }
        finalAmount = new Money(
                grossAmount.amount()
                        .subtract(discount.amount())
                        .add(taxTotal.amount()),
                grossAmount.currency());
    }

    public void applyTax(Money taxTotal) {
        this.taxTotal = Objects.requireNonNull(taxTotal, "taxTotal is required");
        calculateTotals();
    }

    public void applyDiscount(Money discount) {
        this.discount = Objects.requireNonNull(discount, "discount is required");
        calculateTotals();
    }

    public void markPaymentCompleted() {
        paymentStatus = PaymentStatus.COMPLETED;
    }

    public void markPaymentFailed() {
        paymentStatus = PaymentStatus.FAILED;
    }

    public void markPaymentDisputed() {
        paymentStatus = PaymentStatus.DISPUTED;
    }

    public BigDecimal externalAmount() { return externalAmount; }
    public String externalCurrency() { return externalCurrency; }
    public BigDecimal fxRate() { return fxRate; }
    public Instant fxRateAt() { return fxRateAt; }

    /**
     * Records foreign-exchange details from the payment provider.
     * All four fields are set atomically — partial FX state is not allowed.
     * Pass all-null to clear (domestic payment).
     */
    public void recordFxDetails(BigDecimal externalAmount, String externalCurrency,
                                BigDecimal fxRate, Instant fxRateAt) {
        if (externalAmount != null && (externalCurrency == null || externalCurrency.isBlank())) {
            throw new IllegalArgumentException("externalCurrency required when externalAmount is set");
        }
        this.externalAmount = externalAmount;
        this.externalCurrency = externalCurrency;
        this.fxRate = fxRate;
        this.fxRateAt = fxRateAt;
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
