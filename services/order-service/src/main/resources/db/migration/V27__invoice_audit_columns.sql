-- InvoiceJpaEntity inherits these mandatory columns from BaseJpaEntity, while
-- the original invoice migration predates that shared persistence contract.
ALTER TABLE order_svc.invoices
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

UPDATE order_svc.invoices
   SET created_at = COALESCE(created_at, generated_at, NOW()),
       updated_at = COALESCE(updated_at, generated_at, NOW())
 WHERE created_at IS NULL OR updated_at IS NULL;

ALTER TABLE order_svc.invoices
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL;
