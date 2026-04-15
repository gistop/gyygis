-- PostGIS 扩展
CREATE EXTENSION IF NOT EXISTS postgis;

-- 示例点表（与 GeoServer init 中发布的图层名一致）
CREATE TABLE IF NOT EXISTS gyy_points (
    id SERIAL PRIMARY KEY,
    name TEXT,
    location GEOMETRY(Point, 4326)
);

TRUNCATE TABLE gyy_points;
INSERT INTO gyy_points (name, location)
VALUES ('我的位置', ST_SetSRID(ST_MakePoint(116.4, 39.9), 4326));
