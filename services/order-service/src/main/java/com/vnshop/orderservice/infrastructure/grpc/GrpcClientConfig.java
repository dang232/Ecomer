package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.proto.inventory.InventoryServiceGrpc;
import com.vnshop.proto.payment.PaymentServiceGrpc;
import com.vnshop.proto.shipping.ShippingServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Metadata;
import io.grpc.ClientInterceptors;
import io.grpc.stub.MetadataUtils;
import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static java.util.concurrent.TimeUnit.SECONDS;
import static com.vnshop.orderservice.infrastructure.observability.GrpcTracePropagation.clientInterceptor;

@Configuration
@ConditionalOnProperty(name = "grpc.client.enabled", havingValue = "true", matchIfMissing = true)
public class GrpcClientConfig {

    private static final Logger log = LoggerFactory.getLogger(GrpcClientConfig.class);

    @Value("${grpc.client.inventory.host:localhost}")
    private String inventoryHost;
    @Value("${grpc.client.inventory.port:9093}")
    private int inventoryPort;
    @Value("${grpc.client.payment.host:localhost}")
    private String paymentHost;
    @Value("${grpc.client.payment.port:9094}")
    private int paymentPort;
    @Value("${grpc.client.payment.service-id:order-service}")
    private String paymentServiceId;
    @Value("${grpc.client.payment.service-token:}")
    private String paymentServiceToken;
    @Value("${grpc.client.shipping.host:localhost}")
    private String shippingHost;
    @Value("${grpc.client.shipping.port:9095}")
    private int shippingPort;

    private final List<ManagedChannel> channels = new ArrayList<>();

    @Bean
    public InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub() {
        ManagedChannel channel = buildChannel(inventoryHost, inventoryPort);
        return InventoryServiceGrpc.newBlockingStub(ClientInterceptors.intercept(channel, clientInterceptor()));
    }

    @Bean
    public PaymentServiceGrpc.PaymentServiceBlockingStub paymentStub() {
        ManagedChannel channel = buildChannel(paymentHost, paymentPort);
        Metadata headers = new Metadata();
        headers.put(Metadata.Key.of(
                "x-vnshop-service-id", Metadata.ASCII_STRING_MARSHALLER), paymentServiceId);
        headers.put(Metadata.Key.of(
                "x-vnshop-service-token", Metadata.ASCII_STRING_MARSHALLER), paymentServiceToken);
        return PaymentServiceGrpc.newBlockingStub(ClientInterceptors.intercept(
                channel, MetadataUtils.newAttachHeadersInterceptor(headers), clientInterceptor()));
    }

    @Bean
    public ShippingServiceGrpc.ShippingServiceBlockingStub shippingStub() {
        ManagedChannel channel = buildChannel(shippingHost, shippingPort);
        return ShippingServiceGrpc.newBlockingStub(ClientInterceptors.intercept(channel, clientInterceptor()));
    }

    private ManagedChannel buildChannel(String host, int port) {
        ManagedChannel channel = ManagedChannelBuilder
            .forAddress(host, port)
            .usePlaintext()
            .keepAliveTime(30, SECONDS)
            .keepAliveTimeout(5, SECONDS)
            .keepAliveWithoutCalls(true)
            .build();
        channels.add(channel);
        return channel;
    }

    @PreDestroy
    public void shutdownChannels() {
        for (ManagedChannel channel : channels) {
            try {
                channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while awaiting gRPC channel shutdown");
                channel.shutdownNow();
            }
        }
        log.info("Shut down {} gRPC client channel(s)", channels.size());
    }
}
