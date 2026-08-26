package com.vnshop.orderservice.application.saga;

import com.vnshop.orderservice.domain.saga.SagaStepStatus;
import java.util.LinkedHashMap;
import java.util.Map;

final class SagaCompensationPolicy {
    private SagaCompensationPolicy() {
    }

    static Map<String, SagaStepStatus> requiredStepsFor(String failedStep) {
        Map<String, SagaStepStatus> steps = new LinkedHashMap<>();
        switch (failedStep) {
            case "SHIPPING" -> {
                steps.put("INVENTORY", SagaStepStatus.REQUESTED);
                steps.put("PAYMENT", SagaStepStatus.REQUESTED);
                steps.put("SHIPPING", SagaStepStatus.REQUESTED);
            }
            case "PAYMENT", "PAYMENT_CHARGE" -> steps.put("INVENTORY", SagaStepStatus.REQUESTED);
            case "INVENTORY" -> { }
            default -> { }
        }
        return steps;
    }

    static String compensationStepName(String confirmation) {
        if (confirmation == null) {
            return null;
        }
        return switch (confirmation) {
            case "inventory.released", "INVENTORY", "INVENTORY_RELEASE" -> "INVENTORY";
            case "payment.refunded", "PAYMENT", "PAYMENT_REFUND" -> "PAYMENT";
            case "shipping.cancelled", "SHIPPING", "SHIPPING_CANCEL" -> "SHIPPING";
            default -> null;
        };
    }

    static boolean allRequiredStepsCompleted(Map<String, SagaStepStatus> requiredSteps) {
        return !requiredSteps.isEmpty() && requiredSteps.values().stream()
                .allMatch(status -> status == SagaStepStatus.COMPLETED);
    }
}
