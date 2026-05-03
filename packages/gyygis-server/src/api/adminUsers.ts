import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import { requireAuth } from "../middleware/auth.js";
import { getDbPool, isDbConfigured } from "../db.js";

export const adminUsersRouter = Router();

/** 与 auth 注册/登录路径对齐，保证列表可读到租户相关列 */
let ensuredUserColumns = false;
async function ensureUserListColumns(pool: Pool) {
  if (ensuredUserColumns) return;
  await pool.query(`
    ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS tenant_schema text,
      ADD COLUMN IF NOT EXISTS tenant_workspace text,
      ADD COLUMN IF NOT EXISTS geoserver_ready boolean NOT NULL DEFAULT FALSE
  `);
  ensuredUserColumns = true;
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
  geoserver_ready: boolean | null;
};

function toDto(row: UserRow) {
  return {
    id: Number(row.id),
    username: row.username,
    isAdmin: row.is_admin,
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
      SELECT id, username, is_admin, is_active, geoserver_ready
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

  try {
    await ensureUserListColumns(pool);
  } catch {
    /* ignore */
  }

  try {
    const cur = await pool.query<UserRow>(
      `SELECT id, username, is_admin, is_active, geoserver_ready FROM auth.users WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = cur.rows[0];
    if (!row) {
      res.status(404).json({ success: false, error: "用户不存在" });
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
      RETURNING id, username, is_admin, is_active, geoserver_ready
      `,
      [id, nextActive, nextAdmin]
    );
    res.json({ success: true, data: toDto(upd.rows[0]) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: message });
  }
});
