CREATE TABLE inventory_svc.reservation_operations (
    operation_id   TEXT PRIMARY KEY,
    request_hash   CHAR(64) NOT NULL,
    success        BOOLEAN NOT NULL,
    reserved_items INTEGER NOT NULL,
    status         TEXT NOT NULL,
    failure_code   TEXT NOT NULL,
    processed_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_reservation_operations_processed_at
    ON inventory_svc.reservation_operations (processed_at);
