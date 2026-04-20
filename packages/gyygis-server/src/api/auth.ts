import { Router } from "express";
import crypto from "node:crypto";
import { getDbPool, isDbConfigured } from "../db.js";

export const authRouter = Router();

type LoginBody = { username?: unknown; password?: unknown };
type RegisterBody = { username?: unknown; password?: unknown; confirmPassword?: unknown };

type TokenPayload = {
  accessToken: string;
  refreshToken: string;
  expires: string; // ISO string
};

type UserProfile = {
  avatar: string;
  username: string;
  nickname: string;
  roles: string[];
  permissions: string[];
};

type LoginResponse = { success: true; data: UserProfile & TokenPayload } | { success: false; error: string };
type RegisterResponse = { success: true; data: { username: string } } | { success: false; error: string };
type RefreshResponse = { success: true; data: Pick<TokenPayload, "accessToken" | "refreshToken" | "expires"> } | { success: false; error: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function validateUsername(username: string): string | null {
  const u = username.trim();
  if (!u) return "缺少 username";
  if (u.length < 2 || u.length > 32) return "username 长度需为 2-32";
  if (!/^[a-zA-Z0-9_@.-]+$/.test(u)) return "username 仅允许字母数字与 _@.-";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "缺少 password";
  if (password.length < 8 || password.length > 64) return "password 长度需为 8-64";
  return null;
}

function makeTokens(refreshToken?: string): TokenPayload {
  const accessTtlMs = 2 * 60 * 60 * 1000; // 2h
  const accessToken = crypto.randomBytes(32).toString("hex");
  const rt = refreshToken ?? crypto.randomBytes(48).toString("hex");
  const expires = new Date(Date.now() + accessTtlMs).toISOString();
  return { accessToken, refreshToken: rt, expires };
}

type RefreshSession = {
  username: string;
  isAdmin: boolean;
  refreshExpiresAt: number;
};

const refreshSessions = new Map<string, RefreshSession>();

function saveRefreshToken(refreshToken: string, s: Omit<RefreshSession, "refreshExpiresAt">) {
  const ttlMs = 30 * 24 * 60 * 60 * 1000; // 30d
  refreshSessions.set(refreshToken, {
    ...s,
    refreshExpiresAt: Date.now() + ttlMs
  });
}

function profileFromDb(username: string, isAdmin: boolean): UserProfile {
  const roles = isAdmin ? ["admin"] : ["common"];
  const permissions = isAdmin ? ["*:*:*"] : [];
  return {
    avatar: "",
    username,
    nickname: username,
    roles,
    permissions
  };
}

async function loginWithPassword(username: string, password: string): Promise<{ ok: true; username: string; isAdmin: boolean } | { ok: false; error: string }> {
  const pool = getDbPool();
  const r = await pool.query<{
    username: string;
    is_admin: boolean;
    is_active: boolean;
  }>(
    `
    SELECT username, is_admin, is_active
    FROM auth.users
    WHERE username = $1
      AND is_active = TRUE
      AND crypt($2, password_hash) = password_hash
    LIMIT 1
    `,
    [username, password]
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: "用户名或密码错误" };
  return { ok: true, username: row.username, isAdmin: row.is_admin === true };
}

authRouter.post("/register", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置：请设置 POSTGRES_*" } satisfies RegisterResponse);
    return;
  }
  const body = req.body as RegisterBody;
  const username = asString(body.username);
  const password = asString(body.password);
  const confirmPassword = asString(body.confirmPassword);

  const uErr = validateUsername(username);
  if (uErr) {
    res.status(400).json({ success: false, error: uErr } satisfies RegisterResponse);
    return;
  }
  const pErr = validatePassword(password);
  if (pErr) {
    res.status(400).json({ success: false, error: pErr } satisfies RegisterResponse);
    return;
  }
  if (confirmPassword && confirmPassword !== password) {
    res.status(400).json({ success: false, error: "两次密码不一致" } satisfies RegisterResponse);
    return;
  }

  try {
    const pool = getDbPool();
    const result = await pool.query<{ username: string }>(
      `
      INSERT INTO auth.users (username, password_hash, is_admin)
      VALUES ($1, crypt($2, gen_salt('bf')), FALSE)
      ON CONFLICT (username) DO NOTHING
      RETURNING username
      `,
      [username.trim(), password]
    );
    const created = result.rows[0];
    if (!created) {
      res.status(409).json({ success: false, error: "用户名已存在" } satisfies RegisterResponse);
      return;
    }
    res.json({ success: true, data: { username: created.username } } satisfies RegisterResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auth/register]", e);
    res.status(500).json({ success: false, error: message || "注册失败" } satisfies RegisterResponse);
  }
});

authRouter.post("/login", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置：请设置 POSTGRES_*" } satisfies LoginResponse);
    return;
  }
  const body = req.body as LoginBody;
  const username = asString(body.username);
  const password = asString(body.password);

  const uErr = validateUsername(username);
  if (uErr) {
    res.status(400).json({ success: false, error: uErr } satisfies LoginResponse);
    return;
  }
  const pErr = validatePassword(password);
  if (pErr) {
    res.status(400).json({ success: false, error: pErr } satisfies LoginResponse);
    return;
  }

  try {
    const r = await loginWithPassword(username.trim(), password);
    if (!r.ok) {
      res.status(401).json({ success: false, error: r.error } satisfies LoginResponse);
      return;
    }
    const tokens = makeTokens();
    saveRefreshToken(tokens.refreshToken, { username: r.username, isAdmin: r.isAdmin });
    res.json({
      success: true,
      data: {
        ...profileFromDb(r.username, r.isAdmin),
        ...tokens
      }
    } satisfies LoginResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auth/login]", e);
    res.status(500).json({ success: false, error: message || "登录失败" } satisfies LoginResponse);
  }
});

authRouter.post("/refresh-token", async (req, res) => {
  const refreshToken = asString(req.body?.refreshToken);
  if (!refreshToken) {
    res.status(400).json({ success: false, error: "缺少 refreshToken" } satisfies RefreshResponse);
    return;
  }
  const s = refreshSessions.get(refreshToken);
  if (!s) {
    res.status(401).json({ success: false, error: "refreshToken 无效" } satisfies RefreshResponse);
    return;
  }
  if (Date.now() > s.refreshExpiresAt) {
    refreshSessions.delete(refreshToken);
    res.status(401).json({ success: false, error: "refreshToken 已过期" } satisfies RefreshResponse);
    return;
  }
  const tokens = makeTokens(refreshToken);
  saveRefreshToken(tokens.refreshToken, { username: s.username, isAdmin: s.isAdmin });
  res.json({
    success: true,
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokens.expires
    }
  } satisfies RefreshResponse);
});

