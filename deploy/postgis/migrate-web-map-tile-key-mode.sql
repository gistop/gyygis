-- 第三方地图：瓦片密钥模式（服务端代理 / 浏览器直连）
ALTER TABLE auth.web_map_service_catalog
  ADD COLUMN IF NOT EXISTS tile_key_mode TEXT NOT NULL DEFAULT 'proxy';

ALTER TABLE auth.web_map_service_catalog
  DROP CONSTRAINT IF EXISTS web_map_service_catalog_tile_key_mode_chk;

ALTER TABLE auth.web_map_service_catalog
  ADD CONSTRAINT web_map_service_catalog_tile_key_mode_chk
  CHECK (tile_key_mode IN ('proxy', 'browser'));
