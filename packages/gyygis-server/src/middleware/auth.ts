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

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = parseBearer(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "未登录：缺少 Authorization Bearer token" });
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
