package com.vnshop.orderservice;

import com.vnshop.orderservice.application.CalculateCheckoutUseCase;
import com.vnshop.orderservice.application.CalculateCheckoutUseCase.CheckoutBreakdown;
import com.vnshop.orderservice.application.shipping.ShippingQuotePort;
import com.vnshop.orderservice.infrastructure.cart.CartUnavailableException;
import com.vnshop.orderservice.infrastructure.web.ApiExceptionHandler;
import com.vnshop.orderservice.infrastructure.web.CheckoutController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CheckoutControllerTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void paymentMethodsReturnsRichCatalogMatchingFeSchema() throws Exception {
        // The FE paymentMethodSchema (fe/src/app/lib/api/endpoints/checkout.ts)
        // expects { code, name, description?, enabled } records, not bare strings.
        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new CheckoutController(
                        mock(CalculateCheckoutUseCase.class),
                        mock(ShippingQuotePort.class)))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        mvc.perform(get("/checkout/payment-methods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(4))
                .andExpect(jsonPath("$.data[0].code").value("COD"))
                .andExpect(jsonPath("$.data[0].name").exists())
                .andExpect(jsonPath("$.data[0].enabled").value(true))
                .andExpect(jsonPath("$.data[1].code").value("VIETQR"))
                .andExpect(jsonPath("$.data[1].enabled").value(true))
                .andExpect(jsonPath("$.data[2].code").value("VN" + "PAY"))
                .andExpect(jsonPath("$.data[2].enabled").value(false))
                .andExpect(jsonPath("$.data[3].code").value("MO" + "MO"))
                .andExpect(jsonPath("$.data[3].enabled").value(false));
    }

    @Test
    void calculateFromCartReturnsBreakdownForAuthenticatedUser() throws Exception {
        CalculateCheckoutUseCase useCase = mock(CalculateCheckoutUseCase.class);
        when(useCase.calculate("user-42")).thenReturn(
                new CheckoutBreakdown(
                        new BigDecimal("450000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("45000"),
                        new BigDecimal("495000")));

        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new CheckoutController(useCase, mock(ShippingQuotePort.class)))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", "user-42")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));

        mvc.perform(post("/checkout/calculate-from-cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.itemsTotal").value(450000))
                .andExpect(jsonPath("$.data.shippingEstimate").value(0))
                .andExpect(jsonPath("$.data.discount").value(0))
                .andExpect(jsonPath("$.data.taxTotal").value(45000))
                .andExpect(jsonPath("$.data.finalAmount").value(495000));
    }

    @Test
    void calculateFromCartReturns503WhenCartServiceIsDown() throws Exception {
        CalculateCheckoutUseCase useCase = mock(CalculateCheckoutUseCase.class);
        when(useCase.calculate("user-42"))
                .thenThrow(new CartUnavailableException("cart service unreachable"));

        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new CheckoutController(useCase, mock(ShippingQuotePort.class)))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", "user-42")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));

        mvc.perform(post("/checkout/calculate-from-cart"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("CART_UNAVAILABLE"));
    }
}
