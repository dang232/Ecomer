package com.vnshop.paymentservice.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.HandleVnpayIpnUseCase;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.application.ProviderInitializationService;
import com.vnshop.paymentservice.application.RefundPaymentUseCase;
import com.vnshop.paymentservice.application.ledger.LedgerService;
import com.vnshop.paymentservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.OrderCatalogPort;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import com.vnshop.paymentservice.domain.port.out.PaymentIdempotencyKeyRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.RefundGatewayPort;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import com.vnshop.paymentservice.infrastructure.fx.FxProperties;
import com.vnshop.paymentservice.infrastructure.gateway.MomoProperties;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayProperties;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import com.vnshop.paymentservice.infrastructure.metrics.PaymentMetrics;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.util.List;
import java.time.Duration;

@Configuration
@EnableConfigurationProperties({
        VnpayProperties.class,
        MomoProperties.class,
        FxProperties.class,
        StripeProperties.class,
        PayPalProperties.class,
        SepayProperties.class
})
public class UseCaseConfig {

    @Bean
    LedgerService ledgerService(
            LedgerRepositoryPort ledgerRepositoryPort,
            @Value("${payment.ledger.currency:VND}") String currency,
            @Value("${payment.ledger.buyer-account:buyer_cash}") String buyerAccount,
            @Value("${payment.ledger.clearing-account:payment_clearing}") String clearingAccount) {
        return new LedgerService(ledgerRepositoryPort, currency, buyerAccount, clearingAccount);
    }

    @Bean
    ProcessPaymentUseCase processPaymentUseCase(
            PaymentRepositoryPort paymentRepositoryPort,
            PaymentGatewayPort paymentGatewayPort,
            LedgerService ledgerService,
            PaymentIdempotencyKeyRepositoryPort paymentIdempotencyKeyRepository,
            OrderCatalogPort orderCatalogPort,
            PlatformTransactionManager transactionManager,
            PaymentMetrics paymentMetrics
    ) {
        return new ProcessPaymentUseCase(
                paymentRepositoryPort,
                paymentGatewayPort,
                ledgerService,
                paymentIdempotencyKeyRepository,
                orderCatalogPort,
                new TransactionTemplate(transactionManager), java.time.Clock.systemUTC(), paymentMetrics
        );
    }

    @Bean
    GetPaymentStatusUseCase getPaymentStatusUseCase(PaymentRepositoryPort paymentRepositoryPort) {
        return new GetPaymentStatusUseCase(paymentRepositoryPort);
    }

    @Bean
    ProviderInitializationService providerInitializationService(
            PaymentRepositoryPort paymentRepositoryPort,
            FxRatePort fxRatePort,
            PlatformTransactionManager transactionManager) {
        return new ProviderInitializationService(
                paymentRepositoryPort, fxRatePort, new TransactionTemplate(transactionManager));
    }

    @Bean
    HandleVnpayIpnUseCase handleVnpayIpnUseCase(PaymentRepositoryPort paymentRepositoryPort, LedgerService ledgerService) {
        return new HandleVnpayIpnUseCase(paymentRepositoryPort, ledgerService);
    }

    @Bean
    RefundPaymentUseCase refundPaymentUseCase(
            PaymentRepositoryPort paymentRepositoryPort,
            List<RefundGatewayPort> refundGateways,
            com.vnshop.paymentservice.domain.port.out.PaymentRefundRepositoryPort paymentRefundRepositoryPort
    ) {
        return new RefundPaymentUseCase(paymentRepositoryPort, refundGateways, paymentRefundRepositoryPort);
    }

    /**
     * Spring Boot 4 ships {@link RestClient.Builder} as a prototype bean, but
     * autowiring it into singletons via constructor injection requires an
     * explicit bean definition in this module's @Configuration. Without this,
     * FrankfurterFxAdapter / PayPalGateway / RestSepayClient fail to wire.
     */
    @Bean
    RestClient.Builder restClientBuilder() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(1));
        requestFactory.setReadTimeout(Duration.ofSeconds(2));
        return RestClient.builder().requestFactory(requestFactory);
    }

    /**
     * Pt12 added an HTTP client (OrderCatalogAdapter) that needs an ObjectMapper.
     * payment-service is a Spring Boot service and Boot's auto-config provides
     * one when spring-boot-starter-web is on the classpath, but the explicit
     * bean here makes the dependency obvious to readers and protects against
     * webmvc starters being swapped out.
     */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
    ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
