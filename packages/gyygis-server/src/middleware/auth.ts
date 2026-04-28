import type { RequestHandler } from "express";
import { verifyJwtHs256, type AccessClaims } from "../auth/jwt.js";

export type AuthedUser = {
  userId: number;
  username: string;
  isAdmin: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

function parseBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1] ?? null;
}

function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  const prefix = `${name}=`;
  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(prefix)) return p.slice(prefix.length);
  }
  return null;
}

function parseAccessTokenFromAuthorizedCookie(cookieHeader: string | undefined): string | null {
  const raw = readCookieValue(cookieHeader, "authorized-token");
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
    if (Number.isFinite(exp) && exp > 0 && Date.now() > exp) return null;
    return accessToken;
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token =
    parseBearer(req.headers.authorization) ??
    parseAccessTokenFromAuthorizedCookie(req.headers.cookie);
  if (!token) {
    res.status(401).json({ error: "未登录：缺少 token" });
    return;
  }
  try {
    const claims = verifyJwtHs256<AccessClaims>(token);
    if (claims.typ !== "access") {
      res.status(401).json({ error: "非法 token" });
      return;
    }
    const userId = Number(claims.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(401).json({ error: "非法 token：sub" });
      return;
    }
    req.user = {
      userId,
      username: String(claims.username ?? ""),
      isAdmin: Boolean(claims.isAdmin)
    };
    next();
  } catch {
    res.status(401).json({ error: "未登录或 token 无效" });
  }
};
