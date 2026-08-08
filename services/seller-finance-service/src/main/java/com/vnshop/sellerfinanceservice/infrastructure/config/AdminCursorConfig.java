package com.vnshop.sellerfinanceservice.infrastructure.config;

import com.vnshop.sellerfinanceservice.infrastructure.web.pagination.AdminCursorCodec;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdminCursorConfig {
    @Bean
    public AdminCursorCodec adminCursorCodec(
            @Value("${vnshop.admin-cursor.secret}") String secret,
            @Value("${vnshop.admin-cursor.ttl:PT15M}") Duration ttl,
            Clock clock) {
        return new AdminCursorCodec(secret, ttl, clock);
    }
}
