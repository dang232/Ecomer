package com.vnshop.sellerfinanceservice.infrastructure.config;

import com.vnshop.sellerfinanceservice.domain.CommissionTier;
import com.vnshop.sellerfinanceservice.domain.port.out.CommissionRatePort;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "vnshop.commission")
public class CommissionRateConfig implements CommissionRatePort {
    private Map<CommissionTier, BigDecimal> tiers;

    public Map<CommissionTier, BigDecimal> getTiers() {
        return tiers;
    }

    public void setTiers(Map<CommissionTier, BigDecimal> tiers) {
        this.tiers = tiers;
    }

    @Override
    public BigDecimal rateFor(CommissionTier tier) {
        BigDecimal rate = tiers.get(tier);
        if (rate == null) {
            throw new IllegalStateException("No commission rate configured for tier: " + tier);
        }
        return rate;
    }
}
