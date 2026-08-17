package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.exception.CarrierTrackingNotFoundException;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingEvent;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "shipping.carrier.mode", havingValue = "live")
public class GhtkCarrierGateway implements CarrierGatewayAdapter {
    private final CarrierHttpClient httpClient;
    private final GhtkProperties properties;

    public GhtkCarrierGateway(CarrierHttpClient httpClient, GhtkProperties properties) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient is required");
        this.properties = Objects.requireNonNull(properties, "properties is required");
    }

    @Override
    public RateQuote quote(RateQuoteRequest request) {
        GhtkFeeResponse response = httpClient.post(url("/services/shipment/fee"), headers(), new GhtkFeeRequest(
                request.fromAddress().province(),
                request.fromAddress().district(),
                request.toAddress().province(),
                request.toAddress().district(),
                request.toAddress().street(),
                request.parcel().weightGrams(),
                request.declaredValueVnd(),
                "road"), GhtkFeeResponse.class);

        return new RateQuote(request.carrier(), response.fee().fee(), "road", response.fee().delivery());
    }

    @Override
    public ShippingLabel createLabel(LabelRequest request) {
        GhtkCreateOrderResponse response = httpClient.post(url("/services/shipment/order"), headers(), new GhtkCreateOrderRequest(
                List.of(new GhtkProduct(request.itemDescription(), request.parcel().weightGrams(), 1)),
                new GhtkOrder(
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
                        "Khac",
                        "0",
                         request.codAmountVnd(),
                         request.declaredValueVnd(),
                        "road")), GhtkCreateOrderResponse.class);

        return new ShippingLabel(request.carrier(), request.orderId(), response.order().label(), response.order().label(), response.order().fee());
    }

    @Override
    public TrackingInfo track(TrackingRequest request) {
        GhtkTrackingResponse response = httpClient.get(url("/services/shipment/v2/" + request.trackingCode()), headers(), GhtkTrackingResponse.class);
        if (response.order() == null) {
            throw new CarrierTrackingNotFoundException("GHTK has no record of tracking code: " + request.trackingCode());
        }
        GhtkTrackedOrder order = response.order();
        List<TrackingEvent> events = order.log() == null ? List.of() :
                order.log().stream()
                        .map(entry -> new TrackingEvent(entry.updatedDate(), entry.status(), null, entry.statusText()))
                        .toList();
        return new TrackingInfo(request.carrier(), request.trackingCode(), order.status(), order.statusText(), order.modified(), events);
    }

    private Map<String, String> headers() {
        return Map.of("Token", CarrierConfig.require(properties.token(), "GHTK token"));
    }

    private String url(String path) {
        return CarrierConfig.require(properties.baseUrl(), "GHTK baseUrl") + path;
    }

    record GhtkFeeRequest(String pickProvince, String pickDistrict, String province, String district,
                          String address, int weight, long value, String transport) {
    }

    record GhtkFeeResponse(GhtkFee fee) {
    }

    record GhtkFee(long fee, String delivery) {
    }

    record GhtkCreateOrderRequest(List<GhtkProduct> products, GhtkOrder order) {
    }

    record GhtkProduct(String name, int weight, int quantity) {
    }

    record GhtkOrder(String id, String pickName, String pickTel, String pickAddress, String pickWard,
                     String pickDistrict, String pickProvince, String name, String tel, String address,
                     String ward, String district, String province, String hamlet, String isFreeship,
                     long pickMoney, long value, String transport) {
    }

    record GhtkCreateOrderResponse(GhtkCreatedOrder order) {
    }

    record GhtkCreatedOrder(String label, long fee) {
    }

    record GhtkTrackingResponse(GhtkTrackedOrder order) {
    }

    record GhtkTrackedOrder(String status, String statusText, String modified, List<GhtkLogEntry> log) {
    }

    record GhtkLogEntry(String updatedDate, String status, String statusText) {
    }
}
