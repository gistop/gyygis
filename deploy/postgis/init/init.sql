-- PostGIS 扩展
CREATE EXTENSION IF NOT EXISTS postgis;

-- 密码哈希（bcrypt）支持
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 认证相关 schema / 表
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户布局（Dockview 布局 JSON）
CREATE TABLE IF NOT EXISTS auth.user_layouts (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    layout_json JSONB NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一用户下布局名唯一
CREATE UNIQUE INDEX IF NOT EXISTS user_layouts_user_name_uq
  ON auth.user_layouts (user_id, name);

-- 每个用户最多一个默认布局
CREATE UNIQUE INDEX IF NOT EXISTS user_layouts_one_default_per_user_uq
  ON auth.user_layouts (user_id)
  WHERE is_default;

-- 全站 Web 地图服务目录（管理员维护地址与管理员 key；服务端使用，不下发明文给浏览器）
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

-- 用户对某条目录的个人 key 与个人是否启用（密钥仅存服务端）
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

-- 初始化管理员账号（部署后请尽快修改默认密码）
INSERT INTO auth.users (username, password_hash, is_admin)
VALUES ('admin', crypt('ChangeMe_123', gen_salt('bf')), TRUE)
ON CONFLICT (username) DO NOTHING;

-- 示例点表（与 GeoServer init 中发布的图层名一致）
CREATE TABLE IF NOT EXISTS gyy_points (
    id SERIAL PRIMARY KEY,
    name TEXT,
    location GEOMETRY(Point, 4326)
);

TRUNCATE TABLE gyy_points;
INSERT INTO gyy_points (name, location)
VALUES ('我的位置', ST_SetSRID(ST_MakePoint(116.4, 39.9), 4326));
