package com.vnshop.shippingservice.infrastructure.carrier;

import com.vnshop.shippingservice.domain.exception.CarrierTrackingNotFoundException;
import com.vnshop.shippingservice.domain.model.CarrierCode;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.Parcel;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingAddress;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CarrierGatewaysTest {
    private final ShippingAddress origin = new ShippingAddress("Seller", "0900000000", "1 Origin", "101", "1442", "HCM");
    private final ShippingAddress destination = new ShippingAddress("Buyer", "0911111111", "2 Destination", "202", "1482", "Ha Noi");
    private final Parcel parcel = new Parcel(750, 20, 15, 10);

    @Test
    void ghnGatewayMapsQuoteLabelAndTracking() {
        FakeCarrierHttpClient client = new FakeCarrierHttpClient();
        client.postResponse = new GhnCarrierGateway.GhnFeeResponse(new GhnCarrierGateway.GhnFeeData(45_000L));
        GhnCarrierGateway gateway = new GhnCarrierGateway(client, new GhnProperties("https://ghn.test", "token", "123", "2", null));

        RateQuote quote = gateway.quote(new RateQuoteRequest(CarrierCode.GHN, origin, destination, parcel, 1_000_000L));

        assertThat(quote.totalFeeVnd()).isEqualTo(45_000L);
        assertThat(client.lastUrl).isEqualTo("https://ghn.test/shiip/public-api/v2/shipping-order/fee");
        assertThat(client.lastHeaders).containsEntry("Token", "token").containsEntry("ShopId", "123");

        client.postResponse = new GhnCarrierGateway.GhnCreateOrderResponse(new GhnCarrierGateway.GhnCreateOrderData("GHN123", "https://label.test/ghn", 47_000L));
        ShippingLabel label = gateway.createLabel(new LabelRequest(CarrierCode.GHN, "ORDER-1", origin, destination, parcel, 250_000L, "Shoes"));

        assertThat(label.trackingCode()).isEqualTo("GHN123");
        assertThat(label.labelUrl()).isEqualTo("https://label.test/ghn");
        assertThat(label.feeVnd()).isEqualTo(47_000L);

        client.postResponse = new GhnCarrierGateway.GhnTrackingResponse(new GhnCarrierGateway.GhnTrackingData("delivering", "Delivering", "2026-05-10T10:00:00Z", null));
        TrackingInfo tracking = gateway.track(new TrackingRequest(CarrierCode.GHN, "GHN123"));

        assertThat(tracking.status()).isEqualTo("delivering");
        assertThat(tracking.statusDescription()).isEqualTo("Delivering");
    }

    @Test
    void ghtkGatewayMapsQuoteLabelAndTracking() {
        FakeCarrierHttpClient client = new FakeCarrierHttpClient();
        client.postResponse = new GhtkCarrierGateway.GhtkFeeResponse(new GhtkCarrierGateway.GhtkFee(31_000L, "48h"));
        GhtkCarrierGateway gateway = new GhtkCarrierGateway(client, new GhtkProperties("https://ghtk.test", "ghtk-token", "partner", "ghtk-token"));

        RateQuote quote = gateway.quote(new RateQuoteRequest(CarrierCode.GHTK, origin, destination, parcel, 800_000L));

        assertThat(quote.totalFeeVnd()).isEqualTo(31_000L);
        assertThat(quote.estimatedDeliveryTime()).isEqualTo("48h");
        assertThat(client.lastUrl).isEqualTo("https://ghtk.test/services/shipment/fee");
        assertThat(client.lastHeaders).containsEntry("Token", "ghtk-token");

        client.postResponse = new GhtkCarrierGateway.GhtkCreateOrderResponse(new GhtkCarrierGateway.GhtkCreatedOrder("GHTK123", 33_000L));
        ShippingLabel label = gateway.createLabel(new LabelRequest(CarrierCode.GHTK, "ORDER-2", origin, destination, parcel, 150_000L, "Hat"));

        assertThat(label.trackingCode()).isEqualTo("GHTK123");
        assertThat(label.feeVnd()).isEqualTo(33_000L);

        client.getResponse = new GhtkCarrierGateway.GhtkTrackingResponse(new GhtkCarrierGateway.GhtkTrackedOrder("delivered", "Delivered", "2026-05-10T11:00:00Z", null));
        TrackingInfo tracking = gateway.track(new TrackingRequest(CarrierCode.GHTK, "GHTK123"));

        assertThat(tracking.status()).isEqualTo("delivered");
        assertThat(client.lastUrl).isEqualTo("https://ghtk.test/services/shipment/v2/GHTK123");
    }

    @Test
    void stubGatewayReturnsSyntheticEventsForKnownTrackingCodes() {
        StubCarrierGateway gateway = new StubCarrierGateway();

        TrackingInfo tracking = gateway.track(new TrackingRequest(CarrierCode.GHN, "GHN-OK-1"));

        assertThat(tracking.events())
                .as("stub must surface a synthetic timeline so the FE TrackingModal has data")
                .isNotEmpty();
        assertThat(tracking.events()).allSatisfy(event -> {
            assertThat(event.at()).isNotBlank();
            assertThat(event.status()).isNotBlank();
        });
        assertThat(tracking.status()).isNotBlank();
        assertThat(tracking.updatedAt()).isNotBlank();
    }

    @Test
    void stubGatewayThrowsNotFoundForMissingPrefix() {
        StubCarrierGateway gateway = new StubCarrierGateway();

        assertThatThrownBy(() -> gateway.track(new TrackingRequest(CarrierCode.GHN, "MISSING-XYZ")))
                .isInstanceOf(CarrierTrackingNotFoundException.class);
    }

    @Test
    void ghnGatewayMapsStatusLogsToEvents() {
        FakeCarrierHttpClient client = new FakeCarrierHttpClient();
        GhnCarrierGateway gateway = new GhnCarrierGateway(client, new GhnProperties("https://ghn.test", "token", "123", "2", null));

        List<GhnCarrierGateway.GhnStatusLog> logs = List.of(
                new GhnCarrierGateway.GhnStatusLog("2026-05-15T08:00:00Z", "picked_up", "Kho HCM", "Đã nhận hàng"),
                new GhnCarrierGateway.GhnStatusLog("2026-05-16T10:00:00Z", "delivering", "Bưu cục HN", "Đang giao")
        );
        client.postResponse = new GhnCarrierGateway.GhnTrackingResponse(
                new GhnCarrierGateway.GhnTrackingData("delivering", "Delivering", "2026-05-16T10:00:00Z", logs));

        TrackingInfo tracking = gateway.track(new TrackingRequest(CarrierCode.GHN, "GHN-EVT-1"));

        assertThat(tracking.events()).hasSize(2);
        assertThat(tracking.events().get(0).at()).isEqualTo("2026-05-15T08:00:00Z");
        assertThat(tracking.events().get(0).status()).isEqualTo("picked_up");
        assertThat(tracking.events().get(0).location()).isEqualTo("Kho HCM");
        assertThat(tracking.events().get(0).note()).isEqualTo("Đã nhận hàng");
        assertThat(tracking.events().get(1).status()).isEqualTo("delivering");
    }

    @Test
    void ghnGatewayThrowsNotFoundWhenDataIsNull() {
        FakeCarrierHttpClient client = new FakeCarrierHttpClient();
        GhnCarrierGateway gateway = new GhnCarrierGateway(client, new GhnProperties("https://ghn.test", "token", "123", "2", null));

        client.postResponse = new GhnCarrierGateway.GhnTrackingResponse(null);

        assertThatThrownBy(() -> gateway.track(new TrackingRequest(CarrierCode.GHN, "MISSING-GHN-1")))
                .isInstanceOf(CarrierTrackingNotFoundException.class)
                .hasMessageContaining("MISSING-GHN-1");
    }

    @Test
    void ghtkGatewayMapsLogEntriesToEvents() {
        FakeCarrierHttpClient client = new FakeCarrierHttpClient();
        GhtkCarrierGateway gateway = new GhtkCarrierGateway(client, new GhtkProperties("https://ghtk.test", "ghtk-token", "partner", "ghtk-token"));

        List<GhtkCarrierGateway.GhtkLogEntry> log = List.of(
                new GhtkCarrierGateway.GhtkLogEntry("2026-05-15T07:00:00Z", "2", "Đã lấy hàng"),
                new GhtkCarrierGateway.GhtkLogEntry("2026-05-16T09:00:00Z", "8", "Đang giao hàng")
        );
        client.getResponse = new GhtkCarrierGateway.GhtkTrackingResponse(
                new GhtkCarrierGateway.GhtkTrackedOrder("8", "Đang giao hàng", "2026-05-16T09:00:00Z", log));

        TrackingInfo tracking = gateway.track(new TrackingRequest(CarrierCode.GHTK, "GHTK-EVT-1"));

        assertThat(tracking.events()).hasSize(2);
        assertThat(tracking.events().get(0).at()).isEqualTo("2026-05-15T07:00:00Z");
        assertThat(tracking.events().get(0).status()).isEqualTo("2");
        assertThat(tracking.events().get(0).note()).isEqualTo("Đã lấy hàng");
        assertThat(tracking.events().get(1).status()).isEqualTo("8");
    }

    @Test
    void ghtkGatewayThrowsNotFoundWhenOrderIsNull() {
        FakeCarrierHttpClient client = new FakeCarrierHttpClient();
        GhtkCarrierGateway gateway = new GhtkCarrierGateway(client, new GhtkProperties("https://ghtk.test", "ghtk-token", "partner", "ghtk-token"));

        client.getResponse = new GhtkCarrierGateway.GhtkTrackingResponse(null);

        assertThatThrownBy(() -> gateway.track(new TrackingRequest(CarrierCode.GHTK, "MISSING-GHTK-1")))
                .isInstanceOf(CarrierTrackingNotFoundException.class)
                .hasMessageContaining("MISSING-GHTK-1");
    }

    private static class FakeCarrierHttpClient implements CarrierHttpClient {
        private String lastUrl;
        private Map<String, String> lastHeaders;
        private Object postResponse;
        private Object getResponse;

        @Override
        public <T> T post(String url, Map<String, String> headers, Object body, Class<T> responseType) {
            lastUrl = url;
            lastHeaders = headers;
            return responseType.cast(postResponse);
        }

        @Override
        public <T> T get(String url, Map<String, String> headers, Class<T> responseType) {
            lastUrl = url;
            lastHeaders = headers;
            return responseType.cast(getResponse);
        }
    }
}
