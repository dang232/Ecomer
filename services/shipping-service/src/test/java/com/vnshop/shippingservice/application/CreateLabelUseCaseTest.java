package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.CarrierCode;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.infrastructure.config.CarrierProperties;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class CreateLabelUseCaseTest {

    @Test
    void rejectsIncompleteCarrierDataOutsideTheExplicitLocalStubBoundary() {
        CarrierGatewayPort gateway = mock(CarrierGatewayPort.class);
        CreateLabelUseCase useCase = new CreateLabelUseCase(
                gateway, new CarrierProperties("live"), new StandardEnvironment());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> useCase.create(new CreateLabelCommand(CarrierCode.GHN, "order-1", null, null,
                        null, null, null, java.util.List.of())));

        org.junit.jupiter.api.Assertions.assertTrue(exception.getMessage().contains("origin"));
        verifyNoInteractions(gateway);
    }

    @Test
    void doesNotTreatStubModeAsLocalWithoutAnActiveLocalProfile() {
        CarrierGatewayPort gateway = mock(CarrierGatewayPort.class);
        CreateLabelUseCase useCase = new CreateLabelUseCase(
                gateway, new CarrierProperties("stub"), new StandardEnvironment());

        assertThrows(IllegalArgumentException.class,
                () -> useCase.create(new CreateLabelCommand(CarrierCode.GHN, "order-1", null, null,
                        null, null, null, java.util.List.of())));
        verifyNoInteractions(gateway);
    }
}
