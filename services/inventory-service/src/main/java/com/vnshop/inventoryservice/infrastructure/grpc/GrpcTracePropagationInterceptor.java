package com.vnshop.inventoryservice.infrastructure.grpc;

import io.grpc.ForwardingServerCallListener;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import io.opentelemetry.context.propagation.TextMapGetter;

final class GrpcTracePropagationInterceptor implements ServerInterceptor {
    private static final Metadata.Key<String> TRACEPARENT = Metadata.Key.of(
            "traceparent", Metadata.ASCII_STRING_MARSHALLER);

    @Override
    public <RequestT, ResponseT> ServerCall.Listener<RequestT> interceptCall(
            ServerCall<RequestT, ResponseT> call,
            Metadata headers,
            ServerCallHandler<RequestT, ResponseT> next) {
        Context extracted = W3CTraceContextPropagator.getInstance().extract(
                Context.current(), headers, new TextMapGetter<>() {
                    @Override
                    public Iterable<String> keys(Metadata carrier) {
                        return java.util.List.of("traceparent");
                    }

                    @Override
                    public String get(Metadata carrier, String key) {
                        return carrier.get(TRACEPARENT);
                    }
                });
        ServerCall.Listener<RequestT> listener = next.startCall(call, headers);
        return new ForwardingServerCallListener.SimpleForwardingServerCallListener<>(listener) {
            @Override
            public void onMessage(RequestT message) {
                try (Scope ignored = extracted.makeCurrent()) {
                    super.onMessage(message);
                }
            }

            @Override
            public void onHalfClose() {
                try (Scope ignored = extracted.makeCurrent()) {
                    super.onHalfClose();
                }
            }
        };
    }
}
