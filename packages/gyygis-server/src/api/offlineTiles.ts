import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { config } from "../config/index.js";
import {
  OFFLINE_TILE_SOURCE_TDT,
  resolveOfflineTilePath
} from "../services/offlineTileResolve.js";

export const offlineTilesRouter = Router();

/** 底图来源目录名（须以字母开头，避免与 z 层级数字混淆） */
const SOURCE_SEGMENT = /^[a-zA-Z][\w-]*$/;

function sendTileFile(res: Response, filePath: string): void {
  res.sendFile(filePath, err => {
    if (err && !res.headersSent) {
      res.status(404).send("瓦片不存在");
    }
  });
}

async function handleNamedSourceTile(
  req: Request,
  res: Response,
  source: string
): Promise<void> {
  const root = config.offlineTileRoot.trim();
  if (!root) {
    res.status(503).json({ error: "离线瓦片未配置（OFFLINE_TILE_ROOT）" });
    return;
  }

  const z = String(req.params.z ?? "");
  const x = String(req.params.x ?? "");
  const y = String(req.params.y ?? "");
  const ext = String(req.params.ext ?? "png");

  const filePath = await resolveOfflineTilePath(
    root,
    source,
    z,
    x,
    y,
    ext,
    config.offlineTileRegionOrder
  );
  if (!filePath) {
    res.status(404).send("瓦片不存在");
    return;
  }

  sendTileFile(res, filePath);
}

/**
 * GET /api/offline-tiles/:source/:z/:x/:y.png — 指定来源（tdt、其它与 tdt 平级的目录名）
 * 若 :source 为纯数字则交下一路由（天地图默认三段的 z）
 */
offlineTilesRouter.get(
  "/:source/:z/:x/:y.:ext",
  (req: Request, res: Response, next: NextFunction) => {
    const source = String(req.params.source ?? "");
    if (!SOURCE_SEGMENT.test(source)) {
      next();
      return;
    }
    void handleNamedSourceTile(req, res, source);
  }
);

/**
 * GET /api/offline-tiles/:z/:x/:y.png — 天地图离线（source=tdt，兼容现有 view）
 */
offlineTilesRouter.get("/:z/:x/:y.:ext", async (req, res) => {
  await handleNamedSourceTile(req, res, OFFLINE_TILE_SOURCE_TDT);
});
