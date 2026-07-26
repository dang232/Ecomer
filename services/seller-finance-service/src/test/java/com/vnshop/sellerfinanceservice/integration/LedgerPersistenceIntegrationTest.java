package com.vnshop.sellerfinanceservice.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.application.ApplyFinancialAdjustmentUseCase;
import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Testcontainers
@Import(TestcontainersConfig.class)
class LedgerPersistenceIntegrationTest {

    @Autowired
    private ApplyFinancialAdjustmentUseCase useCase;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private LedgerRepositoryPort ledgerRepository;

    @Autowired
    private FinanceEventInboxPort inboxRepository;

    @Autowired
    private SellerWalletRepositoryPort walletRepository;

    @Autowired
    private SettlementReleaseCandidateRepositoryPort settlementReleaseCandidateRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    // Replace the auto-configured JwtDecoder (which would otherwise probe the
    // real Keycloak issuer-uri during SecurityConfig wiring) with a Mockito
    // stub so context-load passes without a live Keycloak instance.
    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void persistsBalancedJournalInboxIdentityAndWalletProjectionTogether() {
        UUID eventId = UUID.randomUUID();
        FinancialAdjustment adjustment = credit(eventId, UUID.randomUUID());

        ApplyFinancialAdjustmentUseCase.ApplyResult result = useCase.apply(adjustment);

        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.ledger_journals where journal_id = ?",
                Integer.class, result.journalId())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.ledger_postings where journal_id = ?",
                Integer.class, result.journalId())).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject(
                "select journal_id from seller_finance_svc.finance_event_inbox where event_id = ?",
                UUID.class, eventId)).isEqualTo(result.journalId());
        assertThat(jdbcTemplate.queryForObject(
                "select settlement_pending_balance from seller_finance_svc.seller_wallets where seller_id = ?",
                BigDecimal.class, adjustment.sellerId())).isEqualByComparingTo("90.00");
        assertThat(jdbcTemplate.queryForObject(
                "select total_fees from seller_finance_svc.seller_wallets where seller_id = ?",
                BigDecimal.class, adjustment.sellerId())).isEqualByComparingTo("10.00");

        FinancialAdjustment release = release(UUID.randomUUID(), adjustment.orderId(), adjustment.sellerId());
        ApplyFinancialAdjustmentUseCase.ApplyResult releaseResult = useCase.apply(release);
        assertThat(jdbcTemplate.queryForObject(
                "select settlement_pending_balance from seller_finance_svc.seller_wallets where seller_id = ?",
                BigDecimal.class, adjustment.sellerId())).isEqualByComparingTo("0.00");
        assertThat(jdbcTemplate.queryForObject(
                "select available_balance from seller_finance_svc.seller_wallets where seller_id = ?",
                BigDecimal.class, adjustment.sellerId())).isEqualByComparingTo("90.00");
        assertThat(useCase.apply(release)).isEqualTo(releaseResult);
    }

    @Test
    void rejectsMutationOfPostedJournalRows() {
        ApplyFinancialAdjustmentUseCase.ApplyResult result = useCase.apply(credit(UUID.randomUUID(), UUID.randomUUID()));

        assertThatThrownBy(() -> jdbcTemplate.update(
                "update seller_finance_svc.ledger_journals set operation_type = 'TAMPERED' where journal_id = ?",
                result.journalId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("posted ledger rows are immutable");
    }

    @Test
    void rollsBackJournalWhenProjectionApplicationFails() {
        FinancialAdjustment release = release(UUID.randomUUID(), UUID.randomUUID());

        assertThatThrownBy(() -> useCase.apply(release))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("settlement pending balance");

        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.ledger_journals where source_id = ?",
                Integer.class, release.adjustmentId())).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.finance_event_inbox where event_id = ?",
                Integer.class, release.eventId())).isZero();
    }

    @Test
    void rollsBackJournalAndProjectionWhenFailureFollowsProjectionMutation() {
        FinancialAdjustment adjustment = credit(UUID.randomUUID(), UUID.randomUUID());
        ApplyFinancialAdjustmentUseCase failingUseCase = new ApplyFinancialAdjustmentUseCase(
                ledgerRepository, inboxRepository, walletRepository,
                point -> {
                    if (point == ApplyFinancialAdjustmentUseCase.FailurePoint.AFTER_PROJECTION) {
                        throw new IllegalStateException("injected projection failure");
                    }
                });

        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(
                status -> failingUseCase.apply(adjustment)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("injected projection failure");

        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.ledger_journals where source_id = ?",
                Integer.class, adjustment.adjustmentId())).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.seller_wallets where seller_id = ?",
                Integer.class, adjustment.sellerId())).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from seller_finance_svc.finance_event_inbox where event_id = ?",
                Integer.class, adjustment.eventId())).isZero();
    }

    @Test
    void persistsDeliverySnapshotAndLocksOnlyEligibleReleaseCandidates() {
        FinancialAdjustment adjustment = credit(UUID.randomUUID(), UUID.randomUUID());
        settlementReleaseCandidateRepository.recordAdjustment(adjustment);
        settlementReleaseCandidateRepository.markDelivered(adjustment.orderId(), adjustment.subOrderId(),
                Instant.now().minusSeconds(8 * 86_400L));

        assertThat(settlementReleaseCandidateRepository.lockEligible(Instant.now(), 10))
                .extracting(candidate -> candidate.allocationId())
                .containsExactly(adjustment.allocationId());
    }

    private static FinancialAdjustment credit(UUID eventId, UUID orderId) {
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CREDIT, UUID.randomUUID(), 1, orderId, 42L,
                "integration-seller-" + eventId, "STANDARD", new BigDecimal("0.10"), null, "VND",
                components(), null);
    }

    private static FinancialAdjustment release(UUID eventId, UUID orderId) {
        return release(eventId, orderId, "integration-seller-" + eventId);
    }

    private static FinancialAdjustment release(UUID eventId, UUID orderId, String sellerId) {
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.RELEASE, UUID.randomUUID(), 1, orderId, 42L,
                sellerId, "STANDARD", new BigDecimal("0.10"), null, "VND",
                components(), new FinancialAdjustment.ReleaseMetadata("BUYER_CONFIRMED", "buyer-1", Instant.now()));
    }

    private static FinancialAdjustment.Components components() {
        return new FinancialAdjustment.Components(
                new BigDecimal("100.00"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("100.00"),
                new BigDecimal("10.00"), new BigDecimal("90.00"), new BigDecimal("100.00"), "VND");
    }
}
