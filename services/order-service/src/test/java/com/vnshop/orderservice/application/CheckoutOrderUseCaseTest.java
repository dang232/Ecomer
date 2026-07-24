package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutLineItem;
import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutOrderCommand;
import com.vnshop.orderservice.application.CheckoutOrderUseCase.ProductNotFoundException;
import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.PaymentMethod;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ProductCatalogPort;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.domain.port.out.OutboxPort;
import com.vnshop.orderservice.domain.port.out.SagaCompensationPublisherPort;
import com.vnshop.orderservice.domain.port.out.SagaStateRepository;
import com.vnshop.orderservice.domain.saga.SagaState;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies that {@link CheckoutOrderUseCase} closes the price-tampering hole.
 * The client-supplied wire shape carries only {productId, variantSku?, quantity}
 * — never a price. Anything else (sellerId, name, image, unitPrice) is sourced
 * from the {@link ProductCatalogPort} server-side.
 */
class CheckoutOrderUseCaseTest {

    private final FakeProductCatalog catalog = new FakeProductCatalog();
    private final FakeOrderRepository repository = new FakeOrderRepository();
    private final RecordingInventory inventory = new RecordingInventory();
    private final RecordingPayment payment = new RecordingPayment();
    private final RecordingShipping shipping = new RecordingShipping();
    private final TestFakes.NoopOrderEvents events = new TestFakes.NoopOrderEvents();
    private final FakeCartRepository cart = new FakeCartRepository();
    private final CommissionTierLookupPort tierLookup = new CommissionTierLookupPort() {
        @Override
        public CommissionTier findBySellerId(String sellerId) { return CommissionTier.STANDARD; }
        @Override
        public java.util.Map<String, CommissionTier> findBySellerIds(java.util.Set<String> sellerIds) {
            return sellerIds.stream().collect(java.util.stream.Collectors.toMap(id -> id, id -> CommissionTier.STANDARD));
        }
    };

    private final MetricsPort noopMetrics = new NoopMetrics();

    private CheckoutOrderUseCase newUseCase() {
        return newUseCase(null);
    }

    private CheckoutOrderUseCase newUseCase(CouponRedemptionService couponRedemptionService) {
        SagaOrchestrator sagaOrchestrator = new SagaOrchestrator(new NoopSagaStateRepository(), new NoopOutboxPort(), new NoopCompensationPublisher(), 1_000);
        TaxCalculationService taxService = new TaxCalculationService((code, date) -> java.util.Optional.of(new java.math.BigDecimal("0.10")));
        CreateOrderUseCase createOrderUseCase = new CreateOrderUseCase(
                repository, inventory, payment, shipping, events, tierLookup, cart, noopMetrics,
                sagaOrchestrator, taxService, couponRedemptionService,
                new AllocateOrderFinancialsUseCase(ignored -> { }));
        return new CheckoutOrderUseCase(catalog, createOrderUseCase);
    }

    @Test
    void placeOrderConsumesCouponOnceAndIdempotentRetryReturnsSameOrder() {
        catalog.add(new CatalogProduct(
                "p1", "seller-A", "Product",
                List.of(new CatalogProduct.Variant("sku-1", new Money(new BigDecimal("200000"), "VND"))),
                ""));
        CouponRedemptionService coupons = mock(CouponRedemptionService.class);
        when(coupons.consume(eq("SAVE10"), any(Money.class), eq("buyer-1"), any(UUID.class)))
                .thenReturn(new Money(new BigDecimal("20000")));
        CheckoutOrderUseCase useCase = newUseCase(coupons);
        CheckoutOrderCommand command = new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(new CheckoutLineItem("p1", "sku-1", 1)),
                "idem-coupon",
                PaymentMethod.COD,
                "SAVE10");

        Order first = useCase.checkout(command);
        Order retry = useCase.checkout(command);

