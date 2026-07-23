package com.vnshop.shippingservice.infrastructure.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.application.ReceiveCarrierWebhookUseCase;
import com.vnshop.shippingservice.infrastructure.carrier.GhnProperties;
import com.vnshop.shippingservice.infrastructure.carrier.GhtkProperties;
import com.vnshop.shippingservice.infrastructure.config.WebhookSecurityProperties;
import com.vnshop.shippingservice.infrastructure.web.GhnWebhookController;
import com.vnshop.shippingservice.infrastructure.web.GhtkWebhookController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.filter.DelegatingFilterProxy;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitConfig(WebhookSecurityMockMvcTest.TestConfig.class)
@WebAppConfiguration
class WebhookSecurityMockMvcTest {

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private ReceiveCarrierWebhookUseCase receiveWebhook;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(new DelegatingFilterProxy("springSecurityFilterChain", webApplicationContext))
                .build();
        clearInvocations(receiveWebhook);
    }

    @Test
    void ghnWebhookUsesTheRealValidatorAndIsPermittedBySecurityFilterChain() throws Exception {
        mockMvc.perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GHN-Token", "ghn-webhook-token")
                        .content("{\"OrderCode\":\"GHN-1\",\"Status\":\"Delivered\",\"StatusCode\":\"8\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));

        verify(receiveWebhook).receive(any());
    }

    @Test
    void ghtkWebhookUsesTheRealValidatorAndIsPermittedBySecurityFilterChain() throws Exception {
        String updatedAt = "2026-07-21T10:30:00Z";
        mockMvc.perform(post("/webhooks/ghtk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GHTK-Signature", hmac("GHTK-1delivering" + updatedAt, "ghtk-webhook-token"))
                        .content("{\"label_id\":\"GHTK-1\",\"status\":\"delivering\",\"updated_at\":\"" + updatedAt + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));

        verify(receiveWebhook).receive(any());
    }

    @Test
    void missingWebhookCredentialsAreRejectedBeforeTheReceiver() throws Exception {
        mockMvc.perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"OrderCode\":\"GHN-1\",\"Status\":\"Delivered\"}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(receiveWebhook);
    }

    @Test
    void unrelatedProtectedRequestStillRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/shipping/private")).andExpect(status().isUnauthorized());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @EnableWebSecurity
    @Import(com.vnshop.shippingservice.infrastructure.config.SecurityConfig.class)
    static class TestConfig {
        @Bean ReceiveCarrierWebhookUseCase receiveWebhook() {
            ReceiveCarrierWebhookUseCase useCase = mock(ReceiveCarrierWebhookUseCase.class);
            when(useCase.receive(any())).thenReturn(ReceiveCarrierWebhookUseCase.Result.ACCEPTED);
            return useCase;
        }
        @Bean GhnWebhookSignatureService ghnWebhookSignatureService() {
            return new GhnWebhookSignatureService(new GhnProperties("https://ghn.test", "token", "123", "2", "ghn-webhook-token"),
                    new WebhookSecurityProperties(false), new StandardEnvironment());
        }
        @Bean GhtkWebhookSignatureService ghtkWebhookSignatureService() {
            return new GhtkWebhookSignatureService(new GhtkProperties("https://ghtk.test", "token", "partner", "ghtk-webhook-token"),
                    new WebhookSecurityProperties(false), new StandardEnvironment());
        }
        @Bean GhnWebhookMapper ghnWebhookMapper() { return new GhnWebhookMapper(); }
        @Bean GhtkWebhookMapper ghtkWebhookMapper() { return new GhtkWebhookMapper(); }
        @Bean GhnWebhookController ghnWebhookController(ReceiveCarrierWebhookUseCase useCase, GhnWebhookSignatureService validator, GhnWebhookMapper mapper) {
            return new GhnWebhookController(useCase, validator, mapper);
        }
        @Bean GhtkWebhookController ghtkWebhookController(ReceiveCarrierWebhookUseCase useCase, GhtkWebhookSignatureService validator, GhtkWebhookMapper mapper) {
            return new GhtkWebhookController(useCase, validator, mapper);
        }
        @Bean JwtDecoder jwtDecoder() { return token -> { throw new BadJwtException("not used for permitted webhook tests"); }; }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean MappingJackson2HttpMessageConverter mappingJackson2HttpMessageConverter(ObjectMapper objectMapper) {
            return new MappingJackson2HttpMessageConverter(objectMapper);
        }
    }

    private static String hmac(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return java.util.HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
