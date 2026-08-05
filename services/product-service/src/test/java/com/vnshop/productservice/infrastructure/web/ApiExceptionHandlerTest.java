package com.vnshop.productservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vnshop.productservice.application.review.CreateReviewCommand;
import com.vnshop.productservice.application.review.CreateReviewUseCase;
import com.vnshop.productservice.application.review.GetProductReviewsUseCase;
import com.vnshop.productservice.application.review.SellerReviewListUseCase;
import com.vnshop.productservice.application.review.SellerReviewSummaryUseCase;
import com.vnshop.productservice.application.review.VoteHelpfulUseCase;
import com.vnshop.productservice.domain.review.ReviewEligibilityException;
import com.vnshop.productservice.infrastructure.web.review.ReviewController;
import java.util.List;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ApiExceptionHandlerTest {
    private static final String BUYER_ID = "buyer-1";

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void postReviewsReturnsForbiddenEnvelopeWhenAuthenticatedBuyerHasNoPurchase() throws Exception {
        CreateReviewUseCase createReviewUseCase = mock(CreateReviewUseCase.class);
        when(createReviewUseCase.create(any(CreateReviewCommand.class)))
                .thenThrow(new ReviewEligibilityException());

        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new ReviewController(
                        createReviewUseCase,
                        mock(GetProductReviewsUseCase.class),
                        mock(VoteHelpfulUseCase.class),
                        mock(SellerReviewSummaryUseCase.class),
                        mock(SellerReviewListUseCase.class)))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        authenticateAsBuyer(BUYER_ID);

        mvc.perform(post("/reviews")
                        .header("Authorization", "Bearer test-token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": "product-1",
                                  "rating": 5,
                                  "comment": "great product"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("review_purchase_required"))
                .andExpect(jsonPath("$.message")
                        .value("You can only review products you have purchased and received"))
                .andExpect(jsonPath("$.data").value(Matchers.nullValue()));

        ArgumentCaptor<CreateReviewCommand> command = ArgumentCaptor.forClass(CreateReviewCommand.class);
        verify(createReviewUseCase).create(command.capture());
        assertThat(command.getValue().buyerId()).isEqualTo(BUYER_ID);
        assertThat(command.getValue().orderId()).isNull();
    }

    private static void authenticateAsBuyer(String buyerId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("sub", buyerId)
                .claim("realm_access", Map.of("roles", List.of("BUYER")))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
