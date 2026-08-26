package com.vnshop.inventoryservice.infrastructure.grpc;

import io.grpc.ForwardingServerCall;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

final class GrpcServiceAuthInterceptor implements ServerInterceptor {
    static final String SERVICE_ID_HEADER = "x-vnshop-service-id";
    static final String SERVICE_TOKEN_HEADER = "x-vnshop-service-token";
    private static final Metadata.Key<String> SERVICE_ID = Metadata.Key.of(SERVICE_ID_HEADER, Metadata.ASCII_STRING_MARSHALLER);
    private static final Metadata.Key<String> SERVICE_TOKEN = Metadata.Key.of(SERVICE_TOKEN_HEADER, Metadata.ASCII_STRING_MARSHALLER);
    private final String expectedServiceId;
    private final byte[] expectedToken;

    GrpcServiceAuthInterceptor(String expectedServiceId, String expectedToken) {
        if (expectedServiceId == null || expectedServiceId.isBlank() || expectedToken == null || expectedToken.isBlank()) {
            throw new IllegalArgumentException("gRPC service identity configuration is required");
        }
        this.expectedServiceId = expectedServiceId;
        this.expectedToken = expectedToken.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public <RequestT, ResponseT> ServerCall.Listener<RequestT> interceptCall(
            ServerCall<RequestT, ResponseT> call, Metadata headers, ServerCallHandler<RequestT, ResponseT> next) {
        String serviceId = headers.get(SERVICE_ID);
        String token = headers.get(SERVICE_TOKEN);
        if (!expectedServiceId.equals(serviceId) || token == null
                || !MessageDigest.isEqual(expectedToken, token.getBytes(StandardCharsets.UTF_8))) {
            call.close(Status.UNAUTHENTICATED.withDescription("invalid gRPC service identity"), new Metadata());
            return new ServerCall.Listener<>() { };
        }
        return next.startCall(new ForwardingServerCall.SimpleForwardingServerCall<>(call) { }, headers);
    }
}
