import { Router } from "express";
import {
  isMapPublishConfigured,
  publishCsvFromOss,
  type PublishCsvBody
} from "../services/mapPublishFromOss.js";

export const mapsRouter = Router();

/**
 * POST /api/maps/publish-csv-from-oss
 * 从 OSS 读取 CSV → 写入 PostGIS → GeoServer REST 发布图层（与 deploy 中 init 使用同一 workspace/datastore）
 */
mapsRouter.post("/publish-csv-from-oss", async (req, res) => {
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
    const result = await publishCsvFromOss({
      objectKey: body.objectKey,
      tableBase: body.tableBase,
      lonColumn: body.lonColumn,
      latColumn: body.latColumn,
      nameColumn: body.nameColumn
    });
    res.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[maps/publish-csv-from-oss]", e);
    res.status(400).json({ error: message || "发布失败" });
  }
});
