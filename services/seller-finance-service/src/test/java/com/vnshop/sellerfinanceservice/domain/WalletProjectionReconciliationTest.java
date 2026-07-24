package com.vnshop.sellerfinanceservice.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class WalletProjectionReconciliationTest {

    @Test
    void projectionBalancesCreditsReleasesPayoutsAndRefunds() {
        SellerWallet wallet = new SellerWallet("seller-1");

        wallet.creditSettlement(new BigDecimal("100.00"), new BigDecimal("10.00"));
        wallet.releaseSettlement(new BigDecimal("100.00"));
        wallet.reservePayout(new BigDecimal("40.00"));
        wallet.completePayout(new BigDecimal("40.00"), java.time.Instant.parse("2026-07-24T00:00:00Z"));
        wallet.applyRefund(new BigDecimal("100.00"));

        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.availableBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.payoutPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.debtBalance()).isEqualByComparingTo("40.00");
        assertThat(wallet.totalFees()).isEqualByComparingTo("10.00");
        assertThat(wallet.totalRefunded()).isEqualByComparingTo("100.00");
        assertThat(wallet.totalPaidOut()).isEqualByComparingTo("40.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void releaseCannotExceedSettlementPending() {
        SellerWallet wallet = new SellerWallet("seller-1");

        org.assertj.core.api.Assertions.assertThatIllegalArgumentException().isThrownBy(
                () -> wallet.releaseSettlement(BigDecimal.ONE));
    }

    @Test
    void supportsLegacyCreditAndFailedPayoutRecovery() {
        SellerWallet wallet = new SellerWallet("seller-1");

        wallet.credit(new BigDecimal("50.00"));
        wallet.reservePayout(new BigDecimal("20.00"));
        wallet.failPayout(new BigDecimal("20.00"));

        assertThat(wallet.availableBalance()).isEqualByComparingTo("50.00");
        assertThat(wallet.payoutPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.totalEarned()).isEqualByComparingTo("50.00");
    }

    @Test
    void rejectsInvalidWalletIdentityVersionAndAmounts() {
        org.assertj.core.api.Assertions.assertThatIllegalArgumentException().isThrownBy(
                () -> new SellerWallet("", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, null, 0));
        org.assertj.core.api.Assertions.assertThatIllegalArgumentException().isThrownBy(
                () -> new SellerWallet("seller-1", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, null, -1));
        org.assertj.core.api.Assertions.assertThatIllegalArgumentException().isThrownBy(
                () -> new SellerWallet("seller-1", BigDecimal.valueOf(-1), BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, null, 0));
    }

    @Test
    void reportsWhenProjectionDoesNotReconcile() {
        SellerWallet wallet = new SellerWallet(
                "seller-1", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ONE, null, 0);

        assertThat(wallet.projectionEquationHolds()).isFalse();
    }

    @Test
    void futureCreditsClearDebtBeforeEnteringSettlementPending() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(new BigDecimal("100"), BigDecimal.ZERO);
        wallet.applyRefund(new BigDecimal("150"));

        wallet.creditSettlement(new BigDecimal("60"), BigDecimal.ZERO);

        assertThat(wallet.debtBalance()).isEqualByComparingTo("0");
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo("10");
        assertThat(wallet.totalEarned()).isEqualByComparingTo("160");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }
}
