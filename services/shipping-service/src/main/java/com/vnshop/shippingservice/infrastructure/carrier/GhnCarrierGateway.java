package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.exception.CarrierTrackingNotFoundException;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingEvent;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "shipping.carrier.mode", havingValue = "live")
public class GhnCarrierGateway implements CarrierGatewayAdapter {
    private final CarrierHttpClient httpClient;
    private final GhnProperties properties;

    public GhnCarrierGateway(CarrierHttpClient httpClient, GhnProperties properties) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient is required");
        this.properties = Objects.requireNonNull(properties, "properties is required");
    }

    @Override
    public RateQuote quote(RateQuoteRequest request) {
        GhnFeeResponse response = httpClient.post(url("/shiip/public-api/v2/shipping-order/fee"), headers(), new GhnFeeRequest(
                parseInt(request.fromAddress().district(), "from district"),
                request.fromAddress().ward(),
                parseInt(request.toAddress().district(), "to district"),
                request.toAddress().ward(),
                parseInt(properties.serviceTypeId(), "GHN serviceTypeId"),
                request.parcel().weightGrams(),
                request.parcel().lengthCm(),
                request.parcel().widthCm(),
                request.parcel().heightCm(),
                request.declaredValueVnd()), GhnFeeResponse.class);

        return new RateQuote(request.carrier(), response.data().total(), properties.serviceTypeId(), null);
    }

    @Override
    public ShippingLabel createLabel(LabelRequest request) {
        GhnCreateOrderResponse response = httpClient.post(url("/shiip/public-api/v2/shipping-order/create"), headers(), new GhnCreateOrderRequest(
                2,
                "KHONGCHOXEMHANG",
                request.orderId(),
                request.fromAddress().name(),
                request.fromAddress().phone(),
                request.fromAddress().street(),
                request.fromAddress().ward(),
                request.fromAddress().district(),
                request.fromAddress().province(),
                request.toAddress().name(),
                request.toAddress().phone(),
                request.toAddress().street(),
                request.toAddress().ward(),
                request.toAddress().district(),
                request.toAddress().province(),
                request.codAmountVnd(),
                request.itemDescription(),
                request.parcel().weightGrams(),
                request.parcel().lengthCm(),
                 request.parcel().widthCm(),
                 request.parcel().heightCm(),
                 parseInt(properties.serviceTypeId(), "GHN serviceTypeId"),
                 request.declaredValueVnd()), GhnCreateOrderResponse.class);

        return new ShippingLabel(request.carrier(), request.orderId(), response.data().orderCode(), response.data().label(), response.data().totalFee());
    }

    @Override
    public TrackingInfo track(TrackingRequest request) {
        GhnTrackingResponse response = httpClient.post(url("/shiip/public-api/v2/shipping-order/detail"), headers(), Map.of("order_code", request.trackingCode()), GhnTrackingResponse.class);
        if (response.data() == null) {
            throw new CarrierTrackingNotFoundException("GHN has no record of tracking code: " + request.trackingCode());
        }
        GhnTrackingData data = response.data();
        List<TrackingEvent> events = data.orderStatusLogs() == null ? List.of() :
                data.orderStatusLogs().stream()
                        .map(log -> new TrackingEvent(log.updatedDate(), log.status(), log.updatedWarehouse(), log.note()))
                        .toList();
        return new TrackingInfo(request.carrier(), request.trackingCode(), data.status(), data.statusName(), data.updatedDate(), events);
    }

    private Map<String, String> headers() {
        return Map.of(
                "Token", CarrierConfig.require(properties.token(), "GHN token"),
                "ShopId", CarrierConfig.require(properties.shopId(), "GHN shopId")
        );
    }

    private String url(String path) {
        return CarrierConfig.require(properties.baseUrl(), "GHN baseUrl") + path;
    }

    private static int parseInt(String value, String name) {
        try {
            return Integer.parseInt(CarrierConfig.require(value, name));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(name + " must be numeric", exception);
        }
    }

    record GhnFeeRequest(int fromDistrictId, String fromWardCode, int toDistrictId, String toWardCode,
                         int serviceTypeId, int weight, int length, int width, int height, long insuranceValue) {
    }

    record GhnFeeResponse(GhnFeeData data) {
    }

    record GhnFeeData(long total) {
    }

    record GhnCreateOrderRequest(int paymentTypeId, String requiredNote, String clientOrderCode,
                                 String fromName, String fromPhone, String fromAddress, String fromWardName,
                                 String fromDistrictName, String fromProvinceName, String toName, String toPhone,
                                 String toAddress, String toWardName, String toDistrictName, String toProvinceName,
                                 long codAmount, String content, int weight, int length, int width, int height,
                                  int serviceTypeId, @JsonProperty("insurance_value") long insuranceValue) {
    }

    record GhnCreateOrderResponse(GhnCreateOrderData data) {
    }

    record GhnCreateOrderData(String orderCode, String label, long totalFee) {
    }

    record GhnTrackingResponse(GhnTrackingData data) {
    }

    record GhnTrackingData(String status, String statusName, String updatedDate, List<GhnStatusLog> orderStatusLogs) {
    }

    record GhnStatusLog(String updatedDate, String status, String updatedWarehouse, String note) {
    }
}
