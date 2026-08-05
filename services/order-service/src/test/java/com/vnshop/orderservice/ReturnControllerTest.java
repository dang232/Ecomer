package com.vnshop.orderservice;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vnshop.orderservice.application.ApproveReturnUseCase;
import com.vnshop.orderservice.application.CompleteReturnUseCase;
import com.vnshop.orderservice.application.DisputeUseCase;
import com.vnshop.orderservice.application.ListReturnsUseCase;
import com.vnshop.orderservice.application.RejectReturnUseCase;
import com.vnshop.orderservice.application.RequestReturnUseCase;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.infrastructure.web.ApiExceptionHandler;
import com.vnshop.orderservice.infrastructure.web.ReturnController;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ReturnControllerTest {
    private final ListReturnsUseCase listReturns = mock(ListReturnsUseCase.class);
    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new ReturnController(
                    mock(RequestReturnUseCase.class),
                    mock(ApproveReturnUseCase.class),
                    mock(RejectReturnUseCase.class),
                    mock(CompleteReturnUseCase.class),
                    mock(DisputeUseCase.class),
                    listReturns))
            .setControllerAdvice(new ApiExceptionHandler())
            .build();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sellerQueueUsesTheJwtSellerIdentity() throws Exception {
        Return returnRequest = new Return(
                UUID.randomUUID(), UUID.randomUUID().toString(), 42L, "buyer-1", "Damaged item");
        when(listReturns.listBySellerId("seller-1")).thenReturn(List.of(returnRequest));
        authenticateAsSeller("seller-1");

        mvc.perform(get("/returns/seller"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].returnId").value(returnRequest.returnId().toString()))
                .andExpect(jsonPath("$.data[0].subOrderId").value(42));

        verify(listReturns).listBySellerId("seller-1");
    }

    @Test
    void buyerDetailUsesTheJwtBuyerIdentity() throws Exception {
        UUID returnId = UUID.randomUUID();
        Return returnRequest = new Return(
                returnId, UUID.randomUUID().toString(), 42L, "buyer-1", "Damaged item");
        when(listReturns.findByIdForBuyer(returnId, "buyer-1")).thenReturn(returnRequest);
        authenticateAsBuyer("buyer-1");

        mvc.perform(get("/returns/" + returnId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.returnId").value(returnId.toString()))
                .andExpect(jsonPath("$.data.buyerId").value("buyer-1"));

        verify(listReturns).findByIdForBuyer(returnId, "buyer-1");
    }

    private static void authenticateAsSeller(String sellerId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", sellerId)
                .claim("realm_access", java.util.Map.of("roles", List.of("SELLER")))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static void authenticateAsBuyer(String buyerId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", buyerId)
                .claim("realm_access", java.util.Map.of("roles", List.of("BUYER")))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
