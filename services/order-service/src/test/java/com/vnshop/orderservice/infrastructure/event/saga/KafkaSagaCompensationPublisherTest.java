package com.vnshop.orderservice.infrastructure.event.saga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

class KafkaSagaCompensationPublisherTest {

    @Test
    void paymentRefundPayloadContainsPaymentListenerContractFields() throws Exception {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
        KafkaSagaCompensationPublisher publisher = new KafkaSagaCompensationPublisher(kafka, new ObjectMapper());

        publisher.publishPaymentRefundRequested("order-1", "saga-1",
                "3d1b7f9d-9b2c-4f9a-9d7d-4b3b24f6cf79",
                "3d1b7f9d-9b2c-4f9a-9d7d-4b3b24f6cf79",
                new BigDecimal("125000"), "VND");

        var payloadCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(kafka).send(eq("payment.refund.requested"), eq("order-1"), payloadCaptor.capture());
        JsonNode payload = new ObjectMapper().readTree(payloadCaptor.getValue());
        assertThat(payload.path("orderId").asText()).isEqualTo("order-1");
        assertThat(payload.path("sagaId").asText()).isEqualTo("saga-1");
        assertThat(payload.path("reversalId").asText()).isEqualTo("3d1b7f9d-9b2c-4f9a-9d7d-4b3b24f6cf79");
        assertThat(payload.path("returnId").asText()).isEqualTo("3d1b7f9d-9b2c-4f9a-9d7d-4b3b24f6cf79");
        assertThat(payload.path("amount").asText()).isEqualTo("125000");
        assertThat(payload.path("currency").asText()).isEqualTo("VND");
    }
}
