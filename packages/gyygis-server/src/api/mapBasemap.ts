import { Router } from "express";
import { config } from "../config/index.js";

export const mapBasemapRouter = Router();

/** GET /api/map-basemap/config — 供 view 读取底图策略与离线是否已配置 */
mapBasemapRouter.get("/config", (_req, res) => {
  res.json({
    offlineConfigured: Boolean(config.offlineTileRoot.trim()),
    mapOnlinePolicy: config.mapOnlinePolicy
  });
});
