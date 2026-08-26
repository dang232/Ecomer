ALTER TABLE order_svc.saga_state
    ADD COLUMN IF NOT EXISTS required_steps JSONB NOT NULL DEFAULT '{}'::jsonb;
