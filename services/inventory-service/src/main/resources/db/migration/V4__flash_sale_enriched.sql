-- Enriches flash_sale_campaigns with product metadata that Shopee surfaces
-- on its flash-sale item response: name, shop, discount label, image hash,
-- and seller badges.  Rating / historical_sold come from product-service
-- (joined client-side in useFlashSaleWithProducts).

ALTER TABLE inventory_svc.flash_sale_campaigns
    ADD COLUMN  name                TEXT,
    ADD COLUMN  shop_name           TEXT,
    ADD COLUMN  is_shop_official     BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN  is_shop_preferred    BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN  raw_discount         INTEGER  NOT NULL DEFAULT 0,   -- e.g. 40 = "40% off"
    ADD COLUMN  discount             TEXT,                                 -- e.g. "40%"
    ADD COLUMN  image_hash           TEXT;                                 -- CDN hash, resolved client-side
