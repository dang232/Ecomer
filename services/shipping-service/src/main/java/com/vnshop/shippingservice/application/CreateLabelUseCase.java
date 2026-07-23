package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.CarrierCode;
import com.vnshop.shippingservice.domain.Money;
import com.vnshop.shippingservice.domain.ShippingAddress;
import com.vnshop.shippingservice.domain.ShippingLineItem;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.Parcel;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.domain.port.out.CarrierLabelPolicyPort;

import java.util.List;
import java.util.Objects;

/** Creates a carrier label through the configured carrier gateway. */
public class CreateLabelUseCase {
    private final CarrierGatewayPort carrierGateway;
    private final CarrierLabelPolicyPort carrierLabelPolicy;

    public CreateLabelUseCase(
            CarrierGatewayPort carrierGateway,
            CarrierLabelPolicyPort carrierLabelPolicy) {
        this.carrierGateway = Objects.requireNonNull(carrierGateway, "carrierGateway is required");
        this.carrierLabelPolicy = Objects.requireNonNull(carrierLabelPolicy, "carrierLabelPolicy is required");
    }

    public CreateLabelResult create(CreateLabelCommand command) {
        Objects.requireNonNull(command, "command is required");
        if (!carrierLabelPolicy.allowsIncompleteLabelData()) {
            validateCarrierFields(command);
        }

        ShippingLabel label = carrierGateway.createLabel(new LabelRequest(
                toGatewayCarrier(command.carrierCode()),
                command.orderId(),
                toGatewayAddress(command.origin()),
                toGatewayAddress(command.destination()),
                toGatewayParcel(command.parcel()),
                toVnd(command.codAmount()),
                itemDescription(command.items())));

        if (label == null || label.trackingCode() == null || label.trackingCode().isBlank()) {
            throw new IllegalStateException("Carrier did not return a tracking code");
        }

        return new CreateLabelResult(
                CarrierCode.valueOf(label.carrier().name()),
                command.orderId(), label.trackingCode(), label.trackingCode(), label.labelUrl());
    }

    private static com.vnshop.shippingservice.domain.model.CarrierCode toGatewayCarrier(CarrierCode carrier) {
        if (carrier == CarrierCode.LOCAL) {
            throw new IllegalArgumentException("LOCAL is not a carrier gateway code");
        }
        return com.vnshop.shippingservice.domain.model.CarrierCode.valueOf(carrier.name());
    }

    private static com.vnshop.shippingservice.domain.model.ShippingAddress toGatewayAddress(ShippingAddress address) {
        if (address == null) {
            return new com.vnshop.shippingservice.domain.model.ShippingAddress(null, null, null, null, null, null);
        }
        return new com.vnshop.shippingservice.domain.model.ShippingAddress(
                address.fullName(), address.phone(), address.addressLine(), address.wardCode(),
                address.districtCode(), address.provinceCode());
    }

    private static Parcel toGatewayParcel(com.vnshop.shippingservice.domain.Parcel parcel) {
        return parcel == null ? null : new Parcel(parcel.weightGrams(), parcel.lengthCm(), parcel.widthCm(), parcel.heightCm());
    }

    private static long toVnd(Money money) {
        if (money == null) {
            return 0L;
        }
        if (!"VND".equalsIgnoreCase(money.currency())) {
            throw new IllegalArgumentException("Carrier labels require VND amounts");
        }
        return money.amount().setScale(0, java.math.RoundingMode.UNNECESSARY).longValueExact();
    }

    private static String itemDescription(List<ShippingLineItem> items) {
        return (items == null ? List.<ShippingLineItem>of() : items).stream()
                .map(item -> item.name() + " x" + item.quantity())
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    private static void validateCarrierFields(CreateLabelCommand command) {
        requireNonBlank(command.orderId(), "orderId");
        requireAddress(command.origin(), "origin");
        requireAddress(command.destination(), "destination");
        if (command.parcel() == null || command.parcel().weightGrams() <= 0
                || command.parcel().lengthCm() <= 0 || command.parcel().widthCm() <= 0
                || command.parcel().heightCm() <= 0) {
            throw new IllegalArgumentException("parcel weight and dimensions are required for live carrier labels");
        }
        if (command.codAmount() == null || command.declaredValue() == null) {
            throw new IllegalArgumentException("COD amount and declared value are required for live carrier labels");
        }
    }

    private static void requireAddress(ShippingAddress address, String name) {
        if (address == null) {
            throw new IllegalArgumentException(name + " is required for live carrier labels");
        }
        requireNonBlank(address.fullName(), name + ".fullName");
        requireNonBlank(address.phone(), name + ".phone");
        requireNonBlank(address.addressLine(), name + ".addressLine");
        requireNonBlank(address.wardCode(), name + ".wardCode");
        requireNonBlank(address.districtCode(), name + ".districtCode");
        requireNonBlank(address.provinceCode(), name + ".provinceCode");
    }

    private static void requireNonBlank(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required for live carrier labels");
        }
    }
}
