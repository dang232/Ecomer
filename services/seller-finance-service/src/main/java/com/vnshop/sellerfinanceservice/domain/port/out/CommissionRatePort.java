package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.CommissionTier;
import java.math.BigDecimal;

@FunctionalInterface
public interface CommissionRatePort {
    BigDecimal rateFor(CommissionTier tier);
}
