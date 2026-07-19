package com.vnshop.orderservice.infrastructure.grpc;

import static org.assertj.core.api.Assertions.assertThat;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.junit.jupiter.api.Test;

class GrpcTransportCompatibilityTest {

    @Test
    void createsChannelWithResolvedGrpcTransport() {
        ManagedChannel channel = ManagedChannelBuilder
                .forAddress("localhost", 65535)
                .usePlaintext()
                .build();

        try {
            assertThat(channel).isNotNull();
        } finally {
            channel.shutdownNow();
        }
    }
}
