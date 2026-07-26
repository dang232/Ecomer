package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.port.out.SellerStatsPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ListPublicSellersUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private SellerStatsPort sellerStatsPort;

    private ListPublicSellersUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new ListPublicSellersUseCase(userRepositoryPort, sellerStatsPort);
    }

    private SellerProfile seller(String id, String shopName) {
        return new SellerProfile(
                id, shopName, "Bank", null,
                true, Tier.STANDARD, false,
                null, null, null, Instant.now(), null
        );
    }

    @Test
    void list_pagination_returnsCorrectPage() {
        List<SellerProfile> page0 = List.of(seller("s1", "Shop A"), seller("s2", "Shop B"));
        when(userRepositoryPort.findApprovedSellers(0, 2)).thenReturn(page0);
        when(userRepositoryPort.countApprovedSellers()).thenReturn(5L);
        Map<String, SellerStatsPort.SellerStats> emptyStats = new HashMap<>();
        emptyStats.put("s1", SellerStatsPort.SellerStats.empty());
        emptyStats.put("s2", SellerStatsPort.SellerStats.empty());
        when(sellerStatsPort.sellerStatsBatch(any())).thenReturn(emptyStats);
        when(sellerStatsPort.productCountBatch(any())).thenReturn(Map.of("s1", 0L, "s2", 0L));

        PublicSellersPage result = useCase.list(0, 2);

        assertThat(result.content()).hasSize(2);
        assertThat(result.page()).isZero();
        assertThat(result.size()).isEqualTo(2);
        assertThat(result.totalElements()).isEqualTo(5L);
        assertThat(result.totalPages()).isEqualTo(3); // ceil(5/2)
    }

    @Test
    void list_sizeCappedAt50() {
        when(userRepositoryPort.findApprovedSellers(0, 50)).thenReturn(List.of());
        when(userRepositoryPort.countApprovedSellers()).thenReturn(0L);

        PublicSellersPage result = useCase.list(0, 200);

        assertThat(result.size()).isEqualTo(50);
    }

    @Test
    void list_onlyApprovedFilter_delegatesToRepository() {
        when(userRepositoryPort.findApprovedSellers(eq(2), eq(10))).thenReturn(List.of());
        when(userRepositoryPort.countApprovedSellers()).thenReturn(25L);

        PublicSellersPage result = useCase.list(2, 10);

        assertThat(result.page()).isEqualTo(2);
        assertThat(result.size()).isEqualTo(10);
        assertThat(result.totalElements()).isEqualTo(25L);
        assertThat(result.totalPages()).isEqualTo(3); // ceil(25/10)
    }

    @Test
    void list_sizeZero_rejected() {
        assertThatThrownBy(() -> useCase.list(0, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void list_negativePage_rejected() {
        assertThatThrownBy(() -> useCase.list(-1, 10))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void list_degradedStats_fillsZeroDefaultsAndRendersAllSellers() {
        when(userRepositoryPort.findApprovedSellers(0, 1)).thenReturn(List.of(seller("s1", "Shop A")));
        when(userRepositoryPort.countApprovedSellers()).thenReturn(1L);
        // Simulate downstream returning an empty map (cb fallback after total failure
        // would still fill defaults, but verify the use case is defensive too).
        when(sellerStatsPort.sellerStatsBatch(any())).thenReturn(Map.of());
        when(sellerStatsPort.productCountBatch(any())).thenReturn(Map.of());

        PublicSellersPage result = useCase.list(0, 1);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).ratingAvg()).isNull();
        assertThat(result.content().get(0).ratingCount()).isZero();
        assertThat(result.content().get(0).totalProducts()).isZero();
    }

    @Test
    void list_useBatchEndpoints_singleRoundTripPerPage() {
        List<SellerProfile> page = List.of(seller("s1", "A"), seller("s2", "B"), seller("s3", "C"));
        when(userRepositoryPort.findApprovedSellers(0, 3)).thenReturn(page);
        when(userRepositoryPort.countApprovedSellers()).thenReturn(3L);
        Map<String, SellerStatsPort.SellerStats> stats = Map.of(
                "s1", new SellerStatsPort.SellerStats(4.5, 10),
                "s2", new SellerStatsPort.SellerStats(null, 0),
                "s3", new SellerStatsPort.SellerStats(3.2, 1)
        );
        when(sellerStatsPort.sellerStatsBatch(Set.of("s1", "s2", "s3"))).thenReturn(stats);
        when(sellerStatsPort.productCountBatch(Set.of("s1", "s2", "s3"))).thenReturn(Map.of("s1", 12L, "s2", 0L, "s3", 4L));

        PublicSellersPage result = useCase.list(0, 3);

        assertThat(result.content()).hasSize(3);
        assertThat(result.content().get(0).ratingAvg()).isEqualTo(4.5);
        assertThat(result.content().get(0).totalProducts()).isEqualTo(12L);
        assertThat(result.content().get(1).ratingAvg()).isNull();
        assertThat(result.content().get(2).ratingCount()).isEqualTo(1L);
    }
}
