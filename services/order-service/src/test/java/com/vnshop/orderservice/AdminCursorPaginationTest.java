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
}
