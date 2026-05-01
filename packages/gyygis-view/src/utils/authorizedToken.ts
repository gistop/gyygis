/** 与 gyygis-admin 一致：accessToken 存于 cookie `authorized-token`（JSON 字符串） */

const TOKEN_KEY = "authorized-token";

function readCookieValue(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      return p.slice(prefix.length);
    }
  }
  return null;
}

export function getAccessTokenFromAuthorizedCookie(): string | null {
  const raw = readCookieValue(TOKEN_KEY);
  if (!raw) return null;
  try {
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const o = JSON.parse(decoded) as { accessToken?: unknown; expires?: unknown };
    const accessToken = typeof o.accessToken === "string" ? o.accessToken : "";
    if (!accessToken) return null;
    const exp = typeof o.expires === "number" ? o.expires : Number(o.expires);
    if (Number.isFinite(exp) && exp > 0 && Date.now() > exp) {
      return null;
    }
    return accessToken;
  } catch {
    return null;
  }
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  // atob 返回 Latin1，需要转回 UTF-8
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * 从 accessToken（JWT）中读取 userId（claims.sub）。
 * 不做签名校验，仅用于前端拼接租户 workspace（u_<id>）。
 */
export function getUserIdFromAccessTokenJwt(): number | null {
  const token = getAccessTokenFromAuthorizedCookie();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadJson = base64UrlToUtf8(parts[1]);
    const payload = JSON.parse(payloadJson) as { sub?: unknown };
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const n = Number(sub);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
