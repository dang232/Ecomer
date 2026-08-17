package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.exception.CarrierTrackingNotFoundException;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingEvent;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "shipping.carrier.mode", havingValue = "stub", matchIfMissing = true)
public class StubCarrierGateway implements CarrierGatewayPort {
    @Override
    public RateQuote quote(RateQuoteRequest request) {
        // Deterministic per-carrier pricing so the buyer sees a real choice
        // at checkout. Real GHN/GHTK adapters live behind the same port and
        // return their own fees; this stub mirrors the buyer-facing shape.
        // Weight surcharge: flat 5k VND per extra kg above 1kg — enough to
        // make heavy carts visibly more expensive than light ones in tests.
        long baseFee = switch (request.carrier()) {
            case GHN -> 30_000L;     // Standard tier — cheaper, slower
            case GHTK -> 45_000L;    // Express tier — pricier, faster
        };
        long weightSurcharge = 0L;
        if (request.parcel() != null && request.parcel().weightGrams() > 1000) {
            int extraKg = (request.parcel().weightGrams() - 1000 + 999) / 1000;
            weightSurcharge = 5_000L * extraKg;
        }
        String etaLabel = switch (request.carrier()) {
            case GHN -> "3-5 days";
            case GHTK -> "1-2 days";
        };
        String serviceCode = switch (request.carrier()) {
            case GHN -> "STANDARD";
            case GHTK -> "EXPRESS";
        };
        return new RateQuote(request.carrier(), baseFee + weightSurcharge, serviceCode, etaLabel);
    }

    @Override
    public ShippingLabel createLabel(LabelRequest request) {
        return new ShippingLabel(request.carrier(), request.orderId(), "STUB-" + request.orderId(), null, 30_000L);
    }

    @Override
    public void cancelLabel(com.vnshop.shippingservice.domain.model.CarrierCode carrier, String trackingCode) {
        // Stub labels are local and cancellation is deterministic.
    }

    @Override
    public TrackingInfo track(TrackingRequest request) {
        // Test hook: tracking codes that start with MISSING- model the real
        // carrier "we have never seen this code" response so the use case can
        // surface a 404 to the buyer. Anything else returns a normal stub.
        String code = request.trackingCode();
        if (code != null && code.startsWith("MISSING-")) {
            throw new CarrierTrackingNotFoundException("Stub carrier has no record of " + code);
        }
        // Synthetic timeline so dev/FE work isn't stuck on an empty list.
        // Vietnamese carrier vocabulary keeps it realistic for the FE
        // TrackingModal which renders these strings directly.
        List<TrackingEvent> events = List.of(
                new TrackingEvent("2026-05-15T08:00:00Z", "PICKED_UP", "Kho HCM", "Đã nhận hàng từ người bán"),
                new TrackingEvent("2026-05-16T09:30:00Z", "IN_TRANSIT", "Trung chuyển Đà Nẵng", "Đang vận chuyển"),
                new TrackingEvent("2026-05-17T07:15:00Z", "OUT_FOR_DELIVERY", "Bưu cục Hà Nội", "Đang giao hàng")
        );
        return new TrackingInfo(request.carrier(), code, "OUT_FOR_DELIVERY", "Stub shipment in transit", "2026-05-17T07:15:00Z", events);
    }
}
