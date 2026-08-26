package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.ParcelDimensions;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.orderservice.infrastructure.shipping.ShippingException;
import com.vnshop.proto.v1.ShippingServiceGrpc;
import com.vnshop.proto.v1.ShippingRequest;
import com.vnshop.proto.v1.ShippingResponse;
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
                .addSubOrders(com.vnshop.proto.v1.SubOrder.newBuilder()
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
            throw new ShippingException("SHIPPING_DETAILS_REQUIRED", "carrier shipping details are required", null);
        }
        ParcelDimensions parcel = subOrder.parcel();
        if (parcel == null) {
            throw new ShippingException("SHIPPING_PARCEL_REQUIRED", "trusted parcel metadata is required", null);
        }
        ShippingDetails parcelDetails = new ShippingDetails(
                shippingDetails.recipientName(), shippingDetails.recipientPhone(), shippingDetails.wardCode(),
                shippingDetails.districtCode(), shippingDetails.provinceCode(), parcel.weightGrams(),
                parcel.lengthCm(), parcel.widthCm(), parcel.heightCm());
        ShippingRequest request = ShippingRequest.newBuilder()
                .setOrderId(orderId)
                .addSubOrders(com.vnshop.proto.v1.SubOrder.newBuilder()
                        .setSellerId(subOrder.sellerId())
                        .addAllItems(subOrder.items().stream()
                                .map(GrpcShippingRequestAdapter::toProtoItem)
                                .toList())
                        .setShippingAddress(toProtoAddress(shippingAddress, parcelDetails))
                        .setParcelWeightGrams(parcelDetails.weightGrams())
                        .setParcelLengthCm(parcelDetails.lengthCm())
                        .setParcelWidthCm(parcelDetails.widthCm())
                         .setParcelHeightCm(parcelDetails.heightCm())
                         .setParcel(com.vnshop.proto.v1.Parcel.newBuilder()
                                 .setWeightGrams(parcel.weightGrams())
                                 .setLengthCm(parcel.lengthCm())
                                 .setWidthCm(parcel.widthCm())
                                 .setHeightCm(parcel.heightCm())
                                 .setDeclaredValueMinor(parcel.declaredValueMinor())
                                 .build())
                        .setDeclaredValue(toProtoMoney(declaredValue))
                        .setCodAmount(toProtoMoney(codAmount))
                        .build())
                .build();

        executeShipping(orderId, subOrder, request);
    }

    private void executeShipping(String orderId, SubOrder subOrder, ShippingRequest request) {
        try {
            ShippingResponse response = circuitBreaker.executeSupplier(() ->
                    shippingStub.withDeadlineAfter(2500, TimeUnit.MILLISECONDS).requestShipping(request));

            if (!response.getSuccess()) {
                LOGGER.warn("Shipping request failed for order {} seller {}", orderId, subOrder.sellerId());
                throw new ShippingException("SHIPPING_LABEL_CREATION_FAILED", "shipping label creation failed", null);
            } else {
                LOGGER.info("Shipping request submitted for order {} seller {} — {} label(s)",
                        orderId, subOrder.sellerId(), response.getLabelsCount());
            }
            if (response.getLabelsCount() != 1) {
                throw new ShippingException("SHIPPING_LABEL_COUNT_INVALID", "shipping service returned an invalid label count", null);
            }
        } catch (CallNotPermittedException e) {
            LOGGER.error("Circuit breaker OPEN for shipping-service orderId={} sellerId={} exceptionType={}",
                    orderId, subOrder.sellerId(), e.getClass().getSimpleName());
            throw new ShippingException("SHIPPING_SERVICE_UNAVAILABLE", "shipping service unavailable", e);
        } catch (StatusRuntimeException e) {
            LOGGER.error("gRPC shipping request failed: orderId={} sellerId={} code={} exceptionType={}",
                    orderId, subOrder.sellerId(), e.getStatus().getCode(), e.getClass().getSimpleName());
            throw new ShippingException("SHIPPING_REQUEST_FAILED", "shipping request failed", e);
        } catch (ShippingException e) {
            throw e;
        }
    }

    private static com.vnshop.proto.v1.SubOrderItem toProtoItem(OrderItem item) {
        return com.vnshop.proto.v1.SubOrderItem.newBuilder()
                .setProductId(item.productId())
                .setVariant(item.variantSku())
                .setQuantity(item.quantity())
                .setDeclaredValue(toProtoMoney(item.totalPrice()))
                .build();
    }

    private static com.vnshop.proto.v1.ShippingAddress toProtoAddress(Address address, ShippingDetails details) {
        return com.vnshop.proto.v1.ShippingAddress.newBuilder()
                .setFullName(details.recipientName())
                .setPhone(details.recipientPhone())
                .setStreet(address.street())
                .setWardCode(details.wardCode())
                .setDistrictCode(details.districtCode())
                .setProvinceCode(details.provinceCode())
                .setCity(address.city())
                .setProvince(address.city())
                .build();
    }

    private static com.vnshop.proto.v1.ShippingAddress toLegacyProtoAddress(Address address) {
        return com.vnshop.proto.v1.ShippingAddress.newBuilder()
                .setStreet(address.street())
                .setWardCode(address.ward() == null ? "" : address.ward())
                .setDistrictCode(address.district())
                .setProvinceCode(address.city())
                .setCity(address.city())
                .setProvince(address.district())
                .build();
    }

    private static com.vnshop.proto.v1.Money toProtoMoney(com.vnshop.orderservice.domain.Money money) {
        return com.vnshop.proto.v1.Money.newBuilder()
                .setAmount(money.amount().toPlainString())
                .setCurrency(money.currency())
                .build();
    }
}
