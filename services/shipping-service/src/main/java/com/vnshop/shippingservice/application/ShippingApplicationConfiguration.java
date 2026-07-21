package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ShippingApplicationConfiguration {
    @Bean
    ShippingRateCalculator shippingRateCalculator(CarrierGatewayPort carrierGateway) {
        return new ShippingRateCalculator(carrierGateway);
    }

    @Bean
    GetTrackingUseCase getTrackingUseCase(CarrierGatewayPort carrierGateway) {
        return new GetTrackingUseCase(carrierGateway);
    }

    @Bean
    QuoteShippingOptionsUseCase quoteShippingOptionsUseCase(CarrierGatewayPort carrierGateway) {
        return new QuoteShippingOptionsUseCase(carrierGateway);
    }

}
