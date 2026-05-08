import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import { requireAuth } from "../middleware/auth.js";
import { getDbPool, isDbConfigured } from "../db.js";
import { SUPER_ADMIN_USERNAME } from "../constants/users.js";
import {
  deleteGeoserverWorkspace,
  dropPostgisTenantSchema,
  tenantSchemaName,
  tenantWorkspaceName
} from "../services/tenant.js";

export const adminUsersRouter = Router();

/** 与 auth 注册/登录路径对齐，保证列表可读到租户相关列 */
let ensuredUserColumns = false;
async function ensureUserListColumns(pool: Pool) {
  if (ensuredUserColumns) return;
  await pool.query(`
    ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS tenant_schema text,
      ADD COLUMN IF NOT EXISTS tenant_workspace text,
      ADD COLUMN IF NOT EXISTS geoserver_ready boolean NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT FALSE
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.user_delete_audit (
      id bigserial PRIMARY KEY,
      target_user_id bigint NOT NULL,
      target_username text NOT NULL,
      actor_user_id bigint NOT NULL,
      actor_username text NOT NULL,
      tenant_schema text,
      tenant_workspace text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `UPDATE auth.users SET is_super_admin = TRUE, is_admin = TRUE WHERE username = $1`,
    [SUPER_ADMIN_USERNAME]
  );
  await pool.query(`UPDATE auth.users SET is_super_admin = FALSE WHERE username <> $1`, [
    SUPER_ADMIN_USERNAME
  ]);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS auth_users_one_super_admin
    ON auth.users ((1))
    WHERE is_super_admin
  `);
  await pool.query(`
    DO $c$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class r ON r.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = r.relnamespace
        WHERE c.conname = 'users_super_only_admin' AND n.nspname = 'auth' AND r.relname = 'users'
      ) THEN
        ALTER TABLE auth.users ADD CONSTRAINT users_super_only_admin
          CHECK (NOT is_super_admin OR username = '${SUPER_ADMIN_USERNAME}');
      END IF;
    END $c$
  `);
  await pool.query(`
    DO $c$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class r ON r.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = r.relnamespace
        WHERE c.conname = 'users_admin_must_be_super' AND n.nspname = 'auth' AND r.relname = 'users'
      ) THEN
        ALTER TABLE auth.users ADD CONSTRAINT users_admin_must_be_super
          CHECK (username <> '${SUPER_ADMIN_USERNAME}' OR is_super_admin = TRUE);
      END IF;
    END $c$
  `);
  ensuredUserColumns = true;
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

function isTenantCleanupConfigured(): boolean {
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

adminUsersRouter.use(requireAuth);
adminUsersRouter.use((req: Request, res: Response, next) => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ success: false, error: "需要管理员权限" });
    return;
  }
  next();
});

type UserRow = {
  id: string;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  is_super_admin: boolean;
  geoserver_ready: boolean | null;
  tenant_schema: string | null;
  tenant_workspace: string | null;
};

function toDto(row: UserRow) {
  return {
    id: Number(row.id),
    username: row.username,
    isAdmin: row.is_admin,
    isSuperAdmin: row.is_super_admin === true,
    isActive: row.is_active,
    geoserverReady: row.geoserver_ready === true
  };
}

function parsePositiveInt(v: unknown, fallback: number, max?: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (max !== undefined && n > max) return max;
  return Math.floor(n);
}

function targetIsElevated(row: UserRow): boolean {
  return row.is_super_admin === true || row.is_admin === true;
}

/** GET /api/admin/users?page=&pageSize=&q= */
adminUsersRouter.get("/", async (req: Request, res: Response) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置" });
    return;
  }
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = parsePositiveInt(req.query.pageSize, 10, 100);
  const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const offset = (page - 1) * pageSize;

  const pool = getDbPool();
  try {
    await ensureUserListColumns(pool);
  } catch {
    /* 无迁移权限时由后续查询报错 */
  }

  const params: unknown[] = [];
  let where = "TRUE";
  if (qRaw) {
    params.push(`%${qRaw}%`);
    where = `username ILIKE $1`;
  }

  try {
    const countSql = `SELECT COUNT(*)::bigint AS c FROM auth.users WHERE ${where}`;
    const countR = await pool.query<{ c: string }>(countSql, params);
    const total = Number(countR.rows[0]?.c ?? 0);

    const baseLen = params.length;
    const listSql = `
      SELECT id, username, is_admin, is_active, is_super_admin, geoserver_ready, tenant_schema, tenant_workspace
      FROM auth.users
      WHERE ${where}
      ORDER BY id ASC
      LIMIT $${baseLen + 1} OFFSET $${baseLen + 2}
    `;
    const listR = await pool.query<UserRow>(listSql, [...params, pageSize, offset]);
    res.json({
      success: true,
      data: {
        items: listR.rows.map(toDto),
        total
      }
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: message });
  }
});

type PatchBody = { isActive?: unknown; isAdmin?: unknown };

