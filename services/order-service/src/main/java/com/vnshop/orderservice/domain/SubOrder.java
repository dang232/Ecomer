package com.vnshop.orderservice.domain;

import java.util.List;
import java.util.Objects;

public class SubOrder {
    private final Long id;
    private final String sellerId;
    private final List<OrderItem> items;
    private FulfillmentStatus fulfillmentStatus;
    private ShippingInfo shippingInfo;
    private CommissionTier commissionTier;
    private final ParcelDimensions parcel;

    public SubOrder(String sellerId, List<OrderItem> items) {
        this(null, sellerId, items, FulfillmentStatus.PENDING_ACCEPTANCE, ShippingInfo.EMPTY, null,
                items.stream().anyMatch(item -> item.parcel() == null) ? null : ParcelDimensions.aggregate(items, sellerId));
    }

    public SubOrder(String sellerId, List<OrderItem> items, CommissionTier commissionTier) {
        this(null, sellerId, items, FulfillmentStatus.PENDING_ACCEPTANCE, ShippingInfo.EMPTY, commissionTier,
                items.stream().anyMatch(item -> item.parcel() == null) ? null : ParcelDimensions.aggregate(items, sellerId));
    }

    public SubOrder(String sellerId, List<OrderItem> items, CommissionTier commissionTier, ParcelDimensions parcel) {
        this(null, sellerId, items, FulfillmentStatus.PENDING_ACCEPTANCE, ShippingInfo.EMPTY, commissionTier, parcel);
    }

    /** Backward-compatible 8-param constructor used by tests and legacy call sites. */
    public SubOrder(
            Long id,
            String sellerId,
            List<OrderItem> items,
            FulfillmentStatus fulfillmentStatus,
            Money shippingCost,
            String shippingMethod,
            String carrier,
            String trackingNumber
    ) {
        this(id, sellerId, items, fulfillmentStatus,
                new ShippingInfo(shippingCost, shippingMethod, carrier, trackingNumber), null,
                items.stream().anyMatch(item -> item.parcel() == null) ? null : ParcelDimensions.aggregate(items, sellerId));
    }

    /** Backward-compatible 9-param constructor used by tests and legacy call sites. */
    public SubOrder(
            Long id,
            String sellerId,
            List<OrderItem> items,
            FulfillmentStatus fulfillmentStatus,
            Money shippingCost,
            String shippingMethod,
            String carrier,
            String trackingNumber,
            CommissionTier commissionTier
    ) {
        this(id, sellerId, items, fulfillmentStatus,
                new ShippingInfo(shippingCost, shippingMethod, carrier, trackingNumber), commissionTier,
                items.stream().anyMatch(item -> item.parcel() == null) ? null : ParcelDimensions.aggregate(items, sellerId));
    }

    /** Canonical constructor — takes a ShippingInfo value object. */
    public SubOrder(
            Long id,
            String sellerId,
            List<OrderItem> items,
            FulfillmentStatus fulfillmentStatus,
            ShippingInfo shippingInfo,
            CommissionTier commissionTier
    ) {
        this(id, sellerId, items, fulfillmentStatus, shippingInfo, commissionTier,
                items.stream().anyMatch(item -> item.parcel() == null) ? null : ParcelDimensions.aggregate(items, sellerId));
    }

