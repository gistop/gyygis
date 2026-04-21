import { Router } from "express";
import {
  deleteLayerAndTable,
  listPostgisStoreLayers,
  setLayerEnabled
} from "../services/geoserverLayerCatalog.js";
import {
  isGeoMapsConfigured,
  isMapPublishConfigured,
  publishCsvFromOss,
  type PublishCsvBody
} from "../services/mapPublishFromOss.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantSchemaName, tenantWorkspaceName, userOssUploadPrefix } from "../services/tenant.js";

export const mapsRouter = Router();

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