/** PATCH /api/admin/users/:id */
adminUsersRouter.patch("/:id", async (req: Request, res: Response) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "无效的用户 id" });
    return;
  }
  const body = req.body as PatchBody;
  const hasActive = typeof body.isActive === "boolean";
  const hasAdmin = typeof body.isAdmin === "boolean";
  if (!hasActive && !hasAdmin) {
    res.status(400).json({ success: false, error: "请提供 isActive 或 isAdmin" });
    return;
  }

  const pool = getDbPool();
  const actorId = req.user!.userId;
  const actorSuper = req.user!.isSuperAdmin === true;

  try {
    await ensureUserListColumns(pool);
  } catch {
    /* ignore */
  }

  try {
    const cur = await pool.query<UserRow>(
      `SELECT id, username, is_admin, is_active, is_super_admin, geoserver_ready, tenant_schema, tenant_workspace FROM auth.users WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = cur.rows[0];
    if (!row) {
      res.status(404).json({ success: false, error: "用户不存在" });
      return;
    }

    if (hasAdmin && !actorSuper) {
      res.status(403).json({ success: false, error: "仅超级管理员可授予或撤销管理员权限" });
      return;
    }

    if (hasActive && !actorSuper && targetIsElevated(row)) {
      res.status(403).json({ success: false, error: "无权修改该用户的启用状态" });
      return;
    }

    let nextActive = row.is_active;
    let nextAdmin = row.is_admin;

    if (hasActive) {
      const v = body.isActive as boolean;
      if (!v && id === actorId) {
        res.status(400).json({ success: false, error: "不能禁用当前登录账号" });
        return;
      }
      if (!v && row.is_admin) {
        const others = await pool.query<{ c: string }>(
          `SELECT COUNT(*)::bigint AS c FROM auth.users WHERE is_admin = TRUE AND is_active = TRUE AND id <> $1`,
          [id]
        );
        if (Number(others.rows[0]?.c ?? 0) < 1) {
          res.status(400).json({
            success: false,
            error: "不能禁用唯一的活跃管理员账号"
          });
          return;
        }
      }
      nextActive = v;
    }

    if (hasAdmin) {
      const v = body.isAdmin as boolean;
      if (row.username === SUPER_ADMIN_USERNAME) {
        res.status(400).json({ success: false, error: "不能修改内置超级管理员的管理员标记" });
        return;
      }
      if (!v && id === actorId) {
        res.status(400).json({ success: false, error: "不能撤销当前账号的管理员权限" });
        return;
      }
      if (!v && row.is_admin) {
        const admins = await pool.query<{ c: string }>(
          `SELECT COUNT(*)::bigint AS c FROM auth.users WHERE is_admin = TRUE`
        );
        if (Number(admins.rows[0]?.c ?? 0) <= 1) {
          res.status(400).json({ success: false, error: "系统中至少保留一名管理员" });
          return;
        }
      }
      nextAdmin = v;
    }

    const upd = await pool.query<UserRow>(
      `
      UPDATE auth.users
      SET is_active = $2, is_admin = $3
      WHERE id = $1
      RETURNING id, username, is_admin, is_active, is_super_admin, geoserver_ready, tenant_schema, tenant_workspace
      `,
      [id, nextActive, nextAdmin]
    );
    res.json({ success: true, data: toDto(upd.rows[0]) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: message });
  }
});

/** DELETE /api/admin/users/:id — 硬删；删前审计；租户资源尽力清理 */
adminUsersRouter.delete("/:id", async (req: Request, res: Response) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "无效的用户 id" });
    return;
  }

  const actorId = req.user!.userId;
  const actorSuper = req.user!.isSuperAdmin === true;
  const actorUsername = req.user!.username;

  if (id === actorId) {
    res.status(400).json({ success: false, error: "不能删除当前登录账号" });
    return;
  }

  const pool = getDbPool();
  try {
    await ensureUserListColumns(pool);
  } catch {
    /* ignore */
  }

  try {
    const cur = await pool.query<UserRow>(
      `SELECT id, username, is_admin, is_active, is_super_admin, geoserver_ready, tenant_schema, tenant_workspace FROM auth.users WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = cur.rows[0];
    if (!row) {
      res.status(404).json({ success: false, error: "用户不存在" });
      return;
    }

    if (row.username === SUPER_ADMIN_USERNAME || row.is_super_admin === true) {
      res.status(400).json({ success: false, error: "不能删除内置超级管理员账号" });
      return;
    }

    if (!actorSuper && row.is_admin) {
      res.status(403).json({ success: false, error: "无权删除管理员账号" });
      return;
    }

    if (row.is_admin) {
      const others = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::bigint AS c FROM auth.users WHERE is_admin = TRUE AND is_active = TRUE AND id <> $1`,
        [id]
      );
      if (Number(others.rows[0]?.c ?? 0) < 1) {
        res.status(400).json({ success: false, error: "删除后将没有活跃管理员，已阻止" });
        return;
      }
    }

    const uid = Number(row.id);
    const schemaFromRow = row.tenant_schema?.trim();
    const wsFromRow = row.tenant_workspace?.trim();
    const schema = schemaFromRow || tenantSchemaName(uid);
    const workspace = wsFromRow || tenantWorkspaceName(uid);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        INSERT INTO auth.user_delete_audit
          (target_user_id, target_username, actor_user_id, actor_username, tenant_schema, tenant_workspace)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [uid, row.username, actorId, actorUsername, schema, workspace]
      );
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [id]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    if (isTenantCleanupConfigured()) {
      const e = readGeoConnForTenant();
      try {
        await dropPostgisTenantSchema(pool, schema);
      } catch (err) {
        console.error("[adminUsers/delete] drop schema failed", schema, err);
      }
      try {
        await deleteGeoserverWorkspace(
          {
            geoserverUrl: e.geoserverUrl,
            geoserverUser: e.geoserverUser,
            geoserverPassword: e.geoserverPassword
          },
          workspace
        );
      } catch (err) {
        console.error("[adminUsers/delete] GeoServer workspace delete failed", workspace, err);
      }
    }

    res.json({ success: true, data: { id: uid } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: message });
  }
});
