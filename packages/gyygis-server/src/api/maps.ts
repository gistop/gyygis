import { Router } from "express";
import pg from "pg";
import {
  deleteLayerAndTable,
  listPostgisStoreLayers,
  setLayerEnabled
} from "../services/geoserverLayerCatalog.js";
import { getDbPool, isDbConfigured } from "../db.js";
import {
  isGeoMapsConfigured,
  isMapPublishConfigured,
  publishCsvFromOss,
  publishGeojsonFromOss,
  publishXlsxFromOss,
  type PublishCsvBody,
  type PublishGeojsonBody,
  type PublishXlsxBody
} from "../services/mapPublishFromOss.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantSchemaName, tenantWorkspaceName, userOssUploadPrefix } from "../services/tenant.js";

export const mapsRouter = Router();

function assertSafeIdentifier(name: string, what: string): void {
  if (!name || name.length > 63) throw new Error(`非法${what}`);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`${what}仅允许字母、数字、下划线且不以数字开头`);
  }
}

function coercePageInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}

/** GET /api/maps/layers — postgis_store 中已发布的图层及启用状态 */
mapsRouter.get("/layers", requireAuth, async (req, res) => {
  if (!isGeoMapsConfigured()) {
    res.status(503).json({ error: "地图服务未配置" });
    return;
  }
  try {
    const ws = tenantWorkspaceName(req.user!.userId);
    const layers = await listPostgisStoreLayers(ws);
    res.json({ layers });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/layers]", e);
    res.status(400).json({ error: message || "列出图层失败" });
  }
});

/**
 * GET /api/maps/layers/:layerName/fields
 * 返回当前用户 schema 下指定图层（表）的字段列表（不含几何字段）。
 */
mapsRouter.get("/layers/:layerName/fields", requireAuth, async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }
  const layerName = String(req.params.layerName ?? "");
  try {
    const schema = tenantSchemaName(req.user!.userId);
    if (!/^u_[1-9][0-9]*$/.test(schema)) throw new Error("非法 schema");
    assertSafeIdentifier(layerName, "图层名");

    const pool = getDbPool();
    const exists = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
      [schema, layerName]
    );
    if (exists.rowCount === 0) {
      res.status(404).json({ error: "图层不存在" });
      return;
    }

    const q = await pool.query(
      `
      SELECT
        column_name AS "name",
        udt_name AS "udtName",
        data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position ASC
      `,
      [schema, layerName]
    );
    // 默认过滤几何字段（常见为 geom / the_geom / geometry）
    const fields = q.rows
      .map(r => ({
        name: String(r.name),
        dataType: String(r.dataType ?? ""),
        udtName: String(r.udtName ?? "")
      }))
      .filter(f => {
        const n = f.name.toLowerCase();
        if (n === "geom" || n === "the_geom" || n === "geometry") return false;
        // PostGIS geometry 通常 udt_name=geometry
        if (f.udtName.toLowerCase() === "geometry") return false;
        return true;
      });
    res.json({ fields });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/fields]", e);
    res.status(400).json({ error: message || "读取字段失败" });
  }
});

/**
 * GET /api/maps/layers/:layerName/rows
 * 查询当前用户 schema 下指定图层（表）的属性行（分页），仅返回所选字段（不含几何）。
 *
 * query:
 * - fields: 逗号分隔字段名（可选；为空时默认返回 id,name）
 * - page: 1-based
 * - pageSize: 1..200
 */
