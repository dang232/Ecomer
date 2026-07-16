package com.vnshop.paymentservice.infrastructure.web;

import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentMethodsControllerContractTest {

    @Test
    void methodsEndpointLivesUnderTheGatewayPaymentRoute() throws Exception {
        RequestMapping controllerMapping = PaymentMethodsController.class
                .getAnnotation(RequestMapping.class);
        Method method = PaymentMethodsController.class.getMethod("listMethods");
        GetMapping methodMapping = method.getAnnotation(GetMapping.class);

        assertThat(controllerMapping.value()).containsExactly("/payment");
        assertThat(methodMapping.value()).containsExactly("/methods");
    }
}
