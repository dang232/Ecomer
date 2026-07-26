package com.vnshop.userservice.infrastructure.featureflag;

import io.getunleash.DefaultUnleash;
import io.getunleash.Unleash;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(UnleashProperties.class)
public class UnleashConfig {

    @Bean
    public Unleash unleash(UnleashProperties properties) {
        var config = io.getunleash.util.UnleashConfig.builder()
                .appName(properties.appName())
                .unleashAPI(properties.apiUrl())
                .apiKey(properties.apiKey())
                .build();
        return new DefaultUnleash(config);
    }
}
