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
import com.vnshop.sellerfinanceservice.domain.CommissionCalculator;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerDirectoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class UseCaseConfig {
    @Bean
    CommissionCalculator commissionCalculator(CommissionRateConfig rateConfig) {
        return new CommissionCalculator(rateConfig);
    }

    @Bean
    CreditWalletUseCase creditWalletUseCase(SellerWalletRepositoryPort walletRepositoryPort, CommissionCalculator commissionCalculator) {
        return new CreditWalletUseCase(walletRepositoryPort, commissionCalculator);
    }

    @Bean
    ApplyFinancialAdjustmentUseCase applyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepositoryPort,
            FinanceEventInboxPort financeEventInboxPort,
            SellerWalletRepositoryPort walletRepositoryPort) {
        return new ApplyFinancialAdjustmentUseCase(ledgerRepositoryPort, financeEventInboxPort, walletRepositoryPort);
    }

    @Bean
    RefundWalletUseCase refundWalletUseCase(SellerWalletRepositoryPort walletRepositoryPort, CommissionCalculator commissionCalculator) {
        return new RefundWalletUseCase(walletRepositoryPort, commissionCalculator);
    }

    @Bean
    RequestPayoutUseCase requestPayoutUseCase(SellerWalletRepositoryPort walletRepositoryPort, PayoutRepositoryPort payoutRepositoryPort) {
        return new RequestPayoutUseCase(walletRepositoryPort, payoutRepositoryPort);
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
    ProcessPayoutUseCase processPayoutUseCase(SellerWalletRepositoryPort walletRepositoryPort, PayoutRepositoryPort payoutRepositoryPort) {
        return new ProcessPayoutUseCase(walletRepositoryPort, payoutRepositoryPort);
    }
}
