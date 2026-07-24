package com.vnshop.sellerfinanceservice.infrastructure.scheduling;

import com.vnshop.sellerfinanceservice.application.ReleaseEligibleSettlementsUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "seller-finance.settlement-release", name = "enabled",
        havingValue = "true", matchIfMissing = true)
public class SettlementReleaseScheduler {
    private static final Logger LOGGER = LoggerFactory.getLogger(SettlementReleaseScheduler.class);
    private final ReleaseEligibleSettlementsUseCase useCase;

    public SettlementReleaseScheduler(ReleaseEligibleSettlementsUseCase useCase) {
        this.useCase = useCase;
    }

    @Scheduled(fixedDelayString = "${seller-finance.settlement-release.poll-interval-ms:60000}")
    public void releaseEligibleSettlements() {
        int released = useCase.releaseEligible();
        if (released > 0) LOGGER.info("settlement-release released={}", released);
    }
}
