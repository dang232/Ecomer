-- JPA entities map sha256_hex as VARCHAR(64); V2/V7 created CHAR(64),
-- which fails Hibernate schema validation (bpchar vs varchar) and pads
-- digests with spaces. Convert both columns, trimming legacy padding.
ALTER TABLE product_svc.videos
    ALTER COLUMN sha256_hex TYPE varchar(64) USING rtrim(sha256_hex);
ALTER TABLE product_svc.object_metadata
    ALTER COLUMN sha256_hex TYPE varchar(64) USING rtrim(sha256_hex);
