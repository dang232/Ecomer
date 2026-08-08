package com.vnshop.sellerfinanceservice.infrastructure.config;

import com.vnshop.sellerfinanceservice.application.CreditWalletUseCase;
import com.vnshop.sellerfinanceservice.application.ApplyFinancialAdjustmentUseCase;
import com.vnshop.sellerfinanceservice.application.AdminPayoutReadUseCase;
import com.vnshop.sellerfinanceservice.application.GetSellerPayoutsUseCase;
import com.vnshop.sellerfinanceservice.application.ListPayoutsUseCase;
import com.vnshop.sellerfinanceservice.application.ProcessPayoutUseCase;
import com.vnshop.sellerfinanceservice.application.RefundWalletUseCase;
import com.vnshop.sellerfinanceservice.application.RequestPayoutUseCase;
import com.vnshop.sellerfinanceservice.application.ViewWalletUseCase;
import com.vnshop.sellerfinanceservice.application.ReleaseEligibleSettlementsUseCase;
import com.vnshop.sellerfinanceservice.application.CapturePayoutDestinationSnapshotUseCase;
import com.vnshop.sellerfinanceservice.application.SealPayoutDestinationSnapshotUseCase;
import com.vnshop.sellerfinanceservice.domain.CommissionCalculator;
import com.vnshop.sellerfinanceservice.domain.PayoutExecutionMode;
import com.vnshop.sellerfinanceservice.domain.PayoutEligibilityService;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutEligibilityPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutProviderQueryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutProviderPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerDirectoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.InMemoryChargebackHoldAllocationHolder;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class UseCaseConfig {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
    @Bean
    CommissionCalculator commissionCalculator(CommissionRateConfig rateConfig) {
        return new CommissionCalculator(rateConfig);
    }

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
            name = "seller-finance.hold-allocation.persistence-mode", havingValue = "in-memory")
    ChargebackHoldAllocationRepositoryPort testChargebackHoldAllocationRepository() {
        return new InMemoryChargebackHoldAllocationHolder();
    }

    @Bean
    CreditWalletUseCase creditWalletUseCase(SellerWalletRepositoryPort walletRepositoryPort, CommissionCalculator commissionCalculator) {
        return new CreditWalletUseCase(walletRepositoryPort, commissionCalculator);
    }

    @Bean
    PayoutEligibilityPort payoutEligibilityPort(SellerWalletRepositoryPort walletRepositoryPort,
                                                ChargebackHoldAllocationRepositoryPort holdRepositoryPort) {
        return new PayoutEligibilityService(walletRepositoryPort, holdRepositoryPort);
    }

    @Bean
    ApplyFinancialAdjustmentUseCase applyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepositoryPort,
            FinanceEventInboxPort financeEventInboxPort,
            SellerWalletRepositoryPort walletRepositoryPort,
            ChargebackHoldAllocationRepositoryPort holdRepositoryPort) {
        return new ApplyFinancialAdjustmentUseCase(ledgerRepositoryPort, financeEventInboxPort,
                walletRepositoryPort, holdRepositoryPort);
    }

    @Bean
    RefundWalletUseCase refundWalletUseCase(SellerWalletRepositoryPort walletRepositoryPort, CommissionCalculator commissionCalculator) {
        return new RefundWalletUseCase(walletRepositoryPort, commissionCalculator);
    }

    @Bean
    RequestPayoutUseCase requestPayoutUseCase(
            SellerWalletRepositoryPort walletRepositoryPort,
            PayoutRepositoryPort payoutRepositoryPort,
            LedgerRepositoryPort ledgerRepositoryPort,
            PayoutEligibilityPort payoutEligibilityPort,
            CapturePayoutDestinationSnapshotUseCase captureDestination,
            SealPayoutDestinationSnapshotUseCase sealDestination,
            Clock clock) {
        return new RequestPayoutUseCase(walletRepositoryPort, payoutRepositoryPort, ledgerRepositoryPort,
                payoutEligibilityPort, captureDestination, sealDestination, clock);
    }

    @Bean
    AdminPayoutReadUseCase adminPayoutReadUseCase(
            PayoutRepositoryPort payoutRepositoryPort,
            SellerDirectoryPort sellerDirectoryPort) {
        return new AdminPayoutReadUseCase(payoutRepositoryPort, sellerDirectoryPort);
    }

    @Bean
    ListPayoutsUseCase listPayoutsUseCase(PayoutRepositoryPort payoutRepositoryPort) {
        return new ListPayoutsUseCase(payoutRepositoryPort);
    }

    @Bean
    GetSellerPayoutsUseCase getSellerPayoutsUseCase(PayoutRepositoryPort payoutRepositoryPort) {
        return new GetSellerPayoutsUseCase(payoutRepositoryPort);
    }

    @Bean
    ViewWalletUseCase viewWalletUseCase(SellerWalletRepositoryPort walletRepositoryPort) {
        return new ViewWalletUseCase(walletRepositoryPort);
    }

    @Bean
    ProcessPayoutUseCase processPayoutUseCase(
            SellerWalletRepositoryPort walletRepositoryPort,
            PayoutRepositoryPort payoutRepositoryPort,
            LedgerRepositoryPort ledgerRepositoryPort,
            PayoutProviderQueryPort payoutProviderQueryPort,
            PayoutProviderPort payoutProviderPort,
            Clock clock,
            PayoutExecutionMode payoutExecutionMode,
            ObjectProvider<TransactionTemplate> payoutTransactionTemplate,
            SellerFinanceProperties properties) {
        return new ProcessPayoutUseCase(walletRepositoryPort, payoutRepositoryPort, ledgerRepositoryPort,
                payoutProviderQueryPort, payoutProviderPort, clock, payoutExecutionMode,
                properties.payoutIdempotencyPrefix(), payoutTransactionTemplate.getIfAvailable());
    }

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnBean(PlatformTransactionManager.class)
    TransactionTemplate payoutTransactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    PayoutExecutionMode payoutExecutionMode(SellerFinanceProperties properties) {
        return PayoutExecutionMode.parse(properties.payoutExecutionMode());
    }

    @Bean
    @ConditionalOnMissingBean(PayoutProviderQueryPort.class)
    PayoutProviderQueryPort payoutProviderQueryPort(PayoutExecutionMode executionMode) {
        if (executionMode == PayoutExecutionMode.PROVIDER) {
            throw new IllegalStateException("PAYOUT_EXECUTION_MODE=PROVIDER requires a configured payout provider query adapter");
        }
        return payout -> PayoutProviderQueryPort.QueryResult.unknown("provider adapter is not configured");
    }

    @Bean
    @ConditionalOnMissingBean(PayoutProviderPort.class)
    PayoutProviderPort payoutProviderPort(PayoutExecutionMode executionMode) {
        if (executionMode == PayoutExecutionMode.PROVIDER) {
            throw new IllegalStateException("PAYOUT_EXECUTION_MODE=PROVIDER requires a configured payout provider adapter");
        }
        return (payout, providerIdempotencyKey) -> {
            throw new IllegalStateException("provider adapter is not configured");
        };
    }

    @Bean
    ReleaseEligibleSettlementsUseCase releaseEligibleSettlementsUseCase(
            SettlementReleaseCandidateRepositoryPort candidateRepositoryPort,
            ApplyFinancialAdjustmentUseCase applyFinancialAdjustmentUseCase,
            Clock clock,
            SellerFinanceProperties properties) {
        return new ReleaseEligibleSettlementsUseCase(candidateRepositoryPort, applyFinancialAdjustmentUseCase,
                clock, properties.settlementRelease().batchSize());
    }

}
