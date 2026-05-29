import fs from "node:fs/promises";
import path from "node:path";

/** 天地图离线包目录名（与在线 /api/tianditu 对应；其它底图可与 tdt 平级建目录） */
export const OFFLINE_TILE_SOURCE_TDT = "tdt";

const TILE_COORD = /^\d+$/;
const TILE_EXT = /^(png|jpe?g|webp)$/i;
const REGION_PACK_NAME = /^[a-zA-Z][\w.-]*$/;

type RegionCache = { tdtRoot: string; packs: string[]; loadedAt: number };

let regionCache: RegionCache | null = null;
const REGION_CACHE_MS = 30_000;

function normalizeExt(ext: string): string {
  const lower = ext.toLowerCase();
  return lower === "jpeg" ? "jpg" : lower;
}

function isSafeUnderRoot(root: string, filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(root);
  return resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
}

function buildTileFileName(y: string, ext: string): string {
  return `${y}.${normalizeExt(ext)}`;
}

/** 子目录名非纯数字时视为「地区包」，避免与扁平布局下的 z 层级目录混淆 */
export function isRegionPackDirName(name: string): boolean {
  return REGION_PACK_NAME.test(name) && !TILE_COORD.test(name);
}

/**
 * 解析天地图离线根目录：
 * - OFFLINE_TILE_ROOT=/tiles 且存在 /tiles/tdt → /tiles/tdt
 * - OFFLINE_TILE_ROOT=/tiles/tdt → /tiles/tdt
 */
export async function resolveTiandituOfflineRoot(offlineTileRoot: string): Promise<string | null> {
  const root = offlineTileRoot.trim();
  if (!root) return null;

  const resolved = path.resolve(root);
  try {
    const st = await fs.stat(resolved);
    if (!st.isDirectory()) return null;
  } catch {
    return null;
  }

  const base = path.basename(resolved);
  if (base === OFFLINE_TILE_SOURCE_TDT) {
    return resolved;
  }

  const nested = path.join(resolved, OFFLINE_TILE_SOURCE_TDT);
  try {
    const st = await fs.stat(nested);
    if (st.isDirectory()) return nested;
  } catch {
    // 无 tdt 子目录时仍使用 root（兼容旧配置直接指向 tdt 目录）
  }

  return resolved;
}

async function listRegionPackDirs(tdtRoot: string, regionOrder: string[]): Promise<string[]> {
  const now = Date.now();
  if (regionCache && regionCache.tdtRoot === tdtRoot && now - regionCache.loadedAt < REGION_CACHE_MS) {
    return regionCache.packs;
  }

  let names: string[] = [];
  try {
    const entries = await fs.readdir(tdtRoot, { withFileTypes: true });
    names = entries.filter(e => e.isDirectory() && isRegionPackDirName(e.name)).map(e => e.name);
  } catch {
    names = [];
  }

  names.sort((a, b) => a.localeCompare(b));

  if (regionOrder.length > 0) {
    const set = new Set(names);
    const ordered = regionOrder.filter(p => set.has(p));
    for (const n of names) {
      if (!ordered.includes(n)) ordered.push(n);
    }
    names = ordered;
  }

  regionCache = { tdtRoot, packs: names, loadedAt: now };
  return names;
}

function tilePathUnder(root: string, parts: string[]): string | null {
  const filePath = path.join(root, ...parts);
  if (!isSafeUnderRoot(root, filePath)) return null;
  return filePath;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 在指定底图来源目录下查找瓦片：先扁平 {z}/{x}/{y}，再各地区包 {pack}/{z}/{x}/{y}。
 */
export async function resolveOfflineTilePath(
  offlineTileRoot: string,
  source: string,
  z: string,
  x: string,
  y: string,
  ext: string,
  regionOrder: readonly string[] = []
): Promise<string | null> {
  if (!TILE_COORD.test(z) || !TILE_COORD.test(x) || !TILE_COORD.test(y)) return null;
  if (!TILE_EXT.test(ext)) return null;

  const root = offlineTileRoot.trim();
  if (!root) return null;

  let sourceRoot: string | null;
  if (source === OFFLINE_TILE_SOURCE_TDT) {
    sourceRoot = await resolveTiandituOfflineRoot(root);
  } else {
    const base = path.resolve(root);
    const baseName = path.basename(base);
    sourceRoot =
      baseName === source ? base : path.join(base, source);
    try {
      const st = await fs.stat(sourceRoot);
      if (!st.isDirectory()) return null;
    } catch {
      return null;
    }
  }

  if (!sourceRoot) return null;

  const yFile = buildTileFileName(y, ext);
  const flatParts = [z, x, yFile];

  const flat = tilePathUnder(sourceRoot, flatParts);
  if (flat && (await fileExists(flat))) return flat;

  const packs = await listRegionPackDirs(sourceRoot, [...regionOrder]);
  for (const pack of packs) {
    const regional = tilePathUnder(sourceRoot, [pack, ...flatParts]);
    if (regional && (await fileExists(regional))) return regional;
  }

  return null;
}

export function clearOfflineTileRegionCacheForTests(): void {
  regionCache = null;
}
