import { Router } from "express";
import crypto from "node:crypto";
import { getDbPool, isDbConfigured } from "../db.js";
import { signJwtHs256, type AccessClaims } from "../auth/jwt.js";
import {
  ensureGeoserverWorkspaceAndStore,
  ensurePostgisTenantSchema,
  tenantSchemaName,
  tenantWorkspaceName,
  userOssUploadPrefix
} from "../services/tenant.js";

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
  userId: number;
  tenantSchema: string;
  tenantWorkspace: string;
  uploadPrefix: string;
};

type LoginResponse = { success: true; data: UserProfile & TokenPayload } | { success: false; error: string };
type RegisterResponse =
  | {
      success: true;
      data: {
        userId: number;
        username: string;
        tenantSchema: string;
        tenantWorkspace: string;
        uploadPrefix: string;
      };
    }
  | { success: false; error: string };
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

function makeAccessJwt(userId: number, username: string, isAdmin: boolean): TokenPayload {
  const accessTtlSec = 2 * 60 * 60; // 2h
  const now = Math.floor(Date.now() / 1000);
  const exp = now + accessTtlSec;
  const claims: AccessClaims = {
    sub: String(userId),
    username,
    isAdmin,
    typ: "access",
    iat: now,
    exp
  };
  const accessToken = signJwtHs256(claims as unknown as Record<string, unknown>);
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expires = new Date(exp * 1000).toISOString();
  return { accessToken, refreshToken, expires };
}

