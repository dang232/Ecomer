package com.vnshop.paymentservice.infrastructure.webhook;

/** Processes a previously verified webhook payload synchronously. */
@FunctionalInterface
public interface PendingWebhookRetryProcessor {
    void process(PendingWebhookRetryEvent event);
}
