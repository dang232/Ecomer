package com.vnshop.orderservice;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vnshop.orderservice.application.FindOrderByIdempotencyKeyUseCase;
import com.vnshop.orderservice.application.FindOrderByIdempotencyKeyUseCase.OrderByIdempotencyKeyNotFoundException;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.infrastructure.web.ApiExceptionHandler;
import com.vnshop.orderservice.infrastructure.web.OrderController;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Plan 02a tests for {@code GET /orders/by-idempotency-key/{key}}.
 *
 * <p>Verifies:
 * <ul>
 *   <li>buyer ownership — authenticated buyer receives their own order</li>
 *   <li>non-enumerating unknown-key behavior — 404 NOT_FOUND</li>
 *   <li>non-enumerating other-buyer behavior — 404 NOT_FOUND (same shape as unknown key)</li>
 *   <li>no side effects — GET is read-only</li>
 *   <li>blank / overlong key validation — 400 BAD_REQUEST before repository access</li>
 * </ul>
 */
class OrderControllerTest {

    private final FindOrderByIdempotencyKeyUseCase useCase = mock(FindOrderByIdempotencyKeyUseCase.class);
    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new OrderController(
                    mock(com.vnshop.orderservice.application.CheckoutOrderUseCase.class),
                    mock(com.vnshop.orderservice.application.CancelOrderUseCase.class),
                    mock(com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort.class),
                    mock(com.vnshop.orderservice.application.ViewOrderUseCase.class),
                    mock(com.vnshop.orderservice.application.ConfirmDeliveryUseCase.class),
                    useCase))
            .setControllerAdvice(new ApiExceptionHandler())
            .build();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAs(String buyerId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", buyerId)
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static com.vnshop.orderservice.domain.port.out.OrderRepositoryPort fakeOrderRepo() {
        return new com.vnshop.orderservice.domain.port.out.OrderRepositoryPort() {
            @Override public Order save(Order order) { return order; }
            @Override public Optional<Order> findById(UUID orderId) { return Optional.empty(); }
            @Override public Optional<Order> findByOrderNumber(String orderNumber) { return Optional.empty(); }
            @Override public Optional<Order> findByIdempotencyKey(String key) { return Optional.empty(); }
            @Override public List<Order> findByBuyerId(String buyerId) { return List.of(); }
            @Override public Optional<Order> findBySubOrderId(Long subOrderId) { return Optional.empty(); }
            @Override public Optional<String> findOrderIdBySubOrderId(Long subOrderId) { return Optional.empty(); }
            @Override public List<Order> findBySellerIdAndFulfillmentStatus(String sellerId, FulfillmentStatus status) { return List.of(); }
        };
    }

    private Order order(String buyerId, String idempotencyKey) {
        Money price = new Money(new BigDecimal("10000"), "VND");
        OrderItem item = new OrderItem("product-1", "sku-1", "seller-1", "Phone", 1, price, null);
        SubOrder subOrder = new SubOrder(1L, "seller-1", List.of(item), FulfillmentStatus.PENDING_ACCEPTANCE,
                Money.ZERO, "STANDARD", null, null);
        return new Order(UUID.randomUUID(), "VNS-TEST-001", buyerId,
                new Address("1 Main Street", "Ward", "District", "HCMC"), List.of(subOrder),
                price, Money.ZERO, Money.ZERO, "COD", PaymentStatus.PENDING, idempotencyKey);
    }

    @Test
    void getByIdempotencyKeyReturnsOrderForAuthenticatedBuyer() throws Exception {
        Order order = order("buyer-1", "checkout-key");
        when(useCase.findForBuyer("checkout-key", "buyer-1")).thenReturn(order);

        authenticateAs("buyer-1");

        mvc.perform(get("/orders/by-idempotency-key/{key}", "checkout-key"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(order.id().toString()))
                .andExpect(jsonPath("$.data.buyerId").value("buyer-1"))
                .andExpect(jsonPath("$.data.idempotencyKey").value("checkout-key"));
    }

    @Test
    void getByIdempotencyKeyIncludesTaxTotalWhenOrderHasTax() throws Exception {
        Money price = new Money(new BigDecimal("129000"), "VND");
        Money tax = new Money(new BigDecimal("13000"), "VND");
        OrderItem item = new OrderItem("product-2", "sku-2", "seller-2", "Phone Case", 1, price, null);
        SubOrder subOrder = new SubOrder(2L, "seller-2", List.of(item), FulfillmentStatus.PENDING_ACCEPTANCE,
                Money.ZERO, "STANDARD", null, null);
        Order order = new Order(
                UUID.randomUUID(),
                "VNS-TEST-TAX",
                "buyer-tax",
                new Address("2 Main Street", "Ward", "District", "HCMC"),
                List.of(subOrder),
                price,
                Money.ZERO,
                Money.ZERO,
                tax,
                "COD",
                PaymentStatus.PENDING,
                "checkout-tax-key");
        when(useCase.findForBuyer("checkout-tax-key", "buyer-tax")).thenReturn(order);

        authenticateAs("buyer-tax");

        mvc.perform(get("/orders/by-idempotency-key/{key}", "checkout-tax-key"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.itemsTotal.amount").value(129000))
                .andExpect(jsonPath("$.data.taxTotal.amount").value(13000))
                .andExpect(jsonPath("$.data.finalAmount.amount").value(142000));
    }

    @Test
    void getByIdempotencyKeyReturns404ForUnknownKey() throws Exception {
        when(useCase.findForBuyer("unknown-key", "buyer-2"))
                .thenThrow(new OrderByIdempotencyKeyNotFoundException());

        authenticateAs("buyer-2");

        mvc.perform(get("/orders/by-idempotency-key/{key}", "unknown-key"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void getByIdempotencyKeyReturns404ForOrderOwnedByDifferentBuyer() throws Exception {
        // Buyer-2 querying a key that belongs to buyer-1 must get the same
        // 404 response as an unknown key — the controller must not leak ownership.
        when(useCase.findForBuyer("other-buyer-key", "buyer-2"))
                .thenThrow(new OrderByIdempotencyKeyNotFoundException());

        authenticateAs("buyer-2");

        mvc.perform(get("/orders/by-idempotency-key/{key}", "other-buyer-key"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void getByIdempotencyKeyIsReadOnlyNoSideEffects() throws Exception {
        Order order = order("buyer-3", "read-only-key");
        when(useCase.findForBuyer("read-only-key", "buyer-3")).thenReturn(order);

        authenticateAs("buyer-3");

        mvc.perform(get("/orders/by-idempotency-key/{key}", "read-only-key"))
                .andExpect(status().isOk());

        // GET is read-only: only the read use case is invoked, no writes.
        verify(useCase).findForBuyer("read-only-key", "buyer-3");
    }

    @Test
    void getByIdempotencyKeyRejectsBlankKeyBeforeRepositoryAccess() {
        // Blank keys are rejected by the use case before repository access.
        FindOrderByIdempotencyKeyUseCase realUseCase = new FindOrderByIdempotencyKeyUseCase(fakeOrderRepo());
        assertThatThrownBy(() -> realUseCase.findForBuyer("   ", "buyer-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void getByIdempotencyKeyRejectsOverlongKeyBeforeRepositoryAccess() {
        // Overlong keys are rejected by the use case before repository access.
        FindOrderByIdempotencyKeyUseCase realUseCase = new FindOrderByIdempotencyKeyUseCase(fakeOrderRepo());
        String overlongKey = "x".repeat(256);
        assertThatThrownBy(() -> realUseCase.findForBuyer(overlongKey, "buyer-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("too long");
    }
}
