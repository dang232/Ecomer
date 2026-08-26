package com.vnshop.paymentservice.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.application.ProcessPaymentCommand;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PaymentControllerHeaderTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private ProcessPaymentUseCase processPaymentUseCase;
    private PaymentController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        processPaymentUseCase = mock(ProcessPaymentUseCase.class);
        Payment stub = new Payment(UUID.randomUUID(), "ORDER-1", "BUYER-1",
                new BigDecimal("100000.00"), PaymentMethod.VNPAY, PaymentStatus.PENDING, "TXN-1",
                Instant.parse("2026-05-17T10:00:00Z"));
        when(processPaymentUseCase.process(any())).thenReturn(stub);

        // Pt12: PaymentController now reads the buyer principal from the JWT
        // via JwtPrincipalUtil.currentUserId(). Stand up a fake JWT in the
        // SecurityContext so MockMvc requests have a principal to read.
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("sub", "BUYER-1")
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(jwt, "test-token"));

        controller = new PaymentController(
                processPaymentUseCase,
                mock(GetPaymentStatusUseCase.class),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                mock(com.vnshop.paymentservice.application.PaymentPromotionService.class),
                mock(com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort.class),
                mock(com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore.class),
                mock(com.vnshop.paymentservice.application.ProviderInitializationService.class),
                mock(com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackEventStore.class)
        );
        ReflectionTestUtils.setField(controller, "deferredGatewayAEnabled", true);
        ReflectionTestUtils.setField(controller, "deferredGatewayBEnabled", true);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void forwardsIdempotencyKeyHeaderToUseCase() throws Exception {
        String body = mapper.writeValueAsString(new PaymentRequest("ORDER-1"));

        mockMvc.perform(post("/payment/vnpay/create")
                        .contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "abc-123")
                        .content(body))
                .andExpect(status().isOk());

        ArgumentCaptor<ProcessPaymentCommand> captor = ArgumentCaptor.forClass(ProcessPaymentCommand.class);
        verify(processPaymentUseCase).process(captor.capture());
        assertThat(captor.getValue().idempotencyKey()).isEqualTo("abc-123");
        assertThat(captor.getValue().method()).isEqualTo(PaymentMethodInput.VNPAY);
    }

    @Test
    void leavesIdempotencyKeyNullWhenHeaderMissing() throws Exception {
        String body = mapper.writeValueAsString(new PaymentRequest("ORDER-2"));

        mockMvc.perform(post("/payment/momo/create")
                        .contentType(APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        ArgumentCaptor<ProcessPaymentCommand> captor = ArgumentCaptor.forClass(ProcessPaymentCommand.class);
        verify(processPaymentUseCase).process(captor.capture());
        assertThat(captor.getValue().idempotencyKey()).isNull();
        assertThat(captor.getValue().method()).isEqualTo(PaymentMethodInput.MOMO);
    }

    @Test
    void forwardsHeaderForCodConfirm() throws Exception {
        String body = mapper.writeValueAsString(new PaymentRequest("ORDER-3"));

        mockMvc.perform(post("/payment/cod/confirm")
                        .contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "cod-key-9")
                        .content(body))
                .andExpect(status().isOk());

        ArgumentCaptor<ProcessPaymentCommand> captor = ArgumentCaptor.forClass(ProcessPaymentCommand.class);
        verify(processPaymentUseCase).process(captor.capture());
        assertThat(captor.getValue().idempotencyKey()).isEqualTo("cod-key-9");
        assertThat(captor.getValue().method()).isEqualTo(PaymentMethodInput.COD);
    }

    @Test
    void rejectsDisabledDeferredGatewayABeforePaymentProcessing() {
        ReflectionTestUtils.setField(controller, "deferredGatewayAEnabled", false);

        assertThatThrownBy(() -> controller.createVnpay(
                "key-4", new PaymentRequest("ORDER-4")))
                .isInstanceOf(com.vnshop.paymentservice.application.UnsupportedPaymentMethodException.class)
                .hasMessage("deferred gateway A gateway is not enabled");
    }

    @Test
    void rejectsDisabledDeferredGatewayBBeforePaymentProcessing() {
        ReflectionTestUtils.setField(controller, "deferredGatewayBEnabled", false);

        assertThatThrownBy(() -> controller.createMomo(
                "key-5", new PaymentRequest("ORDER-5")))
                .isInstanceOf(com.vnshop.paymentservice.application.UnsupportedPaymentMethodException.class)
                .hasMessage("deferred gateway B gateway is not enabled");
    }

}