    /** Canonical constructor with a persisted parcel snapshot. */
    public SubOrder(
            Long id,
            String sellerId,
            List<OrderItem> items,
            FulfillmentStatus fulfillmentStatus,
            ShippingInfo shippingInfo,
            CommissionTier commissionTier,
            ParcelDimensions parcel
    ) {
        requireNonBlank(sellerId, "sellerId");
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }
        this.id = id;
        this.sellerId = sellerId;
        this.items = List.copyOf(items);
        this.fulfillmentStatus = Objects.requireNonNull(fulfillmentStatus, "fulfillmentStatus is required");
        Objects.requireNonNull(shippingInfo, "shippingInfo is required");
        // Normalise shippingMethod to "STANDARD" when blank
        String method = shippingInfo.shippingMethod();
        ShippingInfo normalised = (method == null || method.isBlank())
                ? new ShippingInfo(shippingInfo.shippingCost(), "STANDARD", shippingInfo.carrier(), shippingInfo.trackingNumber())
                : shippingInfo;
        this.shippingInfo = normalised;
        this.commissionTier = commissionTier != null ? commissionTier : CommissionTier.STANDARD;
        this.parcel = parcel;
    }

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------

    public Long id() {
        return id;
    }

    public String sellerId() {
        return sellerId;
    }

    public List<OrderItem> items() {
        return items;
    }

    public FulfillmentStatus fulfillmentStatus() {
        return fulfillmentStatus;
    }

    public ShippingInfo shippingInfo() {
        return shippingInfo;
    }

    // Delegating accessors — kept for backward compatibility with all call sites.
    public Money shippingCost() {
        return shippingInfo.shippingCost();
    }

    public String shippingMethod() {
        return shippingInfo.shippingMethod();
    }

    public String carrier() {
        return shippingInfo.carrier();
    }

    public String trackingNumber() {
        return shippingInfo.trackingNumber();
    }

    public CommissionTier commissionTier() {
        return commissionTier;
    }

    public ParcelDimensions parcel() {
        return parcel;
    }

    public Money itemsTotal() {
        return items.stream()
                .map(OrderItem::totalPrice)
                .reduce(Money.ZERO, Money::add);
    }

    // -------------------------------------------------------------------------
    // State transitions
    // -------------------------------------------------------------------------

    public void accept() {
        transitionTo(FulfillmentStatus.ACCEPTED);
    }

    public void reject() {
        transitionTo(FulfillmentStatus.REJECTED);
    }

    public void pack() {
        transitionTo(FulfillmentStatus.PACKED);
    }

    public void ship(String carrier, String trackingNumber) {
        requireNonBlank(carrier, "carrier");
        requireNonBlank(trackingNumber, "trackingNumber");
        transitionTo(FulfillmentStatus.SHIPPED);
        this.shippingInfo = shippingInfo.withTracking(carrier, trackingNumber);
    }

    public void confirmDelivery() {
        transitionTo(FulfillmentStatus.DELIVERED);
    }

    public void cancel() {
        if (fulfillmentStatus != FulfillmentStatus.PENDING_ACCEPTANCE
                && fulfillmentStatus != FulfillmentStatus.ACCEPTED) {
            throw new IllegalStateException("cannot cancel from " + fulfillmentStatus);
        }
        fulfillmentStatus = FulfillmentStatus.CANCELLED;
    }

    public void setShippingCost(Money shippingCost) {
        Objects.requireNonNull(shippingCost, "shippingCost is required");
        this.shippingInfo = shippingInfo.withCost(shippingCost);
    }

    public void setShippingMethod(String shippingMethod) {
        String method = shippingMethod == null || shippingMethod.isBlank() ? "STANDARD" : shippingMethod;
        this.shippingInfo = new ShippingInfo(shippingInfo.shippingCost(), method, shippingInfo.carrier(), shippingInfo.trackingNumber());
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void transitionTo(FulfillmentStatus nextStatus) {
        if (!canTransitionTo(nextStatus)) {
            throw new IllegalStateException("cannot transition from " + fulfillmentStatus + " to " + nextStatus);
        }
        fulfillmentStatus = nextStatus;
    }

    private boolean canTransitionTo(FulfillmentStatus nextStatus) {
        return switch (fulfillmentStatus) {
            case PENDING_ACCEPTANCE -> nextStatus == FulfillmentStatus.ACCEPTED || nextStatus == FulfillmentStatus.REJECTED;
            case ACCEPTED -> nextStatus == FulfillmentStatus.PACKED;
            case PACKED -> nextStatus == FulfillmentStatus.SHIPPED;
            case SHIPPED -> nextStatus == FulfillmentStatus.DELIVERED;
            case DELIVERED, REJECTED, CANCELLED -> false;
        };
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }

}
