package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentMethod;
import com.vnshop.orderservice.domain.port.out.ProductCatalogPort;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * HTTP-edge wrapper around {@link CreateOrderUseCase}. Accepts the lightweight
 * client-supplied line items ({@code productId, variantSku?, quantity}) and
 * resolves them server-side via {@link ProductCatalogPort} into the full
 * {@link OrderItem} shape the domain requires.
 *
 * <p>Critical security boundary: the unit price comes from the product-service,
 * never from the client. This closes the schema-drift hole where a tampered
 * {@code unitPriceAmount} on the wire could place an order at any price the
 * client chose.
 */
public class CheckoutOrderUseCase {
    private final ProductCatalogPort productCatalogPort;
    private final CreateOrderUseCase createOrderUseCase;

    public CheckoutOrderUseCase(ProductCatalogPort productCatalogPort, CreateOrderUseCase createOrderUseCase) {
        this.productCatalogPort = Objects.requireNonNull(productCatalogPort, "productCatalogPort is required");
        this.createOrderUseCase = Objects.requireNonNull(createOrderUseCase, "createOrderUseCase is required");
    }

    public Order checkout(CheckoutOrderCommand command) {
        Objects.requireNonNull(command, "command is required");
        if (command.lineItems() == null || command.lineItems().isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }
        List<OrderItem> resolved = resolveItems(command.lineItems());
        return createOrderUseCase.create(new CreateOrderCommand(
                command.buyerId(),
                command.shippingAddress(),
                resolved,
                command.idempotencyKey(),
                command.paymentMethod(),
                command.couponCode()));
    }

    private List<OrderItem> resolveItems(List<CheckoutLineItem> lineItems) {
        List<OrderItem> resolved = new ArrayList<>(lineItems.size());
        for (CheckoutLineItem line : lineItems) {
            if (line.quantity() <= 0) {
                throw new IllegalArgumentException("quantity must be > 0 for productId=" + line.productId());
            }
            CatalogProduct product = productCatalogPort.findByProductId(line.productId())
                    .orElseThrow(() -> new ProductNotFoundException(
                            "product not found: " + line.productId()));
            CatalogProduct.Variant variant = product.findVariant(line.variantSku())
                    .orElseThrow(() -> new ProductNotFoundException(
                            "variant not found for productId=" + line.productId() + " sku=" + line.variantSku()));
            resolved.add(new OrderItem(
                    product.productId(),
                    variant.sku(),
                    product.sellerId(),
                    product.name(),
                    line.quantity(),
                    variant.unitPrice(),
                    product.imageUrl()));
        }
        return resolved;
    }

    /**
     * Thrown when a productId or variantSku from the client doesn't exist in
     * the product-service. Mapped to 404 by {@code ApiExceptionHandler}.
     */
    public static class ProductNotFoundException extends RuntimeException {
        public ProductNotFoundException(String message) {
            super(message);
        }
    }

    public record CheckoutOrderCommand(
            String buyerId,
            Address shippingAddress,
            List<CheckoutLineItem> lineItems,
            String idempotencyKey,
            PaymentMethod paymentMethod,
            String couponCode
    ) {
        public CheckoutOrderCommand(
                String buyerId,
                Address shippingAddress,
                List<CheckoutLineItem> lineItems,
                String idempotencyKey,
                PaymentMethod paymentMethod) {
            this(buyerId, shippingAddress, lineItems, idempotencyKey, paymentMethod, null);
        }

        public CheckoutOrderCommand(
                String buyerId,
                Address shippingAddress,
                List<CheckoutLineItem> lineItems,
                String idempotencyKey) {
            this(buyerId, shippingAddress, lineItems, idempotencyKey, PaymentMethod.COD, null);
        }
    }

    public record CheckoutLineItem(String productId, String variantSku, int quantity) {
    }
}