mapsRouter.get("/layers/:layerName/rows", requireAuth, async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }
  const layerName = String(req.params.layerName ?? "");
  try {
    const schema = tenantSchemaName(req.user!.userId);
    if (!/^u_[1-9][0-9]*$/.test(schema)) throw new Error("非法 schema");
    assertSafeIdentifier(layerName, "图层名");

    const page = coercePageInt(req.query.page, 1, 1, 1000000);
    const pageSize = coercePageInt(req.query.pageSize, 50, 1, 200);
    const offset = (page - 1) * pageSize;

    const rawFields = typeof req.query.fields === "string" ? req.query.fields : "";
    const wanted = rawFields
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // 读取表字段白名单，避免 SQL 注入
    const pool = getDbPool();
    const colsRes = await pool.query(
      `
      SELECT column_name AS "name", udt_name AS "udtName"
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position ASC
      `,
      [schema, layerName]
    );
    if (colsRes.rowCount === 0) {
      res.status(404).json({ error: "图层不存在" });
      return;
    }
    const allowed = colsRes.rows
      .map(r => ({ name: String(r.name), udtName: String(r.udtName ?? "") }))
      .filter(c => c.udtName.toLowerCase() !== "geometry")
      .map(c => c.name);
    const allowedSet = new Set(allowed);

    const safeSelected =
      wanted.length > 0 ? wanted.filter(n => allowedSet.has(n)) : ["id", "name"].filter(n => allowedSet.has(n));
    if (safeSelected.length === 0) {
      res.status(400).json({ error: "未选择可用字段" });
      return;
    }

    // 确保有 id 方便前端作为 rowKey（若存在）
    if (allowedSet.has("id") && !safeSelected.includes("id")) {
      safeSelected.unshift("id");
    }

    const selectSql = safeSelected
      .map(c => `${pg.escapeIdentifier(c)} AS ${pg.escapeIdentifier(c)}`)
      .join(", ");
    const fromSql = `${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(layerName)}`;

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM ${fromSql}`);
    const total = Number(totalRes.rows?.[0]?.total ?? 0);

    const rowsRes = await pool.query(
      `SELECT ${selectSql} FROM ${fromSql} ORDER BY ${allowedSet.has("id") ? pg.escapeIdentifier("id") : "1"} ASC LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    res.json({
      page,
      pageSize,
      total,
      fields: safeSelected,
      rows: rowsRes.rows
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/rows]", e);
    res.status(400).json({ error: message || "查询属性失败" });
  }
});

/** PATCH /api/maps/layers/:layerName body: { enabled: boolean } */
mapsRouter.patch("/layers/:layerName", requireAuth, async (req, res) => {
  if (!isGeoMapsConfigured()) {
    res.status(503).json({ error: "地图服务未配置" });
    return;
  }
  const layerName = req.params.layerName;
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "请求体需包含 enabled: boolean" });
    return;
  }
  try {
    const ws = tenantWorkspaceName(req.user!.userId);
    await setLayerEnabled(ws, decodeURIComponent(layerName), enabled);
    res.status(204).send();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/layers PATCH]", e);
    res.status(400).json({ error: message || "更新失败" });
  }
});

/** DELETE /api/maps/layers/:layerName — 删除 GeoServer 图层并 DROP 同名 PostGIS 表 */
mapsRouter.delete("/layers/:layerName", requireAuth, async (req, res) => {
  if (!isGeoMapsConfigured()) {
    res.status(503).json({ error: "地图服务未配置" });
    return;
  }
  try {
    const schema = tenantSchemaName(req.user!.userId);
    const ws = tenantWorkspaceName(req.user!.userId);
    await deleteLayerAndTable(schema, ws, decodeURIComponent(req.params.layerName));
    res.status(204).send();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/layers DELETE]", e);
    res.status(400).json({ error: message || "删除失败" });
  }
});

/**
 * POST /api/maps/publish-csv-from-oss
 * 从 OSS 读取 CSV → 写入 PostGIS（用户 schema）→ GeoServer REST 发布到用户 workspace
 */
