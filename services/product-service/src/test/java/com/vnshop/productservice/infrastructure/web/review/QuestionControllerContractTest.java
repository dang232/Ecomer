package com.vnshop.productservice.infrastructure.web.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.vnshop.productservice.application.review.AnswerQuestionUseCase;
import com.vnshop.productservice.application.review.AskQuestionCommand;
import com.vnshop.productservice.application.review.AskQuestionUseCase;
import com.vnshop.productservice.application.review.GetQuestionsUseCase;
import com.vnshop.productservice.domain.review.ProductQuestion;
import com.vnshop.productservice.infrastructure.web.ApiResponse;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class QuestionControllerContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void askSerializesCanonicalIdInsideTheStandardSuccessEnvelope() throws Exception {
        String productId = "product-1";
        String buyerId = "buyer-1";
        UUID questionId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        ProductQuestion persistedQuestion = new ProductQuestion(
                questionId,
                productId,
                buyerId,
                "Does this include a warranty?",
                null,
                null,
                Instant.parse("2026-08-05T08:00:00Z"));
        AskQuestionUseCase askQuestionUseCase = mock(AskQuestionUseCase.class);
        when(askQuestionUseCase.ask(any(AskQuestionCommand.class))).thenReturn(persistedQuestion);
        QuestionController controller = new QuestionController(
                mock(GetQuestionsUseCase.class),
                askQuestionUseCase,
                mock(AnswerQuestionUseCase.class));
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(buyerId)
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));

        ApiResponse<QuestionResponse> response = controller.ask(
                new AskQuestionRequest(productId, "Does this include a warranty?"));
        JsonNode envelope = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(envelope.path("success").asBoolean()).isTrue();
        assertThat(envelope.path("message").asText()).isEqualTo("Success");
        assertThat(envelope.path("data").path("id").asText()).isEqualTo(questionId.toString());
        assertThat(envelope.path("data").path("productId").asText()).isEqualTo(productId);
        assertThat(envelope.path("data").path("userId").asText()).isEqualTo(buyerId);
        assertThat(envelope.path("data").path("question").asText())
                .isEqualTo("Does this include a warranty?");
        assertThat(envelope.path("data").has("questionId")).isFalse();
        assertThat(envelope.path("data").has("buyerId")).isFalse();
        assertThat(envelope.path("errorCode").isNull()).isTrue();
        assertThat(envelope.path("timestamp").isTextual()).isTrue();
    }
}
