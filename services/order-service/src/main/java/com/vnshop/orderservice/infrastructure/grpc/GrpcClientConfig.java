package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.proto.v1.InventoryServiceGrpc;
import com.vnshop.proto.v1.PaymentServiceGrpc;
import com.vnshop.proto.v1.ShippingServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.netty.shaded.io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.shaded.io.grpc.netty.NettyChannelBuilder;
import io.grpc.netty.shaded.io.netty.channel.ChannelOption;
import io.grpc.Metadata;
import io.grpc.ClientInterceptors;
import io.grpc.stub.MetadataUtils;
import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.List;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.io.File;
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
    @Value("${grpc.client.inventory.service-id:order-service}")
    private String inventoryServiceId;
    @Value("${grpc.client.inventory.service-token:}")
    private String inventoryServiceToken;
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
    @Value("${grpc.client.shipping.service-id:order-service}")
    private String shippingServiceId;
    @Value("${grpc.client.shipping.service-token:}")
    private String shippingServiceToken;
    @Value("${grpc.client.tls.ca-cert:}")
    private String tlsCaCert;
    @Value("${grpc.client.tls.client-cert:}")
    private String tlsClientCert;
    @Value("${grpc.client.tls.client-key:}")
    private String tlsClientKey;
    @Value("${grpc.client.connect-timeout:1s}")
    private Duration connectTimeout;
    @Value("${grpc.client.deadline:2500ms}")
    private Duration providerDeadline;

    private final List<ManagedChannel> channels = new ArrayList<>();

    @Bean
    public InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub() {
        ManagedChannel channel = buildChannel(inventoryHost, inventoryPort);
        return InventoryServiceGrpc.newBlockingStub(ClientInterceptors.intercept(
                channel, serviceAuthHeaders(inventoryServiceId, inventoryServiceToken), clientInterceptor()))
                .withDeadlineAfter(providerDeadline.toMillis(), TimeUnit.MILLISECONDS);
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
                channel, MetadataUtils.newAttachHeadersInterceptor(headers), clientInterceptor()))
                .withDeadlineAfter(providerDeadline.toMillis(), TimeUnit.MILLISECONDS);
    }

    @Bean
    public ShippingServiceGrpc.ShippingServiceBlockingStub shippingStub() {
        ManagedChannel channel = buildChannel(shippingHost, shippingPort);
        return ShippingServiceGrpc.newBlockingStub(ClientInterceptors.intercept(
                channel, serviceAuthHeaders(shippingServiceId, shippingServiceToken), clientInterceptor()))
                .withDeadlineAfter(providerDeadline.toMillis(), TimeUnit.MILLISECONDS);
    }

    private io.grpc.ClientInterceptor serviceAuthHeaders(String serviceId, String serviceToken) {
        if (serviceId == null || serviceId.isBlank() || serviceToken == null || serviceToken.isBlank()) {
            throw new IllegalStateException("gRPC service identity configuration is required");
        }
        Metadata headers = new Metadata();
        headers.put(Metadata.Key.of("x-vnshop-service-id", Metadata.ASCII_STRING_MARSHALLER), serviceId);
        headers.put(Metadata.Key.of("x-vnshop-service-token", Metadata.ASCII_STRING_MARSHALLER), serviceToken);
        return MetadataUtils.newAttachHeadersInterceptor(headers);
    }

    private ManagedChannel buildChannel(String host, int port) {
        if (tlsCaCert.isBlank() || tlsClientCert.isBlank() || tlsClientKey.isBlank()) {
            throw new IllegalStateException("gRPC mTLS certificate configuration is required");
        }
        try {
            ManagedChannel channel = NettyChannelBuilder
                .forAddress(host, port)
                .sslContext(GrpcSslContexts.forClient()
                        .trustManager(new File(tlsCaCert))
                .keyManager(new File(tlsClientCert), new File(tlsClientKey))
                        .build())
                .withOption(ChannelOption.CONNECT_TIMEOUT_MILLIS, Math.toIntExact(connectTimeout.toMillis()))
                .keepAliveTime(30, SECONDS)
                .keepAliveTimeout(5, SECONDS)
                .keepAliveWithoutCalls(true)
                .build();
            channels.add(channel);
            return channel;
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Unable to configure gRPC mTLS", exception);
        }
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