        assertThat(retry.id()).isEqualTo(first.id());
        assertThat(first.discount().amount()).isEqualByComparingTo("20000");
        verify(coupons, times(1)).consume(
                eq("SAVE10"), any(Money.class), eq("buyer-1"), eq(first.id()));
    }

    @Test
    void resolvesPriceFromCatalogServerSideIgnoringWhateverClientMightHaveSent() {
        catalog.add(new CatalogProduct(
                "p1",
                "seller-A",
                "Authoritative Product",
                List.of(new CatalogProduct.Variant("sku-1", new Money(new BigDecimal("199000"), "VND"))),
                "https://cdn/img.png"));

        Order order = newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("1 Some St", "ward", "district", "HCM"),
                List.of(new CheckoutLineItem("p1", "sku-1", 2)),
                "idem-1"));

        assertThat(order.subOrders()).hasSize(1);
        SubOrder subOrder = order.subOrders().get(0);
        assertThat(subOrder.sellerId()).isEqualTo("seller-A");
        assertThat(subOrder.items()).hasSize(1);
        OrderItem item = subOrder.items().get(0);
        assertThat(item.productId()).isEqualTo("p1");
        assertThat(item.variantSku()).isEqualTo("sku-1");
        assertThat(item.name()).isEqualTo("Authoritative Product");
        assertThat(item.imageUrl()).isEqualTo("https://cdn/img.png");
        // The critical assertion: even if a malicious client tried to ship a
        // unitPrice on the wire, the BE doesn't accept it. The price here is
        // exactly what the catalog said.
        assertThat(item.unitPrice().amount()).isEqualByComparingTo(new BigDecimal("199000"));
        assertThat(item.unitPrice().currency()).isEqualTo("VND");
    }

    @Test
    void picksFirstVariantWhenClientOmitsVariantSku() {
        catalog.add(new CatalogProduct(
                "p1",
                "seller-A",
                "Multi-variant Product",
                List.of(
                        new CatalogProduct.Variant("default", new Money(new BigDecimal("100000"), "VND")),
                        new CatalogProduct.Variant("alt", new Money(new BigDecimal("150000"), "VND"))),
                ""));

        Order order = newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(new CheckoutLineItem("p1", null, 1)),
                "idem-default-variant"));

        assertThat(order.subOrders().get(0).items().get(0).variantSku()).isEqualTo("default");
        assertThat(order.subOrders().get(0).items().get(0).unitPrice().amount())
                .isEqualByComparingTo(new BigDecimal("100000"));
    }

    @Test
    void preservesRequestedPaymentMethodForThePaymentSaga() {
        catalog.add(new CatalogProduct(
                "p1",
                "seller-A",
                "Product",
                List.of(new CatalogProduct.Variant("sku-1", new Money(new BigDecimal("100000"), "VND"))),
                ""));

        Order order = newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(new CheckoutLineItem("p1", "sku-1", 1)),
                "idem-vietqr",
                PaymentMethod.VIETQR));

        assertThat(order.paymentMethod()).isEqualTo("VIETQR");
    }

    @Test
    void rejectsMissingProduct() {
        // Catalog empty — any productId is unknown.

        assertThatThrownBy(() -> newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(new CheckoutLineItem("missing", null, 1)),
                "idem-missing")))
                .isInstanceOf(ProductNotFoundException.class)
                .hasMessageContaining("missing");
    }

    @Test
    void rejectsMissingVariantSkuWhenClientNamesOneThatDoesNotExist() {
        catalog.add(new CatalogProduct(
                "p1",
                "seller-A",
                "Product",
                List.of(new CatalogProduct.Variant("real-sku", new Money(new BigDecimal("100000"), "VND"))),
                ""));

        assertThatThrownBy(() -> newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(new CheckoutLineItem("p1", "fake-sku", 1)),
                "idem-bad-sku")))
                .isInstanceOf(ProductNotFoundException.class)
                .hasMessageContaining("fake-sku");
    }

    @Test
    void rejectsEmptyLineItemList() {
        assertThatThrownBy(() -> newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(),
                "idem-empty")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("items");
    }

    @Test
    void groupsItemsBySellerWhenLineItemsSpanMultipleSellers() {
        catalog.add(new CatalogProduct(
                "p1", "seller-A", "Product 1",
                List.of(new CatalogProduct.Variant("sku1", new Money(new BigDecimal("100000"), "VND"))),
                ""));
        catalog.add(new CatalogProduct(
                "p2", "seller-B", "Product 2",
                List.of(new CatalogProduct.Variant("sku2", new Money(new BigDecimal("200000"), "VND"))),
                ""));

        Order order = newUseCase().checkout(new CheckoutOrderCommand(
                "buyer-1",
                new Address("street", "ward", "district", "city"),
                List.of(
                        new CheckoutLineItem("p1", "sku1", 1),
                        new CheckoutLineItem("p2", "sku2", 1)),
                "idem-multi-seller"));

        assertThat(order.subOrders()).hasSize(2);
        assertThat(order.subOrders().stream().map(SubOrder::sellerId).toList())
                .containsExactlyInAnyOrder("seller-A", "seller-B");
    }

    // --- fakes ----------------------------------------------------------

    private static final class FakeProductCatalog implements ProductCatalogPort {
        private final Map<String, CatalogProduct> products = new HashMap<>();

        void add(CatalogProduct product) {
            products.put(product.productId(), product);
        }

        @Override
        public Optional<CatalogProduct> findByProductId(String productId) {
            return Optional.ofNullable(products.get(productId));
        }
    }

    private static final class FakeOrderRepository implements OrderRepositoryPort {
        private final Map<UUID, Order> byId = new HashMap<>();
        private final Map<String, Order> byIdem = new HashMap<>();
        private long nextSubOrderId = 1L;

        @Override
        public Order save(Order order) {
            List<SubOrder> persistedSubOrders = order.subOrders().stream().map(subOrder -> new SubOrder(nextSubOrderId++,
                    subOrder.sellerId(), subOrder.items(), subOrder.fulfillmentStatus(), subOrder.shippingInfo(),
                    subOrder.commissionTier())).toList();
            Order persisted = new Order(order.id(), order.orderNumber(), order.buyerId(), order.shippingAddress(),
                    persistedSubOrders, order.itemsTotal(), order.shippingTotal(), order.discount(), order.taxTotal(),
                    order.paymentMethod(), order.paymentStatus(), order.idempotencyKey());
            byId.put(persisted.id(), persisted);
            byIdem.put(persisted.idempotencyKey(), persisted);
            return persisted;
        }
        @Override public Optional<Order> findById(UUID id) { return Optional.ofNullable(byId.get(id)); }
        @Override public Optional<Order> findByOrderNumber(String orderNumber) { return Optional.empty(); }
        @Override public Optional<Order> findByIdempotencyKey(String key) { return Optional.ofNullable(byIdem.get(key)); }
        @Override public List<Order> findByBuyerId(String buyerId) { return List.of(); }
        @Override public Optional<Order> findBySubOrderId(Long subOrderId) { return Optional.empty(); }
        @Override public Optional<String> findOrderIdBySubOrderId(Long subOrderId) { return Optional.empty(); }
        @Override public List<Order> findBySellerIdAndFulfillmentStatus(String sellerId, com.vnshop.orderservice.domain.FulfillmentStatus status) { return List.of(); }
    }

    private static final class RecordingInventory implements InventoryReservationPort {
        @Override public void reserve(String orderId, List<OrderItem> items) {}
        @Override public void release(String orderId) {}
    }

    private static final class RecordingPayment implements PaymentRequestPort {
        @Override public void requestPayment(String orderId, String buyerId, String paymentMethod, Money amount) {}
    }

    private static final class RecordingShipping implements ShippingRequestPort {
        @Override public void requestShipping(String orderId, SubOrder subOrder, Address address) {}
    }


    private static final class FakeCartRepository implements CartRepositoryPort {
        @Override public com.vnshop.orderservice.domain.checkout.CartSnapshot findByCartId(String cartId) { return new com.vnshop.orderservice.domain.checkout.CartSnapshot(cartId, List.of()); }
        @Override public void clearCart(String userId) {}
    }

    private static final class NoopMetrics implements MetricsPort {
        @Override public Object startTimer() { return new Object(); }
        @Override public void stopTimer(Object timerSample) {}
        @Override public void recordOrderCreated() {}
        @Override public void recordOrderCancelled() {}
        @Override public void recordOrderCreationFailed() {}
    }

    private static final class NoopSagaStateRepository implements SagaStateRepository {
        @Override public SagaState save(SagaState s) { return s; }
        @Override public java.util.Optional<SagaState> findBySagaId(String id) { return java.util.Optional.empty(); }
        @Override public java.util.Optional<SagaState> findByOrderId(String id) { return java.util.Optional.empty(); }
        @Override public java.util.List<SagaState> findCompensatingUpdatedBefore(java.time.Instant cutoff) { return java.util.List.of(); }
    }

    private static final class NoopOutboxPort implements OutboxPort {
        @Override public void publish(String aggregateType, String aggregateId, String eventType, String payload) {}
    }

    private static final class NoopCompensationPublisher implements SagaCompensationPublisherPort {
        @Override public void publishInventoryReleaseRequested(String orderId, String sagaId) {}
        @Override public void publishPaymentRefundRequested(String orderId, String sagaId) {}
    }
}
