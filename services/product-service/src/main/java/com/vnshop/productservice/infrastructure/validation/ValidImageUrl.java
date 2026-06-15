package com.vnshop.productservice.infrastructure.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Constraint annotation that validates image URLs belong to the application's
 * configured object-storage origins. Prevents open-redirect / SSRF attacks
 * via arbitrary URLs in product image fields.
 */
@Documented
@Constraint(validatedBy = ImageUrlValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidImageUrl {
    String message() default "Image URL must reference application storage";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
