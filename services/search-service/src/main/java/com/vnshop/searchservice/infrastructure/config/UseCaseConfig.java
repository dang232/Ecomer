package com.vnshop.searchservice.infrastructure.config;

import com.vnshop.searchservice.application.SearchProductsUseCase;
import com.vnshop.searchservice.application.SearchRepository;
import com.vnshop.searchservice.application.SearchCursorCodec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@Configuration
@EnableConfigurationProperties({SearchCursorProperties.class, SearchFacetProperties.class})
public class UseCaseConfig {
    @Bean
    SearchProductsUseCase searchProductsUseCase(
            SearchRepository searchRepository,
            SearchCursorProperties properties) {
        return new SearchProductsUseCase(searchRepository, new SearchCursorCodec(properties.secret()));
    }
}