mapsRouter.post("/publish-csv-from-oss", requireAuth, async (req, res) => {
  if (!isMapPublishConfigured()) {
    res.status(503).json({
      error:
        "地图发布未配置：请在运行环境中设置 POSTGRES_HOST、POSTGRES_DB、POSTGRES_USER、POSTGRES_PASSWORD、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD"
    });
    return;
  }

  const body = req.body as Partial<PublishCsvBody>;
  if (!body.objectKey || typeof body.objectKey !== "string") {
    res.status(400).json({ error: "缺少 objectKey" });
    return;
  }
  if (!body.tableBase || typeof body.tableBase !== "string") {
    res.status(400).json({ error: "缺少 tableBase（图层/表标识，如 my_points）" });
    return;
  }

  try {
    const userId = req.user!.userId;
    const schema = tenantSchemaName(userId);
    const workspace = tenantWorkspaceName(userId);
    const uploadPrefix = userOssUploadPrefix(userId);
    const result = await publishCsvFromOss(
      { userId, schema, workspace, uploadPrefix },
      {
        objectKey: body.objectKey,
        tableBase: body.tableBase,
        lonColumn: body.lonColumn,
        latColumn: body.latColumn,
        nameColumn: body.nameColumn
      }
    );
    res.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/publish-csv-from-oss]", e);
    res.status(400).json({ error: message || "发布失败" });
  }
});

/**
 * POST /api/maps/publish-xlsx-from-oss
 * 从 OSS 读取 xlsx 首表 → 点数据写入 PostGIS → GeoServer 发布
 */
mapsRouter.post("/publish-xlsx-from-oss", requireAuth, async (req, res) => {
  if (!isMapPublishConfigured()) {
    res.status(503).json({
      error:
        "地图发布未配置：请在运行环境中设置 POSTGRES_HOST、POSTGRES_DB、POSTGRES_USER、POSTGRES_PASSWORD、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD"
    });
    return;
  }

  const body = req.body as Partial<PublishXlsxBody>;
  if (!body.objectKey || typeof body.objectKey !== "string") {
    res.status(400).json({ error: "缺少 objectKey" });
    return;
  }
  if (!body.tableBase || typeof body.tableBase !== "string") {
    res.status(400).json({ error: "缺少 tableBase（图层/表标识，如 my_points）" });
    return;
  }

  try {
    const userId = req.user!.userId;
    const schema = tenantSchemaName(userId);
    const workspace = tenantWorkspaceName(userId);
    const uploadPrefix = userOssUploadPrefix(userId);
    const result = await publishXlsxFromOss(
      { userId, schema, workspace, uploadPrefix },
      {
        objectKey: body.objectKey,
        tableBase: body.tableBase,
        lonColumn: body.lonColumn,
        latColumn: body.latColumn,
        nameColumn: body.nameColumn
      }
    );
    res.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/publish-xlsx-from-oss]", e);
    res.status(400).json({ error: message || "发布失败" });
  }
});

/**
 * POST /api/maps/publish-geojson-from-oss
 * 从 OSS 读取 GeoJSON（Feature 或 FeatureCollection）→ PostGIS → GeoServer 发布
 */
mapsRouter.post("/publish-geojson-from-oss", requireAuth, async (req, res) => {
  if (!isMapPublishConfigured()) {
    res.status(503).json({
      error:
        "地图发布未配置：请在运行环境中设置 POSTGRES_HOST、POSTGRES_DB、POSTGRES_USER、POSTGRES_PASSWORD、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD"
    });
    return;
  }

  const body = req.body as Partial<PublishGeojsonBody>;
  if (!body.objectKey || typeof body.objectKey !== "string") {
    res.status(400).json({ error: "缺少 objectKey" });
    return;
  }
  if (!body.tableBase || typeof body.tableBase !== "string") {
    res.status(400).json({ error: "缺少 tableBase（图层/表标识，如 my_polygons）" });
    return;
  }

  try {
    const userId = req.user!.userId;
    const schema = tenantSchemaName(userId);
    const workspace = tenantWorkspaceName(userId);
    const uploadPrefix = userOssUploadPrefix(userId);
    const result = await publishGeojsonFromOss(
      { userId, schema, workspace, uploadPrefix },
      {
        objectKey: body.objectKey,
        tableBase: body.tableBase
      }
    );
    res.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/publish-geojson-from-oss]", e);
    res.status(400).json({ error: message || "发布失败" });
  }
});
