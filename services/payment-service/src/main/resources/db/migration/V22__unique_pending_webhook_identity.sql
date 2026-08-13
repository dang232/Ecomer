WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY webhook_id, provider
               ORDER BY CASE status
                            WHEN 'PROCESSED' THEN 0
                            WHEN 'PENDING' THEN 1
                            WHEN 'PROCESSING' THEN 2
                            WHEN 'FAILED' THEN 3
                            ELSE 4
                        END,
                        created_at,
                        id
           ) AS duplicate_rank
    FROM payment_svc.pending_webhooks
)
DELETE FROM payment_svc.pending_webhooks
WHERE id IN (SELECT id FROM ranked WHERE duplicate_rank > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_webhooks_webhook_provider
    ON payment_svc.pending_webhooks (webhook_id, provider);
