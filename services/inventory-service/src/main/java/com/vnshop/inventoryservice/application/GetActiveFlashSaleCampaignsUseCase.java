package com.vnshop.inventoryservice.application;

import com.vnshop.inventoryservice.domain.FlashSaleCampaign;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleCampaignPort;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleReservationPort;
import java.time.Clock;
import java.util.List;
import java.util.Objects;

/**
 * Returns currently active flash-sale campaigns, joined with live remaining
 * stock from the Redis-backed reservation port. The reservation port returns
 * 0 when the stock key has not been seeded yet, which the FE will render as
 * "sold out" — that's the right behaviour because no inventory means no
 * orderable units.
 */
public class GetActiveFlashSaleCampaignsUseCase {
    private final FlashSaleCampaignPort campaignPort;
    private final FlashSaleReservationPort reservationPort;
    private final Clock clock;

    public GetActiveFlashSaleCampaignsUseCase(FlashSaleCampaignPort campaignPort,
                                              FlashSaleReservationPort reservationPort) {
        this(campaignPort, reservationPort, Clock.systemUTC());
    }

    GetActiveFlashSaleCampaignsUseCase(FlashSaleCampaignPort campaignPort,
                                       FlashSaleReservationPort reservationPort,
                                       Clock clock) {
        this.campaignPort = Objects.requireNonNull(campaignPort, "campaignPort");
        this.reservationPort = Objects.requireNonNull(reservationPort, "reservationPort");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public List<ActiveFlashSaleCampaignView> getActive() {
        return campaignPort.findActiveAt(clock.instant()).stream()
                .map(this::toView)
                .toList();
    }

    private ActiveFlashSaleCampaignView toView(FlashSaleCampaign campaign) {
        long remaining = reservationPort.getStock(campaign.productId());
        return new ActiveFlashSaleCampaignView(
                campaign.id().toString(),
                campaign.productId(),
                campaign.originalPrice(),
                campaign.salePrice(),
                campaign.stockTotal(),
                remaining,
                campaign.endsAt().toString(),
                campaign.name(),
                campaign.shopName(),
                campaign.isShopOfficial(),
                campaign.isShopPreferred(),
                campaign.rawDiscount(),
                campaign.discount(),
                campaign.imageHash());
    }
}
