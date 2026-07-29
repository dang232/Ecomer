CREATE TABLE IF NOT EXISTS payment_svc.payment_callback_events (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    payment_id uuid NOT NULL,
    correlation_key VARCHAR(255) NOT NULL,
    event_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ux_payment_callback_events_correlation_status
        UNIQUE (provider, payment_id, correlation_key, event_status)
);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_payment_id
    ON payment_svc.payment_callback_events (payment_id, created_at);

CREATE OR REPLACE FUNCTION payment_svc.prevent_payment_callback_events_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'payment_callback_events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_payment_callback_events_update
    BEFORE UPDATE ON payment_svc.payment_callback_events
    FOR EACH ROW EXECUTE FUNCTION payment_svc.prevent_payment_callback_events_mutation();

CREATE TRIGGER trg_prevent_payment_callback_events_delete
    BEFORE DELETE ON payment_svc.payment_callback_events
    FOR EACH ROW EXECUTE FUNCTION payment_svc.prevent_payment_callback_events_mutation();
