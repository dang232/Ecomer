package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.proto.shipping.ShippingServiceGrpc;
import com.vnshop.proto.shipping.ShippingRequest;
import com.vnshop.proto.shipping.ShippingResponse;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

@Component
@ConditionalOnBean(ShippingServiceGrpc.ShippingServiceBlockingStub.class)
public class GrpcShippingRequestAdapter implements ShippingRequestPort {

    private static final Logger LOGGER = LoggerFactory.getLogger(GrpcShippingRequestAdapter.class);

    private final ShippingServiceGrpc.ShippingServiceBlockingStub shippingStub;
    private final CircuitBreaker circuitBreaker;

    public GrpcShippingRequestAdapter(
            ShippingServiceGrpc.ShippingServiceBlockingStub shippingStub,
            CircuitBreaker shippingCircuitBreaker) {
        this.shippingStub = Objects.requireNonNull(shippingStub, "shippingStub is required");
        this.circuitBreaker = Objects.requireNonNull(shippingCircuitBreaker, "shippingCircuitBreaker is required");
    }

    @Override
    public void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress) {
        ShippingRequest request = ShippingRequest.newBuilder()
                .setOrderId(orderId)
                .addSubOrders(com.vnshop.proto.shipping.SubOrder.newBuilder()
                        .setSellerId(subOrder.sellerId())
                        .addAllItems(subOrder.items().stream().map(GrpcShippingRequestAdapter::toProtoItem).toList())
                        .setShippingAddress(toLegacyProtoAddress(shippingAddress))
                        .setDeclaredValue(toProtoMoney(subOrder.itemsTotal()))
                        .setCodAmount(toProtoMoney(subOrder.itemsTotal().add(subOrder.shippingCost())))
                        .build())
                .build();
        executeShipping(orderId, subOrder, request);
    }

    @Override
    public void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress, ShippingDetails shippingDetails) {
        requestShipping(orderId, subOrder, shippingAddress, shippingDetails,
                subOrder.itemsTotal().add(subOrder.shippingCost()), subOrder.itemsTotal());
    }

    @Override
    public void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress,
                                ShippingDetails shippingDetails, Money codAmount, Money declaredValue) {
        if (shippingDetails == null) {
            throw new IllegalStateException("carrier shipping details are required for live labels");
        }
        ShippingDetails parcelDetails = parcelFor(subOrder, shippingDetails);
        ShippingRequest request = ShippingRequest.newBuilder()
                .setOrderId(orderId)
                .addSubOrders(com.vnshop.proto.shipping.SubOrder.newBuilder()
                        .setSellerId(subOrder.sellerId())
                        .addAllItems(subOrder.items().stream()
                                .map(GrpcShippingRequestAdapter::toProtoItem)
                                .toList())
                        .setShippingAddress(toProtoAddress(shippingAddress, parcelDetails))
                        .setParcelWeightGrams(parcelDetails.weightGrams())
                        .setParcelLengthCm(parcelDetails.lengthCm())
                        .setParcelWidthCm(parcelDetails.widthCm())
                        .setParcelHeightCm(parcelDetails.heightCm())
                        .setDeclaredValue(toProtoMoney(declaredValue))
                        .setCodAmount(toProtoMoney(codAmount))
                        .build())
                .build();

        executeShipping(orderId, subOrder, request);
    }

    private void executeShipping(String orderId, SubOrder subOrder, ShippingRequest request) {
        try {
            ShippingResponse response = circuitBreaker.executeSupplier(() ->
                    shippingStub.withDeadlineAfter(5, TimeUnit.SECONDS).requestShipping(request));

            if (!response.getSuccess()) {
                LOGGER.warn("Shipping request failed for order {} seller {}", orderId, subOrder.sellerId());
                throw new IllegalStateException("Shipping service did not create labels for order " + orderId);
            } else {
                LOGGER.info("Shipping request submitted for order {} seller {} — {} label(s)",
                        orderId, subOrder.sellerId(), response.getLabelsCount());
            }
            if (response.getLabelsCount() != 1) {
                throw new IllegalStateException("Shipping service returned " + response.getLabelsCount()
                        + " labels for seller " + subOrder.sellerId());
            }
        } catch (CallNotPermittedException e) {
            LOGGER.error("Circuit breaker OPEN for shipping-service: {}", e.getMessage());
            throw new RuntimeException("Shipping service unavailable (circuit open)", e);
        } catch (StatusRuntimeException e) {
            LOGGER.error("gRPC shipping request failed: orderId={}, code={}, message={}",
                    orderId, e.getStatus().getCode(), e.getStatus().getDescription(), e);
            throw new RuntimeException("Shipping request failed for order " + orderId, e);
        }
    }

    private static com.vnshop.proto.shipping.SubOrderItem toProtoItem(OrderItem item) {
        return com.vnshop.proto.shipping.SubOrderItem.newBuilder()
                .setProductId(item.productId())
                .setVariant(item.variantSku())
                .setQuantity(item.quantity())
                .setDeclaredValue(toProtoMoney(item.totalPrice()))
                .build();
    }

    private static com.vnshop.proto.shipping.ShippingAddress toProtoAddress(Address address, ShippingDetails details) {
        return com.vnshop.proto.shipping.ShippingAddress.newBuilder()
                .setFullName(details.recipientName())
                .setPhone(details.recipientPhone())
                .setStreet(address.street())
                .setWardCode(details.wardCode())
                .setDistrictCode(details.districtCode())
                .setProvinceCode(details.provinceCode())
                .setCity(address.city())
                .setProvince(address.district())
                .build();
    }

    private static ShippingDetails parcelFor(SubOrder subOrder, ShippingDetails contact) {
        int units = subOrder.items().stream().mapToInt(OrderItem::quantity).sum();
        int weight = Math.max(contact.weightGrams(), Math.multiplyExact(500, units));
        int length = Math.max(contact.lengthCm(), 20 + Math.min(units, 5) * 2);
        int width = Math.max(contact.widthCm(), 20);
        int height = Math.max(contact.heightCm(), 10 + Math.min(units, 5) * 2);
        return new ShippingDetails(contact.recipientName(), contact.recipientPhone(), contact.wardCode(),
                contact.districtCode(), contact.provinceCode(), weight, length, width, height);
    }

    private static com.vnshop.proto.shipping.ShippingAddress toLegacyProtoAddress(Address address) {
        return com.vnshop.proto.shipping.ShippingAddress.newBuilder()
                .setStreet(address.street())
                .setWardCode(address.ward() == null ? "" : address.ward())
                .setDistrictCode(address.district())
                .setProvinceCode(address.city())
                .setCity(address.city())
                .setProvince(address.district())
                .build();
    }

    private static com.vnshop.proto.common.Money toProtoMoney(com.vnshop.orderservice.domain.Money money) {
        return com.vnshop.proto.common.Money.newBuilder()
                .setAmount(money.amount().toPlainString())
                .setCurrency(money.currency())
                .build();
    }
}
