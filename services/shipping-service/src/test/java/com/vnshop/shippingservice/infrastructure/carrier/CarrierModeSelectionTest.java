package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.model.CarrierCode;
import com.vnshop.shippingservice.domain.model.Parcel;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingAddress;
import com.vnshop.shippingservice.infrastructure.config.CarrierProperties;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CarrierModeSelectionTest {
    private final WebApplicationContextRunner contextRunner = new WebApplicationContextRunner()
            .withUserConfiguration(CarrierTestConfiguration.class)
            .withPropertyValues(
                    "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration",
                    "shipping.carrier.mode=stub",
                    "shipping.carrier.ghn.base-url=https://ghn.test",
                    "shipping.carrier.ghn.token=token",
                    "shipping.carrier.ghn.shop-id=123",
                    "shipping.carrier.ghn.service-type-id=2",
                    "shipping.carrier.ghtk.base-url=https://ghtk.test",
                    "shipping.carrier.ghtk.token=ghtk-token");

    @Test
    void defaultCarrierModeUsesSafeStubGateway() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(CarrierGatewayPort.class);
            assertThat(context).hasSingleBean(StubCarrierGateway.class);
            assertThat(context).doesNotHaveBean(LiveCarrierGateway.class);
        });
    }

    @Test
    void liveCarrierModeUsesLiveGatewayRouter() {
        contextRunner
                .withPropertyValues("shipping.carrier.mode=live")
                .withBean(CarrierHttpClient.class, FakeCarrierHttpClient::new)
                .run(context -> {
                    assertThat(context).hasSingleBean(CarrierGatewayPort.class);
                    assertThat(context).hasSingleBean(LiveCarrierGateway.class);
                    CarrierGatewayPort gateway = context.getBean(CarrierGatewayPort.class);
                    assertThat(gateway).isInstanceOf(LiveCarrierGateway.class);
                    RateQuote quote = gateway.quote(new RateQuoteRequest(CarrierCode.GHN, address(), address(), new Parcel(1, 1, 1, 1), 100L));
                    assertThat(quote.totalFeeVnd()).isEqualTo(10_000L);
                });
    }

    private static ShippingAddress address() {
        return new ShippingAddress("Name", "0900000000", "Street", "101", "1442", "Province");
    }

    private static class FakeCarrierHttpClient implements CarrierHttpClient {
        @Override
        public <T> T post(String url, Map<String, String> headers, Object body, Class<T> responseType) {
            return responseType.cast(new GhnCarrierGateway.GhnFeeResponse(new GhnCarrierGateway.GhnFeeData(10_000L)));
        }

        @Override
        public <T> T get(String url, Map<String, String> headers, Class<T> responseType) {
            throw new UnsupportedOperationException("not used");
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableConfigurationProperties({CarrierProperties.class, GhnProperties.class, GhtkProperties.class})
    @Import({StubCarrierGateway.class, LiveCarrierGateway.class, GhnCarrierGateway.class, GhtkCarrierGateway.class})
    static class CarrierTestConfiguration {
    }
}
