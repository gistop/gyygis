const port = Number(process.env.PORT) || 3000;

/** 浏览器端 Key：需 Referer 白名单；勿用伪造的 Chrome UA，易触发 301013 */
const tiandituClientMode =
  (process.env.TIANDITU_CLIENT_MODE ?? "").toLowerCase() === "browser";

const webMapTilesRequireUserKey =
  (process.env.WEB_MAP_TILES_REQUIRE_USER_KEY ?? "").toLowerCase() === "true";

export const config = {
  port: Number.isFinite(port) && port > 0 ? port : 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  tiandituKey: process.env.TIANDITU_KEY ?? "",
  frontendDomain: process.env.FRONTEND_DOMAIN ?? "http://localhost:3000",
  /** false=服务端 Key（默认）：中性 UA、不传 Referer；true=浏览器端 Key */
  tiandituBrowserClientMode: tiandituClientMode,
  /** true 时第三方地图瓦片仅允许使用用户自备 key（忽略管理员代填） */
  webMapTilesRequireUserKey,
} as const;
