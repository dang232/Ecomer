package com.vnshop.shippingservice.infrastructure.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.application.ReceiveCarrierWebhookUseCase;
import com.vnshop.shippingservice.infrastructure.web.GhnWebhookController;
import com.vnshop.shippingservice.infrastructure.web.GhtkWebhookController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitConfig(WebhookSecurityMockMvcTest.TestConfig.class)
@WebAppConfiguration
class WebhookSecurityMockMvcTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ReceiveCarrierWebhookUseCase receiveWebhook;

    @Autowired
    private GhnWebhookSignatureService ghnSignatureService;

    @Autowired
    private GhtkWebhookSignatureService ghtkSignatureService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(new DelegatingFilterProxy("springSecurityFilterChain", webApplicationContext))
                .build();
        clearInvocations(receiveWebhook);
    }

    @Test
    void ghnWebhook_isPermittedBySecurityFilterChain() throws Exception {
        when(ghnSignatureService.isValid(any(), any(), any())).thenReturn(true);

        mockMvc.perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"OrderCode\":\"GHN-1\",\"Status\":\"Delivered\",\"StatusCode\":\"8\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        verify(receiveWebhook).receive(any());
    }

    @Test
    void ghtkWebhook_isPermittedBySecurityFilterChain() throws Exception {
        when(ghtkSignatureService.isValid(any(), any())).thenReturn(true);

        mockMvc.perform(post("/webhooks/ghtk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label_id\":\"GHTK-1\",\"status\":\"delivering\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        verify(receiveWebhook).receive(any());
    }

    @Test
    void unrelatedProtectedRequest_stillRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/shipping/private"))
                .andExpect(status().isUnauthorized());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @EnableWebSecurity
    @Import(com.vnshop.shippingservice.infrastructure.config.SecurityConfig.class)
    static class TestConfig {
        @Bean
        ReceiveCarrierWebhookUseCase receiveWebhook() {
            ReceiveCarrierWebhookUseCase useCase = mock(ReceiveCarrierWebhookUseCase.class);
            when(useCase.receive(any())).thenReturn(ReceiveCarrierWebhookUseCase.Result.ACCEPTED);
            return useCase;
        }

        @Bean
        GhnWebhookSignatureService ghnSignatureService() {
            return mock(GhnWebhookSignatureService.class);
        }

        @Bean
        GhtkWebhookSignatureService ghtkSignatureService() {
            return mock(GhtkWebhookSignatureService.class);
        }

        @Bean
        GhnWebhookMapper ghnWebhookMapper() {
            return new GhnWebhookMapper();
        }

        @Bean
        GhtkWebhookMapper ghtkWebhookMapper() {
            return new GhtkWebhookMapper();
        }

        @Bean
        GhnWebhookController ghnWebhookController(ReceiveCarrierWebhookUseCase receiveWebhook,
                                                    GhnWebhookSignatureService signatureService,
                                                    GhnWebhookMapper mapper) {
            return new GhnWebhookController(receiveWebhook, signatureService, mapper);
        }

        @Bean
        GhtkWebhookController ghtkWebhookController(ReceiveCarrierWebhookUseCase receiveWebhook,
                                                      GhtkWebhookSignatureService signatureService,
                                                      GhtkWebhookMapper mapper) {
            return new GhtkWebhookController(receiveWebhook, signatureService, mapper);
        }

        @Bean
        JwtDecoder jwtDecoder() {
            return token -> {
                throw new BadJwtException("not used for permitted webhook tests");
            };
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        MappingJackson2HttpMessageConverter mappingJackson2HttpMessageConverter(ObjectMapper objectMapper) {
            return new MappingJackson2HttpMessageConverter(objectMapper);
        }
    }
}
