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
