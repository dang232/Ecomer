package com.vnshop.orderservice;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vnshop.orderservice.application.AdminOrderUseCase;
import com.vnshop.orderservice.application.DisputeUseCase;
import com.vnshop.orderservice.application.EnrichedDispute;
import com.vnshop.orderservice.application.ListOpenDisputesUseCase;
import com.vnshop.orderservice.application.AdminRefundUseCase;
import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import com.vnshop.orderservice.infrastructure.web.AdminDisputeController;
import com.vnshop.orderservice.infrastructure.web.AdminOrderController;
import com.vnshop.orderservice.infrastructure.web.ApiExceptionHandler;
import com.vnshop.orderservice.infrastructure.web.pagination.AdminCursorCodec;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;

class AdminCursorPaginationTest {
    private static final Instant NOW = Instant.parse("2026-08-08T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void ordersUseBoundedCursorResponseWithoutCallingLegacyPagePath() throws Exception {
        AdminOrderUseCase useCase = mock(AdminOrderUseCase.class);
        AdminCursorCodec codec = new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK);
        OrderSummaryProjection first = order("order-1", NOW.minusSeconds(1));
        OrderSummaryProjection second = order("order-2", NOW.minusSeconds(2));
        when(useCase.listAllOrdersCursor(eq("phone"), eq("PENDING"), eq(null), eq(null), eq(3)))
                .thenReturn(List.of(first, second, order("order-3", NOW.minusSeconds(3))));
        when(useCase.listAllOrders(any(), any(), any(PageRequest.class)))
                .thenReturn(Page.empty());

        mvc(useCase, codec, mock(AdminRefundUseCase.class)).perform(get("/admin/orders")
                        .param("limit", "2")
                        .param("q", "phone")
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.hasMore").value(true))
                .andExpect(jsonPath("$.data.nextCursor").isNotEmpty());

        verify(useCase, never()).listAllOrders(any(), any(), any(PageRequest.class));
    }

    @Test
    void cursorRejectsFilterScopeChanges() throws Exception {
        AdminOrderUseCase useCase = mock(AdminOrderUseCase.class);
        AdminCursorCodec codec = new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK);
        String cursor = codec.encode(new AdminCursorCodec.Cursor(
                "admin-orders", "other-filter", "createdAt:desc,id:desc", NOW.toString(), "order-1", null,
                NOW.plusSeconds(3600)));

        mvc(useCase, codec, mock(AdminRefundUseCase.class)).perform(get("/admin/orders")
                        .param("limit", "2")
                        .param("cursor", cursor)
                        .param("q", "phone"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("cursor_scope_mismatch"));
    }

    @Test
    void signedInvalidOrderAnchorReturnsCursorInvalidWithoutLegacyFallback() throws Exception {
        AdminOrderUseCase useCase = mock(AdminOrderUseCase.class);
        String token = signed("{\"v\":1,\"resource\":\"admin-orders\",\"filterHash\":\""
                + sha256("\u0000") + "\",\"sort\":\"createdAt:desc,id:desc\",\"sortKey\":\"bad\","
                + "\"uniqueId\":\"order-1\",\"expiresAt\":\"2026-08-08T01:00:00Z\"}");

        mvc(useCase, new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK), mock(AdminRefundUseCase.class))
                .perform(get("/admin/orders").param("limit", "2").param("cursor", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("cursor_invalid"));

        verify(useCase, never()).listAllOrders(any(), any(), any(PageRequest.class));
        verify(useCase, never()).listAllOrdersCursor(any(), any(), any(), any(), any(Integer.class));
    }

    @Test
    void exactOrderPageHasNoNextCursor() throws Exception {
        AdminOrderUseCase useCase = mock(AdminOrderUseCase.class);
        when(useCase.listAllOrdersCursor(any(), any(), any(), any(), eq(3)))
                .thenReturn(List.of(order("order-1", NOW.minusSeconds(1)), order("order-2", NOW.minusSeconds(2))));

        mvc(useCase, new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK), mock(AdminRefundUseCase.class))
                .perform(get("/admin/orders").param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasMore").value(false))
                .andExpect(jsonPath("$.data.nextCursor").doesNotExist());
    }

