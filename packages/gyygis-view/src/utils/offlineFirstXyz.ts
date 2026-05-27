import type ImageTile from "ol/ImageTile";
import type Tile from "ol/Tile";
import XYZ from "ol/source/XYZ";
import { buildOfflineTileUrl } from "@/config/mapBasemap";
import { shouldTryOnlineFallback } from "@/utils/mapOnlineProbe";

export type OfflineFirstXyzOptions = {
  /** OpenLayers XYZ url 模板，用于生成在线 fallback 地址 */
  url: string;
  crossOrigin?: string;
};

/**
 * 从 OL 已替换占位符后的在线 URL 解析 z/x/y，避免手写 tileCoord 换算与 OL 版本不一致（y 为负）。
 * 支持：?x=&y=&z=、天地图 ?x=&y=&l=、路径 .../{z}/{x}/{y}.png
 */
export function parseXyzFromResolvedTileUrl(src: string): { z: number; x: number; y: number } | null {
  try {
    const u = new URL(src, "http://local.invalid");
    const x = Number(u.searchParams.get("x"));
    const y = Number(u.searchParams.get("y"));
    const zRaw = u.searchParams.get("z") ?? u.searchParams.get("l");
    if (zRaw != null && Number.isFinite(x) && Number.isFinite(y)) {
      const z = Number(zRaw);
      if (Number.isFinite(z) && x >= 0 && y >= 0 && z >= 0) {
        return { z, x, y };
      }
    }

    const pathMatch = u.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.(?:png|jpe?g|webp)$/i);
    if (pathMatch) {
      const z = Number(pathMatch[1]);
      const x = Number(pathMatch[2]);
      const y = Number(pathMatch[3]);
      if (Number.isFinite(z) && Number.isFinite(x) && Number.isFinite(y)) {
        return { z, x, y };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 瓦片加载：先请求本地离线包，失败且策略允许时再使用在线 url（由 OL 传入的 src）。
 */
export function attachOfflineFirstTileLoadFunction(
  source: XYZ,
  options?: { crossOrigin?: string }
): void {
  source.setTileLoadFunction((tile: Tile, onlineSrc: string) => {
    const image = (tile as ImageTile).getImage() as HTMLImageElement;
    if (options?.crossOrigin) {
      image.crossOrigin = options.crossOrigin;
    }

    const xyz = parseXyzFromResolvedTileUrl(onlineSrc);
    const offlineSrc = xyz ? buildOfflineTileUrl(xyz.z, xyz.x, xyz.y) : null;

    if (!offlineSrc) {
      image.src = onlineSrc;
      return;
    }

    let usedOffline = true;
    image.onerror = () => {
      if (!usedOffline) return;
      usedOffline = false;
      if (!shouldTryOnlineFallback()) return;
      image.onerror = () => {
        /* 在线也失败：透明瓦片 */
      };
      image.src = onlineSrc;
    };
    image.src = offlineSrc;
  });
}

export function createOfflineFirstXyz(options: OfflineFirstXyzOptions): XYZ {
  const source = new XYZ({
    url: options.url,
    crossOrigin: options.crossOrigin
  });
  attachOfflineFirstTileLoadFunction(source, { crossOrigin: options.crossOrigin });
  return source;
}
