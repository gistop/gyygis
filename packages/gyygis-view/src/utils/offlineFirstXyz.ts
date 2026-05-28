import type ImageTile from "ol/ImageTile";
import type Tile from "ol/Tile";
import TileState from "ol/TileState";
import XYZ from "ol/source/XYZ";
import { buildOfflineTileUrl } from "@/config/mapBasemap";
import { shouldTryOnlineFallback } from "@/utils/mapOnlineProbe";

export type OfflineFirstXyzOptions = {
  /** OpenLayers XYZ url 模板，用于生成在线 fallback 地址 */
  url: string;
  crossOrigin?: string;
};

type TileLoadAbortBag = { abort: AbortController };

function getAbortBag(tile: Tile): TileLoadAbortBag {
  const t = tile as Tile & { __gyygisTileLoad?: TileLoadAbortBag };
  t.__gyygisTileLoad?.abort.abort();
  const bag = { abort: new AbortController() };
  t.__gyygisTileLoad = bag;
  return bag;
}

function isActiveLoad(tile: Tile, bag: TileLoadAbortBag): boolean {
  return (tile as Tile & { __gyygisTileLoad?: TileLoadAbortBag }).__gyygisTileLoad === bag;
}

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

async function fetchTileBlob(url: string, signal: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch(url, { signal, credentials: "same-origin" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) return null;
    return await res.blob();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    return null;
  }
}

function displayBlobOnTileImage(
  tile: ImageTile,
  blob: Blob,
  crossOrigin: string | undefined,
  bag: TileLoadAbortBag
): Promise<boolean> {
  const image = tile.getImage() as HTMLImageElement;
  if (crossOrigin) {
    image.crossOrigin = crossOrigin;
  } else {
    image.removeAttribute("crossorigin");
  }

  const objectUrl = URL.createObjectURL(blob);

  return new Promise(resolve => {
    const finish = (ok: boolean) => {
      URL.revokeObjectURL(objectUrl);
      if (!isActiveLoad(tile, bag)) return;
      if (ok) {
        tile.setState(TileState.LOADED);
      }
      resolve(ok);
    };

    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = objectUrl;
  });
}

async function tryLoadUrl(
  tile: ImageTile,
  url: string,
  crossOrigin: string | undefined,
  bag: TileLoadAbortBag
): Promise<boolean> {
  const blob = await fetchTileBlob(url, bag.abort.signal);
  if (!blob || !isActiveLoad(tile, bag)) return false;
  return displayBlobOnTileImage(tile, blob, crossOrigin, bag);
}

/**
 * 瓦片加载：先请求本地离线包，失败且策略允许时再使用在线 url（由 OL 传入的 src）。
 * 使用 fetch + 显式 TileState，避免 OL10 下 img.onerror 未触发导致无法回退在线。
 */
export function attachOfflineFirstTileLoadFunction(
  source: XYZ,
  options?: { crossOrigin?: string }
): void {
  const crossOrigin = options?.crossOrigin;

  source.setTileLoadFunction((tile: Tile, onlineSrc: string) => {
    const imageTile = tile as ImageTile;
    const bag = getAbortBag(tile);

    void (async () => {
      const xyz = parseXyzFromResolvedTileUrl(onlineSrc);
      const offlineSrc = xyz ? buildOfflineTileUrl(xyz.z, xyz.x, xyz.y) : null;

      if (offlineSrc) {
        if (await tryLoadUrl(imageTile, offlineSrc, crossOrigin, bag)) return;
        if (!isActiveLoad(tile, bag)) return;
        if (!shouldTryOnlineFallback()) {
          imageTile.setState(TileState.ERROR);
          return;
        }
      }

      if (await tryLoadUrl(imageTile, onlineSrc, crossOrigin, bag)) return;
      if (!isActiveLoad(tile, bag)) return;
      imageTile.setState(TileState.ERROR);
    })();
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
