package com.vnshop.userservice.infrastructure.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.userservice.application.AdminUserUseCase;
import com.vnshop.userservice.application.ApproveSellerUseCase;
import com.vnshop.userservice.application.ListPendingSellersUseCase;
import com.vnshop.userservice.application.RejectSellerUseCase;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.port.out.AdminBuyerCursor;
import com.vnshop.userservice.domain.port.out.AdminSellerCursor;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorFilterHash;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AdminCursorPaginationTest {
    private static final Instant NOW = Instant.parse("2026-08-08T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void usersLimitModeTrimsLookaheadAndCarriesRawIdAnchor() throws Exception {
        AdminUserUseCase useCase = mock(AdminUserUseCase.class);
        BuyerProfile first = buyer("User-A", "Alice");
        BuyerProfile second = buyer("User-Z", "Alice");
        when(useCase.searchUsersCursor(eq("alice"), eq(null), eq(2))).thenReturn(List.of(first, second));

        MockMvc mvc = usersMvc(useCase);
        String response = mvc.perform(get("/admin/users").param("q", "alice").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].keycloakId").value("User-A"))
                .andExpect(jsonPath("$.data.hasMore").value(true))
                .andExpect(jsonPath("$.data.sort.field").value("name,keycloakId"))
                .andReturn().getResponse().getContentAsString();

        String token = JSON.readTree(response).at("/data/nextCursor").asText();
        AdminCursorCodec codec = codec();
        AdminCursorCodec.Cursor cursor = codec.decode(token, "admin-users",
                AdminCursorFilterHash.forQuery("alice"), "name:asc,keycloakId:asc");
        when(useCase.searchUsersCursor(eq("alice"), eq(new AdminBuyerCursor("alice", "User-A")), eq(2)))
                .thenReturn(List.of(second));
        mvc.perform(get("/admin/users").param("q", "alice").param("limit", "1").param("cursor", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].keycloakId").value("User-Z"));
        verify(useCase).searchUsersCursor(eq("alice"), eq(null), eq(2));
        verify(useCase).searchUsersCursor(eq("alice"), eq(new AdminBuyerCursor("alice", "User-A")), eq(2));
        org.assertj.core.api.Assertions.assertThat(cursor.uniqueId()).isEqualTo("User-A");
    }

    @Test
    void usersWithoutCursorOrLimitKeepLegacyPagePath() throws Exception {
        AdminUserUseCase useCase = mock(AdminUserUseCase.class);
        when(useCase.searchUsers(eq("alice"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

        usersMvc(useCase).perform(get("/admin/users").param("q", "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());

        verify(useCase).searchUsers(eq("alice"), any(Pageable.class));
        verify(useCase, never()).searchUsersCursor(any(), any(), any(Integer.class));
    }

    @Test
    void usersRejectInvalidPageSizeWithoutCallingRepository() throws Exception {
        AdminUserUseCase useCase = mock(AdminUserUseCase.class);

        usersMvc(useCase).perform(get("/admin/users").param("limit", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("bad_request"));

        verify(useCase, never()).searchUsersCursor(any(), any(), any(Integer.class));
    }

    @Test
    void sellersUseRawIdForEqualTimestampContinuation() throws Exception {
        ListPendingSellersUseCase useCase = mock(ListPendingSellersUseCase.class);
        SellerProfile first = seller("Seller-Z", NOW.minusSeconds(1));
        SellerProfile second = seller("Seller-A", NOW.minusSeconds(1));
        when(useCase.listPendingCursor(eq(null), eq(null), eq(2))).thenReturn(List.of(first, second));

        MockMvc mvc = sellersMvc(useCase);
        String response = mvc.perform(get("/admin/sellers").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value("Seller-Z"))
                .andExpect(jsonPath("$.data.hasMore").value(true))
                .andExpect(jsonPath("$.data.sort.field").value("createdAt,keycloakId"))
                .andReturn().getResponse().getContentAsString();

        String token = JSON.readTree(response).at("/data/nextCursor").asText();
        AdminCursorCodec.Cursor cursor = codec().decode(token, "admin-sellers",
                AdminCursorFilterHash.forQuery(null), "createdAt:desc,keycloakId:desc");
        when(useCase.listPendingCursor(eq(null), eq(new AdminSellerCursor(NOW.minusSeconds(1), "Seller-Z")), eq(2)))
                .thenReturn(List.of(second));
        mvc.perform(get("/admin/sellers").param("limit", "1").param("cursor", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value("Seller-A"));
        verify(useCase).listPendingCursor(eq(null), eq(null), eq(2));
        verify(useCase).listPendingCursor(eq(null), eq(new AdminSellerCursor(NOW.minusSeconds(1), "Seller-Z")), eq(2));
        org.assertj.core.api.Assertions.assertThat(cursor.uniqueId()).isEqualTo("Seller-Z");
    }

    @Test
    void sellersWithoutCursorOrLimitKeepLegacyListPath() throws Exception {
        ListPendingSellersUseCase useCase = mock(ListPendingSellersUseCase.class);
        when(useCase.listPending("pending")).thenReturn(List.of());

        sellersMvc(useCase).perform(get("/admin/sellers").param("q", "pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        verify(useCase).listPending("pending");
        verify(useCase, never()).listPendingCursor(any(), any(), any(Integer.class));
    }

    @Test
    void sellersRejectCursorFilterMismatchWithoutCallingRepository() throws Exception {
        ListPendingSellersUseCase useCase = mock(ListPendingSellersUseCase.class);
        String token = codec().encode(new AdminCursorCodec.Cursor("admin-sellers", "other-filter",
                "createdAt:desc,keycloakId:desc", NOW.toString(), "Seller-Z", null, null));

        sellersMvc(useCase).perform(get("/admin/sellers").param("q", "pending")
                        .param("limit", "1").param("cursor", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("cursor_scope_mismatch"));

        verify(useCase, never()).listPendingCursor(any(), any(), any(Integer.class));
    }

    private static MockMvc usersMvc(AdminUserUseCase useCase) {
        return MockMvcBuilders.standaloneSetup(new AdminUserController(useCase, codec()))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .setControllerAdvice(new ApiExceptionHandler()).build();
    }

    private static MockMvc sellersMvc(ListPendingSellersUseCase useCase) {
        return MockMvcBuilders.standaloneSetup(new AdminSellerController(useCase,
                        mock(ApproveSellerUseCase.class), mock(RejectSellerUseCase.class), codec()))
                .setControllerAdvice(new ApiExceptionHandler()).build();
    }

    private static AdminCursorCodec codec() {
        return new AdminCursorCodec("test-secret", Duration.ofHours(1), CLOCK);
    }

    private static BuyerProfile buyer(String id, String name) {
        return new BuyerProfile(id, "buyer@example.com", name, null, null, List.of());
    }

    private static SellerProfile seller(String id, Instant createdAt) {
        return new SellerProfile(id, "Shop " + id, "Bank", null, false, Tier.STANDARD, false,
                null, null, null, createdAt, null);
    }
}
