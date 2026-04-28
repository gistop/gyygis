-- 在已有数据库上执行一次（首次 init 已建库的卷不会重跑 init.sql）
-- psql 或 Docker exec 连接后: \i migrate-add-web-map-services.sql

CREATE TABLE IF NOT EXISTS auth.web_map_service_catalog (
    id                  BIGSERIAL PRIMARY KEY,
    code                TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    service_type        TEXT NOT NULL DEFAULT 'xyz',
    service_url         TEXT NOT NULL,
    admin_api_key       TEXT,
    requires_user_key   BOOLEAN NOT NULL DEFAULT TRUE,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT web_map_service_catalog_type_chk CHECK (service_type = 'xyz')
);

CREATE TABLE IF NOT EXISTS auth.user_web_map_services (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    catalog_id  BIGINT NOT NULL REFERENCES auth.web_map_service_catalog(id) ON DELETE CASCADE,
    user_api_key TEXT,
    is_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS user_web_map_services_user_idx
  ON auth.user_web_map_services (user_id);
