ALTER TABLE invoices ADD COLUMN buyer_id VARCHAR(64);

UPDATE invoices
SET buyer_id = 'legacy-unknown'
WHERE buyer_id IS NULL;

ALTER TABLE invoices ALTER COLUMN buyer_id SET NOT NULL;

CREATE INDEX idx_invoices_buyer_id ON invoices (buyer_id);
