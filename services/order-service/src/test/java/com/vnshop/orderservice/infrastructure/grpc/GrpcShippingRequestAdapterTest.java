package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.ParcelDimensions;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.proto.shipping.ShippingServiceGrpc;
import com.vnshop.proto.shipping.ShippingRequest;
import com.vnshop.proto.shipping.ShippingResponse;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrpcShippingRequestAdapterTest {

    @Mock
    private ShippingServiceGrpc.ShippingServiceBlockingStub shippingStub;

    private GrpcShippingRequestAdapter adapter;

    @Captor
    private ArgumentCaptor<ShippingRequest> requestCaptor;

    @BeforeEach
    void setUp() {
        adapter = new GrpcShippingRequestAdapter(
                shippingStub,
                CircuitBreaker.ofDefaults("shipping-request-test"));
        lenient().when(shippingStub.withDeadlineAfter(anyLong(), any())).thenReturn(shippingStub);
    }

    @Test
    void shouldSendShippingRequestWithCorrectOrderIdAndSellerId() {
        Address address = new Address("123 Main St", "Ward 1", "District X", "Hanoi");
        OrderItem item = new OrderItem("prod-1", "sku-red", "seller-1", "T-Shirt", 2,
                new Money(new BigDecimal("100000")), "https://img.example.com/tshirt.jpg");
        SubOrder subOrder = new SubOrder("seller-1", List.of(item));

        ShippingResponse response = ShippingResponse.newBuilder()
                .setSuccess(true)
                .addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder()
                        .setTrackingCode("TRACK-001")
                        .setCarrier("GHTK")
                        .setEstimatedDelivery("2026-05-20")
                        .build())
                .build();
        when(shippingStub.requestShipping(any())).thenReturn(response);

        adapter.requestShipping("order-42", subOrder, address);

        verify(shippingStub).requestShipping(requestCaptor.capture());
        ShippingRequest sent = requestCaptor.getValue();

        assertEquals("order-42", sent.getOrderId());
        assertEquals(1, sent.getSubOrdersCount());
        com.vnshop.proto.shipping.SubOrder sentSub = sent.getSubOrders(0);
        assertEquals("seller-1", sentSub.getSellerId());
        assertEquals(1, sentSub.getItemsCount());
        com.vnshop.proto.shipping.SubOrderItem sentItem = sentSub.getItems(0);
        assertEquals("prod-1", sentItem.getProductId());
        assertEquals("sku-red", sentItem.getVariant());
        assertEquals(2, sentItem.getQuantity());
        assertEquals("200000", sentItem.getDeclaredValue().getAmount());
        assertEquals("VND", sentItem.getDeclaredValue().getCurrency());
        assertEquals("200000", sentSub.getDeclaredValue().getAmount());
        assertEquals("200000", sentSub.getCodAmount().getAmount());
    }

    @Test
    void shouldMapShippingAddressCorrectly() {
        Address address = new Address("456 Side St", "Ward 2", "District Y", "HCMC");
        OrderItem item = new OrderItem("prod-2", "sku-blue", "seller-2", "Jeans", 1,
                new Money(new BigDecimal("200000")), "https://img.example.com/jeans.jpg");
        SubOrder subOrder = new SubOrder("seller-2", List.of(item));

        ShippingResponse response = ShippingResponse.newBuilder()
                .setSuccess(true)
                .addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder()
                        .setTrackingCode("TRACK-002")
                        .setCarrier("GHN")
                        .build())
                .build();
        when(shippingStub.requestShipping(any())).thenReturn(response);

        adapter.requestShipping("order-99", subOrder, address);

        verify(shippingStub).requestShipping(requestCaptor.capture());
        ShippingRequest sent = requestCaptor.getValue();

        com.vnshop.proto.shipping.SubOrder sentSub = sent.getSubOrders(0);
        com.vnshop.proto.shipping.ShippingAddress sentAddr = sentSub.getShippingAddress();

        assertEquals("456 Side St", sentAddr.getStreet());
        assertEquals("HCMC", sentAddr.getCity());
        assertEquals("District Y", sentAddr.getProvince());
        assertEquals("Ward 2", sentAddr.getWardCode());
        assertEquals("District Y", sentAddr.getDistrictCode());
        assertEquals("HCMC", sentAddr.getProvinceCode());
    }

    @Test
    void shouldMapLiveCarrierContactCodesAndParcelDetails() {
        Address address = new Address("12 Carrier St", "Ward name", "District name", "Hanoi");
        ShippingDetails details = new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001", 9999, 99, 98, 97);
        OrderItem item = new OrderItem("prod-live", "sku-live", "seller-live", "Jacket", 1,
                new Money(new BigDecimal("350000")), null, new ParcelDimensions(1500, 30, 20, 10));
        SubOrder subOrder = new SubOrder("seller-live", List.of(item));

        when(shippingStub.requestShipping(any())).thenReturn(ShippingResponse.newBuilder()
                .setSuccess(true)
                .addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder().setTrackingCode("TRACK-LIVE").build())
                .build());

        adapter.requestShipping("order-live", subOrder, address, details);

        verify(shippingStub).requestShipping(requestCaptor.capture());
        com.vnshop.proto.shipping.SubOrder sentSub = requestCaptor.getValue().getSubOrders(0);
        com.vnshop.proto.shipping.ShippingAddress sentAddress = sentSub.getShippingAddress();

        assertEquals("Nguyen Van A", sentAddress.getFullName());
        assertEquals("+84912345678", sentAddress.getPhone());
        assertEquals("Hanoi", sentAddress.getCity());
        assertEquals("Hanoi", sentAddress.getProvince());
        assertEquals("W-001", sentAddress.getWardCode());
        assertEquals("D-001", sentAddress.getDistrictCode());
        assertEquals("P-001", sentAddress.getProvinceCode());
        assertEquals(1500, sentSub.getParcelWeightGrams());
        assertEquals(30, sentSub.getParcelLengthCm());
        assertEquals(20, sentSub.getParcelWidthCm());
        assertEquals(10, sentSub.getParcelHeightCm());
        assertEquals("350000", sentSub.getDeclaredValue().getAmount());
        assertEquals("350000", sentSub.getCodAmount().getAmount());
    }

    @Test
    void shouldRejectLiveShippingWhenCarrierDetailsAreAbsent() {
        Address address = new Address("12 Carrier St", "Ward name", "District name", "Hanoi");
        OrderItem item = new OrderItem("prod-live", "sku-live", "seller-live", "Jacket", 1,
                new Money(new BigDecimal("350000")), null);
        SubOrder subOrder = new SubOrder("seller-live", List.of(item));

        assertThrows(IllegalStateException.class,
                () -> adapter.requestShipping("order-live", subOrder, address, null));
    }

    @Test
    void shouldRejectLiveShippingWithoutTrustedParcelBeforeGrpcCall() {
        Address address = new Address("12 Carrier St", "Ward name", "District name", "Hanoi");
        ShippingDetails details = new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001", 9999, 99, 98, 97);
        OrderItem item = new OrderItem("prod-live", "sku-live", "seller-live", "Jacket", 1,
                new Money(new BigDecimal("350000")), null);
        SubOrder subOrder = new SubOrder("seller-live", List.of(item));

        assertThrows(IllegalStateException.class,
                () -> adapter.requestShipping("order-live", subOrder, address, details));

        verify(shippingStub, never()).requestShipping(any());
    }

    @Test
    void shouldAggregateWeightAndMaximumDimensionsPerSeller() {
        Address address = new Address("12 Carrier St", "Ward name", "District name", "Hanoi");
        ShippingDetails details = new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001", 9999, 99, 98, 97);
        OrderItem first = new OrderItem("prod-1", "sku-1", "seller-1", "Box 1", 2,
                new Money(new BigDecimal("100000")), null, new ParcelDimensions(500, 10, 20, 30));
        OrderItem second = new OrderItem("prod-2", "sku-2", "seller-1", "Box 2", 1,
                new Money(new BigDecimal("200000")), null, new ParcelDimensions(800, 25, 15, 35));
        SubOrder subOrder = new SubOrder("seller-1", List.of(first, second));
        when(shippingStub.requestShipping(any())).thenReturn(ShippingResponse.newBuilder()
                .setSuccess(true)
                .addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder().setTrackingCode("TRACK").build())
                .build());

        adapter.requestShipping("order-aggregate", subOrder, address, details);

        verify(shippingStub).requestShipping(requestCaptor.capture());
        com.vnshop.proto.shipping.SubOrder sentSub = requestCaptor.getValue().getSubOrders(0);
        assertEquals(1800, sentSub.getParcelWeightGrams());
        assertEquals(25, sentSub.getParcelLengthCm());
        assertEquals(20, sentSub.getParcelWidthCm());
        assertEquals(35, sentSub.getParcelHeightCm());
    }

    @Test
    void shouldKeepParcelAggregationLocalToEachSellerSubOrder() {
        Address address = new Address("12 Carrier St", "Ward name", "District name", "Hanoi");
        ShippingDetails details = new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001", 9999, 99, 98, 97);
        OrderItem sellerOneItem = new OrderItem("prod-1", "sku-1", "seller-1", "Box 1", 1,
                new Money(new BigDecimal("100000")), null, new ParcelDimensions(500, 10, 11, 12));
        OrderItem sellerTwoItem = new OrderItem("prod-2", "sku-2", "seller-2", "Box 2", 1,
                new Money(new BigDecimal("200000")), null, new ParcelDimensions(900, 20, 21, 22));
        when(shippingStub.requestShipping(any())).thenReturn(ShippingResponse.newBuilder()
                .setSuccess(true)
                .addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder().setTrackingCode("TRACK").build())
                .build());

        adapter.requestShipping("order-sellers", new SubOrder("seller-1", List.of(sellerOneItem)), address, details);
        adapter.requestShipping("order-sellers", new SubOrder("seller-2", List.of(sellerTwoItem)), address, details);

        var requests = org.mockito.Mockito.mockingDetails(shippingStub).getInvocations().stream()
                .filter(invocation -> invocation.getMethod().getName().equals("requestShipping"))
                .toList();
        assertEquals(2, requests.size());
        ShippingRequest firstRequest = (ShippingRequest) requests.get(0).getArguments()[0];
        ShippingRequest secondRequest = (ShippingRequest) requests.get(1).getArguments()[0];
        assertEquals(500, firstRequest.getSubOrders(0).getParcelWeightGrams());
        assertEquals(900, secondRequest.getSubOrders(0).getParcelWeightGrams());
    }

    @Test
    void shouldHandleMultipleItemsInSubOrder() {
        Address address = new Address("789 Third Ave", "Ward 3", "District Z", "Danang");
        OrderItem item1 = new OrderItem("prod-3", "sku-green", "seller-3", "Hat", 3,
                new Money(new BigDecimal("50000")), "https://img.example.com/hat.jpg");
        OrderItem item2 = new OrderItem("prod-4", "sku-black", "seller-3", "Belt", 1,
                new Money(new BigDecimal("80000")), "https://img.example.com/belt.jpg");
        SubOrder subOrder = new SubOrder("seller-3", List.of(item1, item2));

        ShippingResponse response = ShippingResponse.newBuilder()
                .setSuccess(true)
                .addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder()
                        .setTrackingCode("TRACK-003")
                        .setCarrier("GHN")
                        .build())
                .build();
        when(shippingStub.requestShipping(any())).thenReturn(response);

        adapter.requestShipping("order-multi", subOrder, address);

        verify(shippingStub).requestShipping(requestCaptor.capture());
        ShippingRequest sent = requestCaptor.getValue();

        assertEquals(1, sent.getSubOrdersCount());
        com.vnshop.proto.shipping.SubOrder sentSub = sent.getSubOrders(0);
        assertEquals(2, sentSub.getItemsCount());
        assertEquals("prod-3", sentSub.getItems(0).getProductId());
        assertEquals("prod-4", sentSub.getItems(1).getProductId());
    }

    @Test
    void shouldFailSoTheOrderSagaCanCompensateWhenShippingRejectsTheRequest() {
        Address address = new Address("123 Main St", "Ward 1", "District X", "Hanoi");
        OrderItem item = new OrderItem("prod-1", "sku-red", "seller-1", "T-Shirt", 1,
                new Money(new BigDecimal("100000")), "https://img.example.com/tshirt.jpg");
        SubOrder subOrder = new SubOrder("seller-1", List.of(item));
        when(shippingStub.requestShipping(any())).thenReturn(ShippingResponse.newBuilder().setSuccess(false).build());

        assertThrows(IllegalStateException.class,
                () -> adapter.requestShipping("order-rejected", subOrder, address));
    }

    @Test
    void shouldFailSoTheOrderSagaCanCompensateWhenNoLabelIsReturned() {
        Address address = new Address("123 Main St", "Ward 1", "District X", "Hanoi");
        OrderItem item = new OrderItem("prod-1", "sku-red", "seller-1", "T-Shirt", 1,
                new Money(new BigDecimal("100000")), "https://img.example.com/tshirt.jpg");
        SubOrder subOrder = new SubOrder("seller-1", List.of(item));
        when(shippingStub.requestShipping(any())).thenReturn(ShippingResponse.newBuilder().setSuccess(true).build());

        assertThrows(IllegalStateException.class,
                () -> adapter.requestShipping("order-no-label", subOrder, address));
    }
}
