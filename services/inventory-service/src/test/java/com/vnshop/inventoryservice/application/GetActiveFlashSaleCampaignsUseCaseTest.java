package com.vnshop.inventoryservice.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.inventoryservice.domain.FlashSaleCampaign;
import com.vnshop.inventoryservice.domain.FlashSaleReservation;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleCampaignPort;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleReservationPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetActiveFlashSaleCampaignsUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-05-17T10:00:00Z");
    private final Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void returnsCampaignsWhoseWindowIncludesNow() {
        FlashSaleCampaign live = campaign("p-live", NOW.minusSeconds(60), NOW.plusSeconds(3600));
        FlashSaleCampaign anotherLive = campaign("p-also-live", NOW.minusSeconds(120), NOW.plusSeconds(1800));
        StubCampaignPort campaigns = new StubCampaignPort(List.of(live, anotherLive));
        StubReservationPort stock = new StubReservationPort(Map.of("p-live", 12L, "p-also-live", 7L));

        GetActiveFlashSaleCampaignsUseCase useCase =
                new GetActiveFlashSaleCampaignsUseCase(campaigns, stock, fixedClock);

        List<ActiveFlashSaleCampaignView> result = useCase.getActive();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(ActiveFlashSaleCampaignView::productId)
                .containsExactly("p-live", "p-also-live");
        ActiveFlashSaleCampaignView first = result.get(0);
        assertThat(first.stockRemaining()).isEqualTo(12L);
        assertThat(first.endsAt()).isEqualTo(live.endsAt().toString());
        // new enrichment fields
        assertThat(first.name()).isEqualTo("Test Product");
        assertThat(first.shopName()).isEqualTo("Test Shop");
        assertThat(first.isShopOfficial()).isFalse();
        assertThat(first.isShopPreferred()).isFalse();
        assertThat(first.rawDiscount()).isEqualTo(30);
        assertThat(first.discount()).isEqualTo("30%");
        assertThat(first.imageHash()).isNull();
        assertThat(campaigns.lastQueryAt).isEqualTo(NOW);
    }

    @Test
    void emptyListWhenPortReturnsNothing() {
        GetActiveFlashSaleCampaignsUseCase useCase = new GetActiveFlashSaleCampaignsUseCase(
                new StubCampaignPort(List.of()), new StubReservationPort(Map.of()), fixedClock);

        assertThat(useCase.getActive()).isEmpty();
    }

    @Test
    void portFiltersOutCampaignsThatHaveNotStartedOrAlreadyEnded() {
        FlashSaleCampaign notStarted = campaign("p-future", NOW.plusSeconds(3600), NOW.plusSeconds(7200));
        FlashSaleCampaign expired = campaign("p-past", NOW.minusSeconds(7200), NOW.minusSeconds(3600));
        FlashSaleCampaign live = campaign("p-now", NOW.minusSeconds(60), NOW.plusSeconds(60));
        StubCampaignPort campaigns = new StubCampaignPort(List.of(notStarted, expired, live));

        GetActiveFlashSaleCampaignsUseCase useCase = new GetActiveFlashSaleCampaignsUseCase(
                campaigns, new StubReservationPort(Map.of("p-now", 5L)), fixedClock);

        List<ActiveFlashSaleCampaignView> result = useCase.getActive();

        assertThat(result).extracting(ActiveFlashSaleCampaignView::productId).containsExactly("p-now");
    }

    @Test
    void stockRemainingFallsBackToZeroWhenRedisHasNoEntry() {
        FlashSaleCampaign live = campaign("p-no-stock", NOW.minusSeconds(60), NOW.plusSeconds(3600));
        StubCampaignPort campaigns = new StubCampaignPort(List.of(live));
        StubReservationPort stock = new StubReservationPort(Map.of()); // no entry -> 0

        GetActiveFlashSaleCampaignsUseCase useCase =
                new GetActiveFlashSaleCampaignsUseCase(campaigns, stock, fixedClock);

        List<ActiveFlashSaleCampaignView> result = useCase.getActive();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).stockRemaining()).isZero();
    }

    private static FlashSaleCampaign campaign(String productId, Instant startsAt, Instant endsAt) {
        return new FlashSaleCampaign(
                UUID.randomUUID(),
                productId,
                new BigDecimal("100000"),
                new BigDecimal("70000"),
                100,
                startsAt,
                endsAt,
                true,
                "Test Product",
                "Test Shop",
                false,
                false,
                30,
                "30%",
                null);
    }

    private static final class StubCampaignPort implements FlashSaleCampaignPort {
        private final List<FlashSaleCampaign> rows;
        Instant lastQueryAt;

        StubCampaignPort(List<FlashSaleCampaign> rows) {
            this.rows = rows;
        }

        @Override
        public List<FlashSaleCampaign> findActiveAt(Instant now) {
            this.lastQueryAt = now;
            return rows.stream()
                    .filter(c -> c.active() && !c.startsAt().isAfter(now) && c.endsAt().isAfter(now))
                    .toList();
        }
    }

    private static final class StubReservationPort implements FlashSaleReservationPort {
        private final Map<String, Long> stockByProduct;

        StubReservationPort(Map<String, Long> stockByProduct) {
            this.stockByProduct = new HashMap<>(stockByProduct);
        }

        @Override
        public boolean reserve(String productId, String buyerId, int quantity, UUID reservationId) {
            return false;
        }

        @Override
        public void save(FlashSaleReservation reservation) {
        }

        @Override
        public Optional<FlashSaleReservation> findById(UUID reservationId) {
            return Optional.empty();
        }

        @Override
        public void release(UUID reservationId) {
        }

        @Override
        public long getStock(String productId) {
            return stockByProduct.getOrDefault(productId, 0L);
        }

        @Override
        public boolean hasActiveReservation(String productId, String buyerId) {
            return false;
        }
    }
}
