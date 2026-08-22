package com.vnshop.orderservice.infrastructure.observability;

import io.grpc.ClientCall;
import io.grpc.ClientCall.Listener;
import io.grpc.ClientInterceptor;
import io.grpc.Metadata;
import io.grpc.ServerInterceptor;
import io.grpc.ForwardingClientCall;
import io.grpc.ForwardingServerCallListener;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import io.opentelemetry.context.propagation.TextMapGetter;
import io.opentelemetry.context.propagation.TextMapSetter;

public final class GrpcTracePropagation {
    private static final Metadata.Key<String> TRACEPARENT = Metadata.Key.of(
            "traceparent", Metadata.ASCII_STRING_MARSHALLER);

    private GrpcTracePropagation() {
    }

    public static ClientInterceptor clientInterceptor() {
        return new ClientInterceptor() {
            @Override
            public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
                    io.grpc.MethodDescriptor<ReqT, RespT> method,
                    io.grpc.CallOptions callOptions,
                    io.grpc.Channel next) {
            ClientCall<ReqT, RespT> call = next.newCall(method, callOptions);
            return new ForwardingClientCall.SimpleForwardingClientCall<>(call) {
                @Override
                public void start(Listener<RespT> responseListener, Metadata headers) {
                    W3CTraceContextPropagator.getInstance().inject(
                            Context.current(), headers, (carrier, key, value) -> carrier.put(
                                    Metadata.Key.of(key, Metadata.ASCII_STRING_MARSHALLER), value));
                    super.start(responseListener, headers);
                }
            };
            }
        };
    }

}
