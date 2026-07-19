package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutLineItem;
import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import com.vnshop.orderservice.domain.checkout.CartItemSnapshot;
import com.vnshop.orderservice.domain.checkout.CartSnapshot;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.CouponValidationPort;
import com.vnshop.orderservice.domain.port.out.ProductCatalogPort;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class CalculateCheckoutUseCase {
    private static final BigDecimal STANDARD_SHIPPING_COST = BigDecimal.valueOf(30000);
    private static final BigDecimal NO_DISCOUNT = BigDecimal.ZERO;

    private final CartRepositoryPort cartRepositoryPort;
    private final ProductCatalogPort productCatalogPort;
    private final CouponValidationPort couponValidationPort;

    public CalculateCheckoutUseCase(CartRepositoryPort cartRepositoryPort, ProductCatalogPort productCatalogPort) {
        this(cartRepositoryPort, productCatalogPort, null);
    }

    public CalculateCheckoutUseCase(
            CartRepositoryPort cartRepositoryPort,
            ProductCatalogPort productCatalogPort,
            CouponValidationPort couponValidationPort) {
        this.cartRepositoryPort = Objects.requireNonNull(cartRepositoryPort, "cartRepositoryPort is required");
        this.productCatalogPort = Objects.requireNonNull(productCatalogPort, "productCatalogPort is required");
        // couponValidationPort is optional — when null, all calculate(...)
        // calls produce zero discount (legacy behaviour preserved for tests
        // that don't care about coupon math).
        this.couponValidationPort = couponValidationPort;
    }

    public CheckoutBreakdown calculate(String cartId) {
        CartSnapshot cart = cartRepositoryPort.findByCartId(cartId);
        BigDecimal itemsTotal = cart.items().stream()
                .map(item -> {
                    BigDecimal authoritativePrice = productCatalogPort.findByProductId(item.productId())
                            .flatMap(p -> p.findVariant(item.variantSku()))
                            .map(v -> v.unitPrice().amount())
                            .orElse(item.unitPrice()); // fallback to cart price if product/variant not found
                    return authoritativePrice.multiply(BigDecimal.valueOf(item.quantity()));
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return summarize(itemsTotal, NO_DISCOUNT);
    }

    /**
     * Light-shape preview without coupon resolution. Kept for backward
     * compatibility with callers (and tests) that don't need coupon math.
     */
    public CheckoutBreakdown calculate(List<CheckoutLineItem> lineItems) {
        return calculate(lineItems, null, null);
    }

    /**
     * Light-shape preview: client sends {@code (productId, variantSku?, quantity)}
     * tuples; we resolve each to its authoritative catalog price and sum. Mirrors
     * the contract used by {@link CheckoutOrderUseCase} — same security boundary,
     * client-supplied prices are structurally impossible.
     *
     * <p>When {@code couponCode} is non-blank and a {@link CouponValidationPort}
     * is wired, the discount is resolved server-side via coupon-service:
     * the FE never sets the discount amount, only proposes a code. An
     * invalid/expired code or a coupon-service outage silently produces
     * zero discount instead of 4xxing the preview — the caller's
     * {@code /checkout/apply-coupon} round-trip (also routed at
     * coupon-service) is the place that surfaces "your coupon is invalid"
     * errors.</p>
     */
    public CheckoutBreakdown calculate(List<CheckoutLineItem> lineItems, String couponCode, String userId) {
        if (lineItems == null || lineItems.isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }
        BigDecimal itemsTotal = BigDecimal.ZERO;
        for (CheckoutLineItem line : lineItems) {
            if (line.quantity() <= 0) {
                throw new IllegalArgumentException("quantity must be > 0 for productId=" + line.productId());
            }
            CatalogProduct product = productCatalogPort.findByProductId(line.productId())
                    .orElseThrow(() -> new CheckoutOrderUseCase.ProductNotFoundException(
                            "product not found: " + line.productId()));
            CatalogProduct.Variant variant = product.findVariant(line.variantSku())
                    .orElseThrow(() -> new CheckoutOrderUseCase.ProductNotFoundException(
                            "variant not found for productId=" + line.productId() + " sku=" + line.variantSku()));
            itemsTotal = itemsTotal.add(variant.unitPrice().amount().multiply(BigDecimal.valueOf(line.quantity())));
        }
        return summarize(itemsTotal, resolveDiscount(itemsTotal, couponCode, userId));
    }

    public BigDecimal standardShippingCost() {
        return STANDARD_SHIPPING_COST;
    }

    private BigDecimal resolveDiscount(BigDecimal itemsTotal, String couponCode, String userId) {
        if (couponCode == null || couponCode.isBlank() || couponValidationPort == null) {
            return NO_DISCOUNT;
        }
        Optional<BigDecimal> resolved = couponValidationPort.resolveDiscount(couponCode, itemsTotal, userId);
        if (resolved.isEmpty()) return NO_DISCOUNT;
        BigDecimal discount = resolved.get();
        // Cap at items subtotal so a buggy coupon-service response can't
        // invert the cart total.
        return discount.compareTo(itemsTotal) > 0 ? itemsTotal : discount;
    }

    private CheckoutBreakdown summarize(BigDecimal itemsTotal, BigDecimal discount) {
        BigDecimal finalAmount = itemsTotal.add(STANDARD_SHIPPING_COST).subtract(discount);
        return new CheckoutBreakdown(itemsTotal, STANDARD_SHIPPING_COST, discount, finalAmount);
    }

    public record CheckoutBreakdown(
            BigDecimal itemsTotal,
            BigDecimal shippingEstimate,
            BigDecimal discount,
            BigDecimal finalAmount
    ) {
    }
}
