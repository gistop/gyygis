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
