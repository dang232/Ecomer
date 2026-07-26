package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.GetPublicSellerUseCase;
import com.vnshop.userservice.application.ListPublicSellersUseCase;
import com.vnshop.userservice.application.PublicSellerView;
import com.vnshop.userservice.application.PublicSellersPage;
import com.vnshop.userservice.application.RegisterSellerUseCase;
import com.vnshop.userservice.application.ViewSellerProfileUseCase;
import com.vnshop.userservice.domain.SellerNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SellerControllerPublicTest {

    @Mock private RegisterSellerUseCase registerSellerUseCase;
    @Mock private ViewSellerProfileUseCase viewSellerProfileUseCase;
    @Mock private GetPublicSellerUseCase getPublicSellerUseCase;
    @Mock private ListPublicSellersUseCase listPublicSellersUseCase;
    @Mock private com.vnshop.userservice.application.EnrollSellerPayoutDestinationUseCase enrollSellerPayoutDestinationUseCase;
    @Mock private com.vnshop.userservice.application.LookupSellerDestinationUseCase lookupSellerDestinationUseCase;

    private SellerController controller;

    private static final Instant JOINED = Instant.parse("2024-01-15T10:00:00Z");

    @BeforeEach
    void setUp() {
        controller = new SellerController(registerSellerUseCase, viewSellerProfileUseCase,
                getPublicSellerUseCase, listPublicSellersUseCase,
                enrollSellerPayoutDestinationUseCase, lookupSellerDestinationUseCase);
    }

    private PublicSellerView view(String id) {
        return new PublicSellerView(id, "Cool Shop", "desc", "http://logo", "http://banner",
                JOINED, "STANDARD", 4.5, 120L, 35L);
    }

    @Test
    void getById_happyPath_returnsOkResponse() {
        when(getPublicSellerUseCase.view("s1")).thenReturn(view("s1"));

        ApiResponse<PublicSellerResponse> resp = controller.getById("s1");

        assertThat(resp.success()).isTrue();
        assertThat(resp.data().id()).isEqualTo("s1");
        assertThat(resp.data().shopName()).isEqualTo("Cool Shop");
        assertThat(resp.data().ratingAvg()).isEqualTo(4.5);
        assertThat(resp.data().ratingCount()).isEqualTo(120L);
        assertThat(resp.data().totalProducts()).isEqualTo(35L);
    }

    @Test
    void getById_notFound_propagatesException() {
        when(getPublicSellerUseCase.view("missing")).thenThrow(new SellerNotFoundException("missing"));

        assertThatThrownBy(() -> controller.getById("missing"))
                .isInstanceOf(SellerNotFoundException.class);
    }

    @Test
    void list_defaultParams_returnsPage() {
        PublicSellersPage page = new PublicSellersPage(List.of(view("s1")), 0, 20, 1L, 1);
        when(listPublicSellersUseCase.list(0, 20)).thenReturn(page);

        ResponseEntity<ApiResponse<PublicSellersPageResponse>> entity = controller.list(0, 20);

        assertThat(entity.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(entity.getHeaders().getFirst("X-Total-Count")).isEqualTo("1");
        // Single page → no Link header (no prev, no next).
        assertThat(entity.getHeaders().getFirst("Link")).isNull();
        ApiResponse<PublicSellersPageResponse> resp = entity.getBody();
        assertThat(resp).isNotNull();
        assertThat(resp.success()).isTrue();
        assertThat(resp.data().content()).hasSize(1);
        assertThat(resp.data().totalElements()).isEqualTo(1L);
        assertThat(resp.data().totalPages()).isEqualTo(1);
    }

    @Test
    void list_customPageAndSize_passesThrough() {
        PublicSellersPage page = new PublicSellersPage(List.of(), 2, 10, 0L, 0);
        when(listPublicSellersUseCase.list(2, 10)).thenReturn(page);

        ResponseEntity<ApiResponse<PublicSellersPageResponse>> entity = controller.list(2, 10);

        ApiResponse<PublicSellersPageResponse> resp = entity.getBody();
        assertThat(resp).isNotNull();
        assertThat(resp.data().page()).isEqualTo(2);
        assertThat(resp.data().size()).isEqualTo(10);
    }

    @Test
    void list_middlePage_emitsLinkHeaderWithPrevAndNext() {
        PublicSellersPage page = new PublicSellersPage(List.of(view("s1")), 1, 10, 35L, 4);
        when(listPublicSellersUseCase.list(1, 10)).thenReturn(page);

        ResponseEntity<ApiResponse<PublicSellersPageResponse>> entity = controller.list(1, 10);

        String link = entity.getHeaders().getFirst("Link");
        assertThat(link).isNotNull();
        assertThat(link).contains("rel=\"prev\"").contains("rel=\"next\"");
        assertThat(link).contains("page=0").contains("page=2");
        assertThat(entity.getHeaders().getFirst("X-Total-Count")).isEqualTo("35");
    }

    @Test
    void getById_nullRatingAvg_preserved() {
        PublicSellerView v = new PublicSellerView("s2", "Shop", null, null, null,
                JOINED, "STANDARD", null, 0L, 0L);
        when(getPublicSellerUseCase.view("s2")).thenReturn(v);

        ApiResponse<PublicSellerResponse> resp = controller.getById("s2");

        assertThat(resp.data().ratingAvg()).isNull();
    }
}
