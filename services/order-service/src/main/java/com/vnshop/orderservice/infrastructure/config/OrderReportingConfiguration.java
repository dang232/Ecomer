package com.vnshop.orderservice.infrastructure.config;

import com.vnshop.orderservice.application.DisputeUseCase;
import com.vnshop.orderservice.application.InvoiceUseCase;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import com.vnshop.orderservice.domain.port.out.InvoicePdfRendererPort;
import com.vnshop.orderservice.domain.port.out.InvoiceRepositoryPort;
import com.vnshop.orderservice.domain.port.out.InvoiceStoragePort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OrderReportingConfiguration {
    @Bean
    DisputeUseCase disputeUseCase(
            ReturnRepositoryPort returnRepositoryPort,
            DisputeRepositoryPort disputeRepositoryPort,
            SettlementHoldPublisherPort settlementHoldPublisherPort) {
        return new DisputeUseCase(returnRepositoryPort, disputeRepositoryPort, settlementHoldPublisherPort);
    }

    @Bean
    InvoiceUseCase invoiceUseCase(
            OrderRepositoryPort orderRepositoryPort,
            InvoiceRepositoryPort invoiceRepositoryPort,
            InvoiceStoragePort invoiceStoragePort,
            InvoicePdfRendererPort invoicePdfRendererPort,
            Clock clock) {
        return new InvoiceUseCase(
                orderRepositoryPort,
                invoiceRepositoryPort,
                invoiceStoragePort,
                invoicePdfRendererPort,
                clock);
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
