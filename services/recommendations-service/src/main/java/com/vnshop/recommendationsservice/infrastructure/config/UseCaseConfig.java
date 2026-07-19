package com.vnshop.recommendationsservice.infrastructure.config;

import com.vnshop.recommendationsservice.application.CoPurchasePort;
import com.vnshop.recommendationsservice.application.FrequentlyBoughtTogetherUseCase;
import com.vnshop.recommendationsservice.application.ProductServicePort;
import com.vnshop.recommendationsservice.application.YouMayAlsoLikeUseCase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class UseCaseConfig {

    @Bean
    FrequentlyBoughtTogetherUseCase frequentlyBoughtTogetherUseCase(
            CoPurchasePort coPurchasePort,
            ProductServicePort productServicePort
    ) {
        return new FrequentlyBoughtTogetherUseCase(coPurchasePort, productServicePort);
    }

    @Bean
    YouMayAlsoLikeUseCase youMayAlsoLikeUseCase(
            ProductServicePort productServicePort,
            @Value("${vnshop.recommendations.price-proximity-percent:30}") int priceProximityPercent,
            @Value("${vnshop.recommendations.you-may-also-like-candidate-pool:100}") int candidatePool
    ) {
        return new YouMayAlsoLikeUseCase(productServicePort, priceProximityPercent, candidatePool);
    }

    @Bean
    RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
