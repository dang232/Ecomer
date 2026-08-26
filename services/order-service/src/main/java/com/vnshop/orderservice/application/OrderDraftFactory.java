package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.application.tax.TaxResult;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentMethod;
import com.vnshop.orderservice.domain.ParcelDimensions;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

final class OrderDraftFactory {
    private final CommissionTierLookupPort tierLookup;
    private final TaxCalculationService taxService;
    private final CouponRedemptionService couponService;

    OrderDraftFactory(CommissionTierLookupPort tierLookup, TaxCalculationService taxService,
            CouponRedemptionService couponService) {
        this.tierLookup = tierLookup;
        this.taxService = taxService;
        this.couponService = couponService;
    }

    OrderDraft create(String buyerId, Address shippingAddress, ShippingDetails shippingDetails,
            List<OrderItem> items, String idempotencyKey, PaymentMethod paymentMethod, String couponCode) {
        List<OrderItem> snapshot = List.copyOf(items);
        TaxResult taxes = taxService.calculate(snapshot);
        List<OrderItem> taxedItems = applyLineItemTaxes(snapshot, taxes);
        Order order = new Order(UUID.randomUUID(), buyerId, shippingAddress, shippingDetails,
                splitBySeller(taxedItems), paymentMethod == null ? PaymentMethod.COD.name() : paymentMethod.name(),
                idempotencyKey);
        if (couponCode != null && !couponCode.isBlank()) {
            if (couponService == null) {
                throw new IllegalStateException("coupon redemption is not configured");
            }
            order.applyDiscount(couponService.consume(couponCode, order.itemsTotal(), buyerId, order.id()));
        }
        order.applyTax(new Money(taxes.totalTax()));
        return new OrderDraft(order, snapshot, shippingAddress, shippingDetails, taxes);
    }

    private List<SubOrder> splitBySeller(List<OrderItem> items) {
        Map<String, List<OrderItem>> bySeller = items.stream()
                .collect(Collectors.groupingBy(OrderItem::sellerId, Collectors.toList()));
        Map<String, CommissionTier> tiers = tierLookup.findBySellerIds(bySeller.keySet());
        List<SubOrder> result = new ArrayList<>();
        for (Map.Entry<String, List<OrderItem>> entry : bySeller.entrySet()) {
            result.add(new SubOrder(entry.getKey(), entry.getValue(),
                    tiers.getOrDefault(entry.getKey(), CommissionTier.STANDARD)));
        }
        return List.copyOf(result);
    }

    private static List<OrderItem> applyLineItemTaxes(List<OrderItem> items, TaxResult taxes) {
        if (taxes.lineItems().size() != items.size()) {
            throw new IllegalStateException("tax calculation must return one result per order item");
        }
        return IntStream.range(0, items.size()).mapToObj(index -> {
            OrderItem item = items.get(index);
            TaxResult.LineItemTax tax = taxes.lineItems().get(index);
            return new OrderItem(item.productId(), item.variantSku(), item.sellerId(), item.name(), item.quantity(),
                    item.unitPrice(), item.imageUrl(), item.parcel(), tax.rate(), BigDecimal.valueOf(tax.taxAmount()));
        }).toList();
    }

    record OrderDraft(Order order, List<OrderItem> itemSnapshot, Address shippingAddress,
            ShippingDetails shippingDetails, TaxResult taxResult) {}
}
