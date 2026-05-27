import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { config } from "../config/index.js";

export const offlineTilesRouter = Router();

const TILE_COORD = /^\d+$/;
const TILE_EXT = /^(png|jpe?g|webp)$/i;

function resolveTilePath(root: string, z: string, x: string, y: string, ext: string): string | null {
  if (!TILE_COORD.test(z) || !TILE_COORD.test(x) || !TILE_COORD.test(y)) return null;
  if (!TILE_EXT.test(ext)) return null;

  const filePath = path.join(root, z, x, `${y}.${ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase()}`);
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return resolved;
}

/** GET /api/offline-tiles/:z/:x/:y.png — 本地 XYZ 瓦片（{OFFLINE_TILE_ROOT}/{z}/{x}/{y}.png） */
offlineTilesRouter.get("/:z/:x/:y.:ext", async (req, res) => {
  const root = config.offlineTileRoot.trim();
  if (!root) {
    res.status(503).json({ error: "离线瓦片未配置（OFFLINE_TILE_ROOT）" });
    return;
  }

  const z = String(req.params.z ?? "");
  const x = String(req.params.x ?? "");
  const y = String(req.params.y ?? "");
  const ext = String(req.params.ext ?? "png");

  const filePath = resolveTilePath(root, z, x, y, ext);
  if (!filePath) {
    res.status(400).send("非法瓦片路径");
    return;
  }

  try {
    await fs.access(filePath);
    res.sendFile(filePath, err => {
      if (err && !res.headersSent) {
        res.status(404).send("瓦片不存在");
      }
    });
  } catch {
    res.status(404).send("瓦片不存在");
  }
});
