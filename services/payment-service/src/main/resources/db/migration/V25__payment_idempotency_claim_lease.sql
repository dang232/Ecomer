ALTER TABLE payment_svc.payment_idempotency_keys
    ALTER COLUMN lease_until SET DEFAULT (NOW() + INTERVAL '15 minutes');
