package com.vnshop.sellerfinanceservice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class WalletProjectionReconciliationTest {

    private static final BigDecimal HUNDRED = new BigDecimal("100.00");
    private static final BigDecimal FORTY = new BigDecimal("40.00");
    private static final BigDecimal TEN = new BigDecimal("10.00");

    @Test
    void projectionBalancesCreditsReleasesPayoutsAndRefunds() {
        SellerWallet wallet = new SellerWallet("seller-1");

        wallet.creditSettlement(HUNDRED, TEN);
        wallet.releaseSettlement(HUNDRED);
        wallet.reservePayout(FORTY);
        wallet.completePayout(FORTY, Instant.parse("2026-07-24T00:00:00Z"));
        wallet.applyRefund(HUNDRED);

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

        assertThatIllegalArgumentException().isThrownBy(
                () -> wallet.releaseSettlement(BigDecimal.ONE));
    }

    @Test
    void supportsLegacyCreditAndFailedPayoutRecovery() {
        SellerWallet wallet = new SellerWallet("seller-1");

        wallet.credit(FIFTY());
        wallet.reservePayout(TWENTY());
        wallet.failPayout(TWENTY());

        assertThat(wallet.availableBalance()).isEqualByComparingTo("50.00");
        assertThat(wallet.payoutPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.totalEarned()).isEqualByComparingTo("50.00");
    }

    @Test
    void rejectsInvalidWalletIdentityVersionAndAmounts() {
        assertThatIllegalArgumentException().isThrownBy(
                () -> new SellerWallet("", "VND", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, null, 0));
        assertThatIllegalArgumentException().isThrownBy(
                () -> new SellerWallet("seller-1", "VND", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, null, -1));
        assertThatIllegalArgumentException().isThrownBy(
                () -> new SellerWallet("seller-1", "VND", BigDecimal.valueOf(-1), BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, null, 0));
    }

    @Test
    void reportsWhenProjectionDoesNotReconcile() {
        SellerWallet wallet = new SellerWallet(
                "seller-1", "VND", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ONE, null, 0);

        assertThat(wallet.projectionEquationHolds()).isFalse();
    }

    @Test
    void futureCreditsClearDebtBeforeEnteringSettlementPending() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.applyRefund(new BigDecimal("150"));

        wallet.creditSettlement(new BigDecimal("60"), BigDecimal.ZERO);

        assertThat(wallet.debtBalance()).isEqualByComparingTo("0");
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo("10");
        assertThat(wallet.totalEarned()).isEqualByComparingTo("160");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    // ---- Task 2 chargeback-hold invariants ----

    @Test
    void chargebackHoldMovesFundsIntoReserveAndIsIdempotent() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        UUID holdId = UUID.randomUUID();

        SellerWallet.HoldAllocation first = wallet.holdChargeback(holdId, FORTY,
                SellerWallet.WalletBucket.AVAILABLE);
        SellerWallet.HoldAllocation second = wallet.holdChargeback(holdId, FORTY,
                SellerWallet.WalletBucket.AVAILABLE);

        assertThat(first).isEqualTo(second);
        assertThat(wallet.availableBalance()).isEqualByComparingTo("60.00");
        assertThat(wallet.reserveBalance()).isEqualByComparingTo("40.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
        assertThat(wallet.openChargebackHolds()).hasSize(1);
    }

    @Test
    void chargebackReleaseRestoresExactlyTheOriginalSourceBucket() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        // No release -> funds are still in settlement-pending; hold draws from there.
        UUID holdId = UUID.randomUUID();
        wallet.holdChargeback(holdId, FORTY, SellerWallet.WalletBucket.SETTLEMENT_PENDING);

        wallet.releaseChargeback(holdId);

        // The 40 originally drawn from settlement-pending must be restored to settlement-pending,
        // NOT credited to available or anywhere else.
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo(HUNDRED);
        assertThat(wallet.availableBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.reserveBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.openChargebackHolds()).isEmpty();
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void chargebackReleaseIsIdempotent() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        UUID holdId = UUID.randomUUID();
        wallet.holdChargeback(holdId, FORTY, SellerWallet.WalletBucket.AVAILABLE);
        wallet.releaseChargeback(holdId);

        SellerWallet.HoldAllocation releasedAgain = wallet.releaseChargeback(holdId);

        assertThat(releasedAgain.status()).isEqualTo(SellerWallet.HoldStatus.RELEASED);
        assertThat(wallet.availableBalance()).isEqualByComparingTo("100.00");
        assertThat(wallet.reserveBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void chargebackFinalizeConsumesReserveWithoutSecondDebit() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        UUID holdId = UUID.randomUUID();
        wallet.holdChargeback(holdId, FORTY, SellerWallet.WalletBucket.AVAILABLE);

        BigDecimal availableBefore = wallet.availableBalance();
        BigDecimal settlementBefore = wallet.settlementPendingBalance();
        BigDecimal reserveBefore = wallet.reserveBalance();
        wallet.finalizeChargeback(holdId);

        assertThat(wallet.availableBalance()).isEqualByComparingTo(availableBefore);
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo(settlementBefore);
        assertThat(wallet.reserveBalance()).isEqualByComparingTo(reserveBefore.subtract(FORTY));
        assertThat(wallet.openChargebackHolds()).isEmpty();
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void chargebackFinalizeIsIdempotent() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        UUID holdId = UUID.randomUUID();
        wallet.holdChargeback(holdId, FORTY, SellerWallet.WalletBucket.AVAILABLE);
        wallet.finalizeChargeback(holdId);

        SellerWallet.HoldAllocation finalizedAgain = wallet.finalizeChargeback(holdId);

        assertThat(finalizedAgain.status()).isEqualTo(SellerWallet.HoldStatus.FINALIZED);
        assertThat(wallet.reserveBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void cannotReleaseAfterFinalizeAndViceVersa() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        UUID holdId = UUID.randomUUID();
        wallet.holdChargeback(holdId, FORTY, SellerWallet.WalletBucket.AVAILABLE);
        wallet.finalizeChargeback(holdId);

        assertThatIllegalStateException().isThrownBy(() -> wallet.releaseChargeback(holdId));
    }

    @Test
    void cannotFinalizeAfterRelease() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        UUID holdId = UUID.randomUUID();
        wallet.holdChargeback(holdId, FORTY, SellerWallet.WalletBucket.AVAILABLE);
        wallet.releaseChargeback(holdId);

        assertThatIllegalStateException().isThrownBy(() -> wallet.finalizeChargeback(holdId));
    }

    @Test
    void refundAfterPayoutReservationCannotReducePayoutPending() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        wallet.reservePayout(FORTY);
        // Refund of 100 must NOT touch the 40 already reserved for payout.
        wallet.applyRefund(HUNDRED);

        assertThat(wallet.payoutPendingBalance()).isEqualByComparingTo("40.00");
        assertThat(wallet.debtBalance()).isEqualByComparingTo("40.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void payoutReservationAndReversalLeaveAvailableUntouched() {
        SellerWallet wallet = new SellerWallet("seller-1");
        wallet.creditSettlement(HUNDRED, BigDecimal.ZERO);
        wallet.releaseSettlement(HUNDRED);
        wallet.reservePayout(FORTY);

        wallet.reversePayoutReservation(FORTY);

        assertThat(wallet.availableBalance()).isEqualByComparingTo("100.00");
        assertThat(wallet.payoutPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.totalPaidOut()).isEqualByComparingTo("0.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("projectionReconciliationScenarios")
    void projectionReconcilesForEveryOperationSequence(
            String label, List<WalletMutation> mutations, ProjectionExpectation expectation) {
        SellerWallet wallet = new SellerWallet("seller-1");
        for (WalletMutation mutation : mutations) {
            mutation.applyTo(wallet);
        }
        assertThat(wallet.projectionEquationHolds())
                .as(label + " projection should reconcile")
                .isTrue();
        expectation.assertExpectation(label, wallet);
    }

    private static Stream<Arguments> projectionReconciliationScenarios() {
        return Stream.of(
                Arguments.of("credit only",
                        List.of((WalletMutation) w -> w.creditSettlement(HUNDRED, TEN)),
                        ProjectionExpectation.projectionDelta(HUNDRED, BigDecimal.ZERO, BigDecimal.ZERO,
                                BigDecimal.ZERO, BigDecimal.ZERO, HUNDRED, TEN, BigDecimal.ZERO,
                                BigDecimal.ZERO, HUNDRED)),
                Arguments.of("credit then release",
                        List.of(
                                (WalletMutation) w -> w.creditSettlement(HUNDRED, TEN),
                                (WalletMutation) w -> w.releaseSettlement(HUNDRED)),
                        ProjectionExpectation.projectionDelta(BigDecimal.ZERO, HUNDRED,
                                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, HUNDRED, TEN,
                                BigDecimal.ZERO, BigDecimal.ZERO, HUNDRED)),
                Arguments.of("refund after payout reservation",
                        List.of(
                                (WalletMutation) w -> w.creditSettlement(HUNDRED, BigDecimal.ZERO),
                                (WalletMutation) w -> w.releaseSettlement(HUNDRED),
                                (WalletMutation) w -> w.reservePayout(FORTY),
                                (WalletMutation) w -> w.applyRefund(HUNDRED)),
                        ProjectionExpectation.projectionDelta(BigDecimal.ZERO, BigDecimal.ZERO,
                                BigDecimal.ZERO, new BigDecimal("40.00"), new BigDecimal("40.00"),
                                HUNDRED, BigDecimal.ZERO, HUNDRED, BigDecimal.ZERO, HUNDRED)),
                Arguments.of("chargeback hold + finalize",
                        List.of(
                                (WalletMutation) w -> {
                                    w.creditSettlement(HUNDRED, BigDecimal.ZERO);
                                    w.releaseSettlement(HUNDRED);
                                },
                                (WalletMutation) w -> w.holdChargeback(UUID.randomUUID(), FORTY,
                                        SellerWallet.WalletBucket.AVAILABLE),
                                (WalletMutation) w -> w.finalizeChargeback(
                                        w.openChargebackHolds().get(0).holdId())),
                        ProjectionExpectation.projectionDelta(BigDecimal.ZERO, new BigDecimal("60.00"),
                                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, HUNDRED,
                                BigDecimal.ZERO, FORTY, BigDecimal.ZERO, HUNDRED))
        );
    }

    @FunctionalInterface
    private interface WalletMutation {
        void applyTo(SellerWallet wallet);
    }

    private record ProjectionExpectation(
            BigDecimal settlementPending, BigDecimal available, BigDecimal reserve,
            BigDecimal payoutPending, BigDecimal debt, BigDecimal totalEarned,
            BigDecimal totalFees, BigDecimal totalRefunded, BigDecimal totalPaidOut,
            BigDecimal reconstructed) {
        static ProjectionExpectation projectionDelta(BigDecimal sp, BigDecimal av, BigDecimal rs,
                                                     BigDecimal pp, BigDecimal db, BigDecimal te,
                                                     BigDecimal tf, BigDecimal tr, BigDecimal tpo,
                                                     BigDecimal reconstructed) {
            return new ProjectionExpectation(sp, av, rs, pp, db, te, tf, tr, tpo, reconstructed);
        }

        void assertExpectation(String label, SellerWallet w) {
            assertThat(w.settlementPendingBalance()).as(label + " settlementPending").isEqualByComparingTo(settlementPending);
            assertThat(w.availableBalance()).as(label + " available").isEqualByComparingTo(available);
            assertThat(w.reserveBalance()).as(label + " reserve").isEqualByComparingTo(reserve);
            assertThat(w.payoutPendingBalance()).as(label + " payoutPending").isEqualByComparingTo(payoutPending);
            assertThat(w.debtBalance()).as(label + " debt").isEqualByComparingTo(debt);
            assertThat(w.totalEarned()).as(label + " totalEarned").isEqualByComparingTo(totalEarned);
            assertThat(w.totalFees()).as(label + " totalFees").isEqualByComparingTo(totalFees);
            assertThat(w.totalRefunded()).as(label + " totalRefunded").isEqualByComparingTo(totalRefunded);
            assertThat(w.totalPaidOut()).as(label + " totalPaidOut").isEqualByComparingTo(totalPaidOut);
            assertThat(w.settlementPendingBalance().add(w.availableBalance()).add(w.reserveBalance())
                    .add(w.payoutPendingBalance()).add(w.totalRefunded()).add(w.totalPaidOut())
                    .subtract(w.debtBalance()))
                    .as(label + " reconstructed == totalEarned")
                    .isEqualByComparingTo(w.totalEarned());
        }
    }

    private static BigDecimal FIFTY() {
        return new BigDecimal("50.00");
    }

    private static BigDecimal TWENTY() {
        return new BigDecimal("20.00");
    }
}