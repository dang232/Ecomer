package com.vnshop.orderservice.infrastructure.config;

import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class PersistenceConfigTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(PersistenceConfig.class);

    @Test
    void enablesStubsOnlyWhenGrpcClientsAreDisabled() {
        contextRunner
                .withPropertyValues("grpc.client.enabled=false")
                .run(context -> {
                    assertThat(context).hasSingleBean(InventoryReservationPort.class);
                    assertThat(context).hasSingleBean(PaymentRequestPort.class);
                    assertThat(context).hasSingleBean(ShippingRequestPort.class);
                });

        contextRunner
                .withPropertyValues("grpc.client.enabled=true")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(InventoryReservationPort.class);
                    assertThat(context).doesNotHaveBean(PaymentRequestPort.class);
                    assertThat(context).doesNotHaveBean(ShippingRequestPort.class);
                });
    }
}