    @Test
    void expiredOrderCursorReturnsCursorInvalidWithoutCallingEitherPath() throws Exception {
        AdminOrderUseCase useCase = mock(AdminOrderUseCase.class);
        String token = signed("{\"v\":1,\"resource\":\"admin-orders\",\"filterHash\":\""
                + sha256("\u0000") + "\",\"sort\":\"createdAt:desc,id:desc\",\"sortKey\":\"2026-08-07T23:59:00Z\","
                + "\"uniqueId\":\"order-1\",\"expiresAt\":\"2026-08-07T23:00:00Z\"}");
        mvc(useCase, new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK), mock(AdminRefundUseCase.class))
                .perform(get("/admin/orders").param("limit", "2").param("cursor", token))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("cursor_invalid"));
        verify(useCase, never()).listAllOrders(any(), any(), any(PageRequest.class));
        verify(useCase, never()).listAllOrdersCursor(any(), any(), any(), any(), any(Integer.class));
    }

    @Test
    void equalOrderTimestampsAreReturnedOnceAcrossCursorTraversal() throws Exception {
        AdminOrderUseCase useCase = mock(AdminOrderUseCase.class);
        OrderSummaryProjection first = order("order-2", NOW.minusSeconds(1));
        OrderSummaryProjection second = order("order-1", NOW.minusSeconds(1));
        when(useCase.listAllOrdersCursor(any(), any(), eq(null), eq(null), eq(2)))
                .thenReturn(List.of(first, second));
        when(useCase.listAllOrdersCursor(any(), any(), eq(NOW.minusSeconds(1)), eq("order-2"), eq(2)))
                .thenReturn(List.of(second));

        MockMvc mvc = mvc(useCase, new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK), mock(AdminRefundUseCase.class));
        String next = mvc.perform(get("/admin/orders").param("limit", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].orderId").value("order-2"))
                .andExpect(jsonPath("$.data.hasMore").value(true))
                .andReturn().getResponse().getContentAsString();
        String token = new com.fasterxml.jackson.databind.ObjectMapper().readTree(next).at("/data/nextCursor").asText();
        mvc.perform(get("/admin/orders").param("limit", "1").param("cursor", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].orderId").value("order-1"))
                .andExpect(jsonPath("$.data.items[0].orderId").value(org.hamcrest.Matchers.not("order-2")));
    }

    @Test
    void invalidDisputeCursorDoesNotInvokeLegacyArrayPath() throws Exception {
        ListOpenDisputesUseCase useCase = mock(ListOpenDisputesUseCase.class);
        String token = signed("{\"v\":1,\"resource\":\"admin-disputes-open\",\"filterHash\":\""
                + sha256("") + "\",\"sort\":\"createdAt:desc,disputeId:desc\",\"sortKey\":\"bad\","
                + "\"uniqueId\":\"bad-id\",\"expiresAt\":\"2026-08-08T01:00:00Z\"}");
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminDisputeController(
                        mock(DisputeUseCase.class), useCase,
                        new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK)))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        mvc.perform(get("/admin/disputes/open").param("limit", "2").param("cursor", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("cursor_invalid"));
        verify(useCase, never()).listOpenEnriched(any());
        verify(useCase, never()).listOpenEnrichedCursor(any(), any(), any(), any(Integer.class));
    }

    @Test
    void expiredDisputeCursorReturnsCursorInvalidWithoutCallingEitherPath() throws Exception {
        ListOpenDisputesUseCase useCase = mock(ListOpenDisputesUseCase.class);
        String token = signed("{\"v\":1,\"resource\":\"admin-disputes-open\",\"filterHash\":\""
                + sha256("") + "\",\"sort\":\"createdAt:desc,disputeId:desc\",\"sortKey\":\"2026-08-07T23:59:00Z\","
                + "\"uniqueId\":\"00000000-0000-0000-0000-000000000001\",\"expiresAt\":\"2026-08-07T23:00:00Z\"}");
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminDisputeController(mock(DisputeUseCase.class), useCase,
                        new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK)))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver()).setControllerAdvice(new ApiExceptionHandler()).build();
        mvc.perform(get("/admin/disputes/open").param("limit", "2").param("cursor", token))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("cursor_invalid"));
        verify(useCase, never()).listOpenEnriched(any());
        verify(useCase, never()).listOpenEnrichedCursor(any(), any(), any(), any(Integer.class));
    }

    @Test
    void disputeCursorTraversalReturnsExactRowsWithoutDuplicateOrOmission() throws Exception {
        ListOpenDisputesUseCase useCase = mock(ListOpenDisputesUseCase.class);
        UUID firstId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID secondId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        Dispute firstDispute = new Dispute(firstId, "return-1", "wrong item", null);
        Dispute secondDispute = new Dispute(secondId, "return-2", "wrong color", null);
        EnrichedDispute first = new EnrichedDispute(firstDispute, "order-1", "ORD-1", "buyer-1", null,
                "seller-1", null, NOW.minusSeconds(1));
        EnrichedDispute second = new EnrichedDispute(secondDispute, "order-2", "ORD-2", "buyer-2", null,
                "seller-2", null, NOW.minusSeconds(1));
        when(useCase.listOpenEnrichedCursor(eq(null), eq(null), eq(null), eq(2)))
                .thenReturn(new com.vnshop.orderservice.application.DisputeCursorResult(List.of(first), true,
                        NOW.minusSeconds(1), firstId));
        when(useCase.listOpenEnrichedCursor(eq(null), eq(NOW.minusSeconds(1)), eq(firstId), eq(2)))
                .thenReturn(new com.vnshop.orderservice.application.DisputeCursorResult(List.of(second), false,
                        NOW.minusSeconds(1), secondId));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminDisputeController(mock(DisputeUseCase.class), useCase,
                        new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK)))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver()).setControllerAdvice(new ApiExceptionHandler()).build();

        String firstPage = mvc.perform(get("/admin/disputes/open").param("limit", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].disputeId").value(firstId.toString()))
                .andExpect(jsonPath("$.data.hasMore").value(true)).andReturn().getResponse().getContentAsString();
        String token = new com.fasterxml.jackson.databind.ObjectMapper().readTree(firstPage).at("/data/nextCursor").asText();
        mvc.perform(get("/admin/disputes/open").param("limit", "2").param("cursor", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].disputeId").value(secondId.toString()))
                .andExpect(jsonPath("$.data.items[0].disputeId").value(org.hamcrest.Matchers.not(firstId.toString())));
    }

    @Test
    void disputeWithoutCursorOrLimitUsesLegacyArrayCompatibilityPath() throws Exception {
        ListOpenDisputesUseCase useCase = mock(ListOpenDisputesUseCase.class);
        when(useCase.listOpenEnriched("wrong")).thenReturn(List.of());
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminDisputeController(
                        mock(DisputeUseCase.class), useCase,
                        new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK)))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        mvc.perform(get("/admin/disputes/open").param("q", "wrong"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
        verify(useCase).listOpenEnriched("wrong");
    }

    @Test
    void disputesUseLimitPlusOneAndBoundedEnrichment() throws Exception {
        ListOpenDisputesUseCase useCase = mock(ListOpenDisputesUseCase.class);
        Dispute dispute = new Dispute(java.util.UUID.randomUUID(), java.util.UUID.randomUUID().toString(), "wrong item", null);
        EnrichedDispute first = new EnrichedDispute(dispute, "order-1", "ORD-1", "buyer-1", null, "seller-1", null,
                NOW.minusSeconds(1));
        when(useCase.listOpenEnrichedCursor(eq("wrong"), eq(null), eq(null), eq(2)))
                .thenReturn(new com.vnshop.orderservice.application.DisputeCursorResult(List.of(first, first), true,
                        NOW.minusSeconds(2), dispute.disputeId()));

        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminDisputeController(
                        mock(DisputeUseCase.class), useCase,
                        new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK)))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        mvc.perform(get("/admin/disputes/open").param("limit", "2").param("q", "wrong"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.hasMore").value(true));
    }

    private static MockMvc mvc(AdminOrderUseCase useCase, AdminCursorCodec codec,
            com.vnshop.orderservice.application.AdminRefundUseCase refunds) {
        return MockMvcBuilders.standaloneSetup(new AdminOrderController(useCase, refunds, codec))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private static OrderSummaryProjection order(String id, Instant createdAt) {
        return new OrderSummaryProjection(id, "ORD-" + id, "buyer-1", "seller-1", "PENDING",
                BigDecimal.TEN, 1, createdAt, createdAt);
    }

    private static String sha256(String value) {
        try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private static String signed(String payload) {
        try {
            byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("test-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) + "."
                    + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(bytes));
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }
}
