package com.vnshop.inventoryservice.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.inventoryservice.application.GetActiveFlashSaleCampaignsUseCase;
import com.vnshop.inventoryservice.application.ReleaseStockUseCase;
import com.vnshop.inventoryservice.application.ReserveFlashSaleUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleCampaignPort;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleReservationPort;
import com.vnshop.inventoryservice.domain.port.out.InventoryEventPublisherPort;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class UseCaseConfig {

    @Bean
    @ConditionalOnMissingBean
    ObjectMapper objectMapper() {
        return new ObjectMapper().findAndRegisterModules();
    }

    @Bean
    ReserveFlashSaleUseCase reserveFlashSaleUseCase(FlashSaleReservationPort reservationPort) {
        return new ReserveFlashSaleUseCase(reservationPort);
    }

    @Bean
    GetActiveFlashSaleCampaignsUseCase getActiveFlashSaleCampaignsUseCase(
            FlashSaleCampaignPort campaignPort,
            FlashSaleReservationPort reservationPort) {
        return new GetActiveFlashSaleCampaignsUseCase(campaignPort, reservationPort);
    }

    @Bean
    ReserveStockUseCase reserveStockUseCase(StockReservationPort port) {
        return new ReserveStockUseCase(port);
    }

    @Bean
    ReleaseStockUseCase releaseStockUseCase(StockReservationPort port, InventoryEventPublisherPort eventPublisher) {
        return new ReleaseStockUseCase(port, eventPublisher);
    }
}
