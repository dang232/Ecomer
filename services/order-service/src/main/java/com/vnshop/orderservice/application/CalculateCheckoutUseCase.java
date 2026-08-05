package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutLineItem;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.OrderItem;
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
    private static final BigDecimal STANDARD_SHIPPING_COST = BigDecimal.ZERO;
    private static final BigDecimal NO_DISCOUNT = BigDecimal.ZERO;

    private final CartRepositoryPort cartRepositoryPort;
    private final ProductCatalogPort productCatalogPort;
    private final CouponValidationPort couponValidationPort;
    private final TaxCalculationService taxCalculationService;

    public CalculateCheckoutUseCase(CartRepositoryPort cartRepositoryPort, ProductCatalogPort productCatalogPort) {
        this(cartRepositoryPort, productCatalogPort, null, defaultTaxCalculationService());
    }

    public CalculateCheckoutUseCase(
            CartRepositoryPort cartRepositoryPort,
            ProductCatalogPort productCatalogPort,
            CouponValidationPort couponValidationPort) {
        this(cartRepositoryPort, productCatalogPort, couponValidationPort, defaultTaxCalculationService());
    }

    public CalculateCheckoutUseCase(
            CartRepositoryPort cartRepositoryPort,
            ProductCatalogPort productCatalogPort,
            CouponValidationPort couponValidationPort,
            TaxCalculationService taxCalculationService) {
        this.cartRepositoryPort = Objects.requireNonNull(cartRepositoryPort, "cartRepositoryPort is required");
        this.productCatalogPort = Objects.requireNonNull(productCatalogPort, "productCatalogPort is required");
        // couponValidationPort is optional — when null, all calculate(...)
        // calls produce zero discount (legacy behaviour preserved for tests
        // that don't care about coupon math).
        this.couponValidationPort = couponValidationPort;
        this.taxCalculationService = Objects.requireNonNull(taxCalculationService, "taxCalculationService is required");
    }

    public CheckoutBreakdown calculate(String cartId) {
        CartSnapshot cart = cartRepositoryPort.findByCartId(cartId);
        List<OrderItem> resolvedItems = cart.items().stream().map(this::resolveCartItem).toList();
        return summarize(resolvedItems, NO_DISCOUNT);
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
        List<OrderItem> resolvedItems = lineItems.stream().map(this::resolveLineItem).toList();
        BigDecimal itemsTotal = resolvedItems.stream()
                .map(item -> item.totalPrice().amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return summarize(resolvedItems, resolveDiscount(itemsTotal, couponCode, userId));
    }

    private OrderItem resolveLineItem(CheckoutLineItem line) {
        if (line.quantity() <= 0) {
            throw new IllegalArgumentException("quantity must be > 0 for productId=" + line.productId());
        }
        CatalogProduct product = productCatalogPort.findByProductId(line.productId())
                .orElseThrow(() -> new CheckoutOrderUseCase.ProductNotFoundException(
                        "product not found: " + line.productId()));
        CatalogProduct.Variant variant = product.findVariant(line.variantSku())
                .orElseThrow(() -> new CheckoutOrderUseCase.ProductNotFoundException(
                        "variant not found for productId=" + line.productId() + " sku=" + line.variantSku()));
        return new OrderItem(
                product.productId(),
                variant.sku(),
                product.sellerId(),
                product.name(),
                line.quantity(),
                variant.unitPrice(),
                product.imageUrl());
    }

    private OrderItem resolveCartItem(CartItemSnapshot item) {
        Optional<CatalogProduct> product = productCatalogPort.findByProductId(item.productId());
        if (product.isPresent()) {
            Optional<CatalogProduct.Variant> variant = product.get().findVariant(item.variantSku());
            if (variant.isPresent()) {
                CatalogProduct catalogProduct = product.get();
                CatalogProduct.Variant catalogVariant = variant.get();
                return new OrderItem(
                        catalogProduct.productId(),
                        catalogVariant.sku(),
                        catalogProduct.sellerId(),
                        catalogProduct.name(),
                        item.quantity(),
                        catalogVariant.unitPrice(),
                        catalogProduct.imageUrl());
            }
        }

        // Preserve the cart-preview fallback for stale catalog snapshots while
        // still applying the same tax rules to the preview amount.
        return new OrderItem(
                item.productId(),
                nonBlankOrDefault(item.variantSku(), "cart-snapshot"),
                "cart-preview",
                nonBlankOrDefault(item.name(), item.productId()),
                item.quantity(),
                new Money(item.unitPrice(), "VND"),
                null);
    }

    private CheckoutBreakdown summarize(List<OrderItem> items, BigDecimal discount) {
        BigDecimal itemsTotal = items.stream()
                .map(item -> item.totalPrice().amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxTotal = taxCalculationService.calculate(items).totalTax();
        BigDecimal finalAmount = itemsTotal
                .add(STANDARD_SHIPPING_COST)
                .subtract(discount)
                .add(taxTotal);
        return new CheckoutBreakdown(itemsTotal, STANDARD_SHIPPING_COST, discount, taxTotal, finalAmount);
    }

    private static TaxCalculationService defaultTaxCalculationService() {
        return new TaxCalculationService((categoryCode, asOf) -> Optional.empty());
    }

    private static String nonBlankOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
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

    public record CheckoutBreakdown(
            BigDecimal itemsTotal,
            BigDecimal shippingEstimate,
            BigDecimal discount,
            BigDecimal taxTotal,
            BigDecimal finalAmount
    ) {
        public CheckoutBreakdown(
                BigDecimal itemsTotal,
                BigDecimal shippingEstimate,
                BigDecimal discount,
                BigDecimal finalAmount) {
            this(itemsTotal, shippingEstimate, discount, BigDecimal.ZERO, finalAmount);
        }
    }
}
