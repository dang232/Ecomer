package com.vnshop.orderservice;

import com.vnshop.orderservice.application.coupon.CouponManagementService;
import com.vnshop.orderservice.application.coupon.CouponQuote;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.infrastructure.web.ApiExceptionHandler;
import com.vnshop.orderservice.infrastructure.web.CouponController;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CouponControllerTest {
    @Test
    void applyCouponIsQuoteOnlyAndPreservesLegacyResponseShape() throws Exception {
        CouponRedemptionService redemption = mock(CouponRedemptionService.class);
        when(redemption.quote("SAVE10", money(200_000), "buyer-1"))
                .thenReturn(CouponQuote.valid("SAVE10", money(200_000), money(20_000)));
        MockMvc mvc = mvc(redemption);

        mvc.perform(post("/checkout/apply-coupon")
                        .header("x-user-id", "buyer-1")
                        .contentType("application/json")
                        .content("""
                                {"code":"SAVE10","orderAmount":200000,"orderId":42}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.code").value("SAVE10"))
                .andExpect(jsonPath("$.data.discount").value(20000))
                .andExpect(jsonPath("$.data.finalTotal").value(180000));

        verify(redemption).quote("SAVE10", money(200_000), "buyer-1");
        verify(redemption, never()).consume(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void validationAliasReturnsReasonWithoutConsumingCoupon() throws Exception {
        CouponRedemptionService redemption = mock(CouponRedemptionService.class);
        when(redemption.quote("OLD", money(100_000), null))
                .thenReturn(CouponQuote.invalid("OLD", money(100_000), "COUPON_EXPIRED"));
        MockMvc mvc = mvc(redemption);

        mvc.perform(post("/checkout/validate-coupon")
                        .contentType("application/json")
                        .content("""
                                {"code":"OLD","orderTotal":100000}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(false))
                .andExpect(jsonPath("$.data.discount").value(0))
                .andExpect(jsonPath("$.data.message").value("COUPON_EXPIRED"));
    }

    private static MockMvc mvc(CouponRedemptionService redemption) {
        return MockMvcBuilders
                .standaloneSetup(new CouponController(mock(CouponManagementService.class), redemption))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private static Money money(long amount) {
        return new Money(BigDecimal.valueOf(amount));
    }
}
