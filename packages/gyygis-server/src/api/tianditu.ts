import axios from "axios";
import type { Request, Response } from "express";
import { Router } from "express";
import { config } from "../config/index.js";

const TIANDITU_BASE_URL = "https://t{0-7}.tianditu.gov.cn/DataServer";

type TileQuery = {
  x?: string;
  y?: string;
  l?: string;
};

const getReferer = (): string => config.frontendDomain;

/** 服务端 Key：天地图要求「干净」请求，避免 Chrome UA 被判定为非服务端访问（301013） */
function tiandituOutboundHeaders(): Record<string, string> {
  if (config.tiandituBrowserClientMode) {
    return {
      Referer: getReferer(),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
  }
  return {
    "User-Agent": "Gyygis-TileProxy/1.0",
  };
}

const buildTiandituUrl = (layer: "img_w" | "cia_w", query: TileQuery): string => {
  const { x, y, l: z } = query;
  const subDomain = Math.floor(Math.random() * 8);
  return `${TIANDITU_BASE_URL.replace("{0-7}", String(subDomain))}?T=${layer}&x=${x}&y=${y}&l=${z}&tk=${config.tiandituKey}`;
};

function bufferToLogPreview(data: ArrayBuffer | Buffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const slice = buf.subarray(0, 512);
  const asText = slice.toString("utf8");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(asText)) {
    return `[binary ${buf.length} bytes]`;
  }
  return asText.trim().slice(0, 400);
}

const proxyTile = async (res: Response, url: string, errorMessage: string): Promise<void> => {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      // 天地图常返回 403/404；若不处理，axios 会抛错，playground 只能看到笼统的 500
      validateStatus: () => true,
      timeout: 60_000,
      headers: tiandituOutboundHeaders(),
    });

    const { status, data, headers } = response;
    const contentType = headers["content-type"];

    if (status >= 400) {
      const preview = bufferToLogPreview(data);
      console.error(`${errorMessage} [天地图 HTTP ${status}]`, url, preview);
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
      res.status(status).send(body.length ? body : errorMessage);
      return;
    }

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    res.send(body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";
    console.error(`${errorMessage}:`, message);
    res.status(502).send(errorMessage);
  }
};

export const tiandituRouter = Router();

tiandituRouter.get("/img", async (req: Request<unknown, unknown, unknown, TileQuery>, res: Response) => {
  const url = buildTiandituUrl("img_w", req.query);
  await proxyTile(res, url, "获取地图瓦片失败");
});

tiandituRouter.get("/label", async (req: Request<unknown, unknown, unknown, TileQuery>, res: Response) => {
  const url = buildTiandituUrl("cia_w", req.query);
  await proxyTile(res, url, "获取地图注记失败");
});
