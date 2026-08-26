-- Hibernate maps the video digest as VARCHAR(64); normalize the legacy CHAR(64)
-- column so schema validation matches the persistence mapping.
ALTER TABLE product_svc.videos
    ALTER COLUMN sha256_hex TYPE VARCHAR(64)
    USING NULLIF(BTRIM(sha256_hex), '');
