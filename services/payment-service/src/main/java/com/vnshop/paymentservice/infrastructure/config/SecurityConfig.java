package com.vnshop.paymentservice.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.infrastructure.gateway.MomoProperties;
import com.vnshop.paymentservice.infrastructure.gateway.MomoSigner;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayProperties;
import com.vnshop.paymentservice.infrastructure.gateway.VnpaySigner;
import com.vnshop.paymentservice.infrastructure.web.WebhookSignatureFilter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Optional;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            WebhookSignatureFilter webhookSignatureFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .addFilterBefore(webhookSignatureFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api-docs", "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/payment/methods").permitAll()
                        // Payment-gateway callbacks (VNPay/MoMo IPN+return, Stripe webhook)
                        // cannot carry a JWT; their integrity is verified by signed payload
                        // + HMAC inside the controller. These specific paths must remain
                        // reachable without an Authorization header. In prod the api-gateway
                        // permits the same paths; in local dev `stripe listen` forwards
                        // straight to this service, so the permit must live here too.
                        .requestMatchers("/payment/*/ipn", "/payment/*/return", "/payment/*/webhook").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .build();
    }

    @Bean
    WebhookSignatureFilter webhookSignatureFilter(Optional<VnpaySigner> vnpaySigner,
                                                  Optional<MomoSigner> momoSigner,
                                                  ObjectMapper objectMapper) {
        return new WebhookSignatureFilter(vnpaySigner, momoSigner, objectMapper);
    }

    /**
     * Expose a {@link VnpaySigner} bean only when VNPay is enabled so the
     * {@link WebhookSignatureFilter} can verify IPN signatures without
     * depending directly on {@link com.vnshop.paymentservice.infrastructure.gateway.VnpayGateway}.
     */
    @Bean
    @ConditionalOnProperty(name = "payment.vnpay.enabled", havingValue = "true")
    VnpaySigner vnpaySigner(VnpayProperties properties) {
        return new VnpaySigner(properties.hashSecret());
    }

    /**
     * Expose a {@link MomoSigner} bean only when MoMo is enabled.
     */
    @Bean
    @ConditionalOnProperty(name = "payment.momo.enabled", havingValue = "true")
    MomoSigner momoSigner(MomoProperties properties) {
        return new MomoSigner(properties.secretKey());
    }
}