type RefreshSession = {
  userId: number;
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

function profileFromDb(userId: number, username: string, isAdmin: boolean): UserProfile {
  const roles = isAdmin ? ["admin"] : ["common"];
  const permissions = isAdmin ? ["*:*:*"] : [];
  return {
    avatar: "",
    username,
    nickname: username,
    roles,
    permissions,
    userId,
    tenantSchema: tenantSchemaName(userId),
    tenantWorkspace: tenantWorkspaceName(userId),
    uploadPrefix: userOssUploadPrefix(userId)
  };
}

let ensuredAuthColumns = false;
async function ensureAuthColumns(): Promise<void> {
  if (ensuredAuthColumns) return;
  const pool = getDbPool();
  await pool.query(`
    ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS tenant_schema text,
      ADD COLUMN IF NOT EXISTS tenant_workspace text,
      ADD COLUMN IF NOT EXISTS geoserver_ready boolean NOT NULL DEFAULT FALSE
  `);
  ensuredAuthColumns = true;
}

function readGeoConnForTenant() {
  const postgresHost = process.env.POSTGRES_HOST ?? "";
  const postgresPort = Number(process.env.POSTGRES_PORT ?? "5432");
  const postgresUser = process.env.POSTGRES_USER ?? "";
  const postgresPassword = process.env.POSTGRES_PASSWORD ?? "";
  const postgresDb = process.env.POSTGRES_DB ?? "";
  const geoserverUrl = (process.env.GEOSERVER_INTERNAL_URL ?? "").replace(/\/$/, "");
  const geoserverUser = process.env.GEOSERVER_USER ?? "";
  const geoserverPassword = process.env.GEOSERVER_PASSWORD ?? "";
  return { postgresHost, postgresPort, postgresUser, postgresPassword, postgresDb, geoserverUrl, geoserverUser, geoserverPassword };
}

function isTenantInfraConfigured(): boolean {
  const e = readGeoConnForTenant();
  return Boolean(
    e.postgresHost &&
      e.postgresUser &&
      e.postgresDb &&
      e.geoserverUrl &&
      e.geoserverUser &&
      e.geoserverPassword
  );
}

async function loginWithPassword(
  username: string,
  password: string
): Promise<
  | { ok: true; userId: number; username: string; isAdmin: boolean }
  | { ok: false; error: string }
> {
  const pool = getDbPool();
  const r = await pool.query<{
    id: string;
    username: string;
    is_admin: boolean;
    is_active: boolean;
  }>(
    `
    SELECT id, username, is_admin, is_active
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
  return { ok: true, userId: Number(row.id), username: row.username, isAdmin: row.is_admin === true };
}

async function ensureUserTenantIfMissing(userId: number): Promise<void> {
  await ensureAuthColumns();
  if (!isTenantInfraConfigured()) return;
  const pool = getDbPool();
  const r = await pool.query<{ geoserver_ready: boolean }>(
    `SELECT geoserver_ready FROM auth.users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const ready = r.rows[0]?.geoserver_ready === true;
  if (ready) return;

  const schema = tenantSchemaName(userId);
  const workspace = tenantWorkspaceName(userId);
  await ensurePostgisTenantSchema(pool, schema);
  const e = readGeoConnForTenant();
  await ensureGeoserverWorkspaceAndStore(
    {
      postgresHost: e.postgresHost,
      postgresPort: e.postgresPort,
      postgresUser: e.postgresUser,
      postgresPassword: e.postgresPassword,
      postgresDb: e.postgresDb
    },
    {
      geoserverUrl: e.geoserverUrl,
      geoserverUser: e.geoserverUser,
      geoserverPassword: e.geoserverPassword
    },
    workspace
  );
  await pool.query(
    `
    UPDATE auth.users
    SET tenant_schema = $2,
        tenant_workspace = $3,
        geoserver_ready = TRUE
    WHERE id = $1
    `,
    [userId, schema, workspace]
  );
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
  if (!isTenantInfraConfigured()) {
    res.status(503).json({
      success: false,
      error:
        "租户环境未配置：请设置 POSTGRES_* 与 GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD（用于创建 schema 与 GeoServer workspace）"
    } satisfies RegisterResponse);
    return;
  }

  try {
    await ensureAuthColumns();
    const pool = getDbPool();
    const client = await pool.connect();
    let userId: number | null = null;
    let createdUsername = "";
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; username: string }>(
        `
        INSERT INTO auth.users (username, password_hash, is_admin)
        VALUES ($1, crypt($2, gen_salt('bf')), FALSE)
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username
        `,
        [username.trim(), password]
      );
      const created = result.rows[0];
      if (!created) {
        await client.query("ROLLBACK");
        res.status(409).json({ success: false, error: "用户名已存在" } satisfies RegisterResponse);
        return;
      }
      userId = Number(created.id);
      createdUsername = created.username;
      const schema = tenantSchemaName(userId);
      const workspace = tenantWorkspaceName(userId);

      await ensurePostgisTenantSchema(pool, schema);
      const e = readGeoConnForTenant();
      await ensureGeoserverWorkspaceAndStore(
        {
          postgresHost: e.postgresHost,
          postgresPort: e.postgresPort,
          postgresUser: e.postgresUser,
          postgresPassword: e.postgresPassword,
          postgresDb: e.postgresDb
        },
        {
          geoserverUrl: e.geoserverUrl,
          geoserverUser: e.geoserverUser,
          geoserverPassword: e.geoserverPassword
        },
        workspace
      );

      await client.query(
        `
        UPDATE auth.users
        SET tenant_schema = $2,
            tenant_workspace = $3,
            geoserver_ready = TRUE
        WHERE id = $1
        `,
        [userId, schema, workspace]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      data: {
        userId: userId!,
        username: createdUsername,
        tenantSchema: tenantSchemaName(userId!),
        tenantWorkspace: tenantWorkspaceName(userId!),
        uploadPrefix: userOssUploadPrefix(userId!)
      }
    } satisfies RegisterResponse);
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
    await ensureUserTenantIfMissing(r.userId);
    const tokens = makeAccessJwt(r.userId, r.username, r.isAdmin);
    saveRefreshToken(tokens.refreshToken, { userId: r.userId, username: r.username, isAdmin: r.isAdmin });
    res.json({
      success: true,
      data: {
        ...profileFromDb(r.userId, r.username, r.isAdmin),
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
  const tokens = makeAccessJwt(s.userId, s.username, s.isAdmin);
  saveRefreshToken(tokens.refreshToken, { userId: s.userId, username: s.username, isAdmin: s.isAdmin });
  res.json({
    success: true,
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokens.expires
    }
  } satisfies RefreshResponse);
});

