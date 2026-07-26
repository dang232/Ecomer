-- BaseJpaEntity requires both audit columns. V18 created the outbox without them,
-- which caused the relay query to fail against existing databases.
ALTER TABLE payment_svc.financial_event_outbox
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE payment_svc.financial_event_outbox
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, created_at, NOW())
WHERE created_at IS NULL
   OR updated_at IS NULL;

ALTER TABLE payment_svc.financial_event_outbox
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL;
