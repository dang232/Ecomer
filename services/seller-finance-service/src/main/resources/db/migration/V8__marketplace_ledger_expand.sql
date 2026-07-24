CREATE SCHEMA IF NOT EXISTS seller_finance_svc;

CREATE TABLE IF NOT EXISTS seller_finance_svc.ledger_accounts (
    account_code VARCHAR(64) PRIMARY KEY,
    account_type VARCHAR(32) NOT NULL,
    CONSTRAINT chk_ledger_accounts_type CHECK (account_type IN ('ASSET', 'LIABILITY', 'REVENUE', 'CONTRA_LIABILITY'))
);

INSERT INTO seller_finance_svc.ledger_accounts (account_code, account_type) VALUES
    ('MARKETPLACE_CLEARING', 'ASSET'),
    ('SELLER_SETTLEMENT_PENDING', 'LIABILITY'),
    ('SELLER_AVAILABLE', 'LIABILITY'),
    ('SELLER_RESERVE', 'LIABILITY'),
    ('SELLER_PAYOUT_PENDING', 'LIABILITY'),
    ('SELLER_DEBT', 'ASSET'),
    ('PLATFORM_COMMISSION_REVENUE', 'REVENUE'),
    ('SELLER_REFUNDED', 'CONTRA_LIABILITY'),
    ('SELLER_PAID_OUT', 'CONTRA_LIABILITY')
ON CONFLICT (account_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS seller_finance_svc.ledger_journals (
    journal_id UUID PRIMARY KEY,
    seller_id VARCHAR(255) NOT NULL,
    source_type VARCHAR(128) NOT NULL,
    source_id UUID NOT NULL,
    operation_type VARCHAR(128) NOT NULL,
    journal_type VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reversal_of_journal_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ledger_journals_source_operation UNIQUE (source_type, source_id, operation_type),
    CONSTRAINT fk_ledger_journals_reversal
        FOREIGN KEY (reversal_of_journal_id)
        REFERENCES seller_finance_svc.ledger_journals (journal_id),
    CONSTRAINT chk_ledger_journals_not_self_reversal
        CHECK (reversal_of_journal_id IS NULL OR reversal_of_journal_id <> journal_id)
);

CREATE TABLE IF NOT EXISTS seller_finance_svc.ledger_postings (
    posting_id UUID PRIMARY KEY,
    journal_id UUID NOT NULL,
    account_code VARCHAR(64) NOT NULL,
    direction VARCHAR(16) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    CONSTRAINT fk_ledger_postings_journal
        FOREIGN KEY (journal_id)
        REFERENCES seller_finance_svc.ledger_journals (journal_id),
    CONSTRAINT fk_ledger_postings_account
        FOREIGN KEY (account_code)
        REFERENCES seller_finance_svc.ledger_accounts (account_code),
    CONSTRAINT chk_ledger_postings_direction CHECK (direction IN ('DEBIT', 'CREDIT')),
    CONSTRAINT chk_ledger_postings_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_ledger_postings_currency CHECK (currency = 'VND')
);

CREATE INDEX IF NOT EXISTS idx_ledger_journals_seller_occurred
    ON seller_finance_svc.ledger_journals (seller_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_postings_journal
    ON seller_finance_svc.ledger_postings (journal_id);

CREATE TABLE IF NOT EXISTS seller_finance_svc.finance_event_inbox (
    event_id UUID PRIMARY KEY,
    journal_id UUID NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_finance_event_inbox_journal
        FOREIGN KEY (journal_id)
        REFERENCES seller_finance_svc.ledger_journals (journal_id)
);

CREATE TABLE IF NOT EXISTS seller_finance_svc.wallet_projection_checkpoints (
    seller_id VARCHAR(255) PRIMARY KEY,
    last_journal_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_wallet_checkpoint_journal
        FOREIGN KEY (last_journal_id)
        REFERENCES seller_finance_svc.ledger_journals (journal_id)
);

ALTER TABLE seller_finance_svc.seller_wallets
    ADD COLUMN IF NOT EXISTS settlement_pending_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reserve_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payout_pending_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS debt_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_fees NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_refunded NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_paid_out NUMERIC(19, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE seller_finance_svc.seller_wallets
    ADD CONSTRAINT chk_seller_wallets_settlement_pending_non_negative CHECK (settlement_pending_balance >= 0),
    ADD CONSTRAINT chk_seller_wallets_reserve_non_negative CHECK (reserve_balance >= 0),
    ADD CONSTRAINT chk_seller_wallets_payout_pending_non_negative CHECK (payout_pending_balance >= 0),
    ADD CONSTRAINT chk_seller_wallets_debt_non_negative CHECK (debt_balance >= 0),
    ADD CONSTRAINT chk_seller_wallets_total_fees_non_negative CHECK (total_fees >= 0),
    ADD CONSTRAINT chk_seller_wallets_total_refunded_non_negative CHECK (total_refunded >= 0),
    ADD CONSTRAINT chk_seller_wallets_total_paid_out_non_negative CHECK (total_paid_out >= 0),
    ADD CONSTRAINT chk_seller_wallets_version_non_negative CHECK (version >= 0);

CREATE OR REPLACE FUNCTION seller_finance_svc.reject_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'posted ledger rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS ledger_journals_immutable ON seller_finance_svc.ledger_journals;
CREATE TRIGGER ledger_journals_immutable
    BEFORE UPDATE OR DELETE ON seller_finance_svc.ledger_journals
    FOR EACH ROW EXECUTE FUNCTION seller_finance_svc.reject_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_postings_immutable ON seller_finance_svc.ledger_postings;
CREATE TRIGGER ledger_postings_immutable
    BEFORE UPDATE OR DELETE ON seller_finance_svc.ledger_postings
    FOR EACH ROW EXECUTE FUNCTION seller_finance_svc.reject_ledger_mutation();

CREATE OR REPLACE FUNCTION seller_finance_svc.validate_ledger_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM seller_finance_svc.ledger_postings p WHERE p.journal_id = NEW.journal_id
    ) THEN
        RAISE EXCEPTION 'ledger journal % must have postings', NEW.journal_id;
    END IF;

    IF EXISTS (
        SELECT p.currency
        FROM seller_finance_svc.ledger_postings p
        WHERE p.journal_id = NEW.journal_id
        GROUP BY p.currency
        HAVING COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'DEBIT'), 0)
             <> COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'CREDIT'), 0)
    ) THEN
        RAISE EXCEPTION 'ledger journal % is not balanced', NEW.journal_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_journals_balanced ON seller_finance_svc.ledger_journals;
CREATE CONSTRAINT TRIGGER ledger_journals_balanced
    AFTER INSERT ON seller_finance_svc.ledger_journals
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION seller_finance_svc.validate_ledger_journal_balance();
