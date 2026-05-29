const port = Number(process.env.PORT) || 3000;

/** 浏览器端 Key：需 Referer 白名单；勿用伪造的 Chrome UA，易触发 301013 */
const tiandituClientMode =
  (process.env.TIANDITU_CLIENT_MODE ?? "").toLowerCase() === "browser";

const webMapTilesRequireUserKey =
  (process.env.WEB_MAP_TILES_REQUIRE_USER_KEY ?? "").toLowerCase() === "true";

function parseMapOnlinePolicy(raw: string): "off" | "auto" | "on" {
  const v = raw.trim().toLowerCase();
  if (v === "off" || v === "on") return v;
  return "auto";
}

function parseRegionOrder(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number.isFinite(port) && port > 0 ? port : 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  tiandituKey: process.env.TIANDITU_KEY ?? "",
  frontendDomain: process.env.FRONTEND_DOMAIN ?? "http://localhost:3000",
  /** false=服务端 Key（默认）：中性 UA、不传 Referer；true=浏览器端 Key */
  tiandituBrowserClientMode: tiandituClientMode,
  /** true 时第三方地图瓦片仅允许使用用户自备 key（忽略管理员代填） */
  webMapTilesRequireUserKey,
  /**
   * 离线瓦片根目录。天地图在 {root}/tdt/ 下：
   * - 扁平：tdt/{z}/{x}/{y}.png
   * - 多地区包：tdt/{任意包名}/{z}/{x}/{y}.png（包名勿用纯数字）
   */
  offlineTileRoot: process.env.OFFLINE_TILE_ROOT ?? "",
  /** 可选：地区包查找顺序，逗号分隔；未列出的包排在后面 */
  offlineTileRegionOrder: parseRegionOrder(process.env.OFFLINE_TILE_REGION_ORDER),
  /** 在线底图补洞策略：off=仅离线；auto=探测天地图；on=离线缺失时始终尝试在线 */
  mapOnlinePolicy: parseMapOnlinePolicy(process.env.MAP_ONLINE_POLICY ?? "auto"),
} as const;
