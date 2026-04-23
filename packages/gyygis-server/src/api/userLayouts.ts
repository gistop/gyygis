import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDbPool, isDbConfigured } from "../db.js";

/** 与业务约定：大屏「默认布局」固定使用该名称，保存时写入并标记 is_default */
export const DEFAULT_USER_LAYOUT_NAME = "默认";

export const userLayoutsRouter = Router();

userLayoutsRouter.use(requireAuth);

type LayoutRow = {
  id: string;
  name: string;
  is_default: boolean;
  updated_at: Date;
};

userLayoutsRouter.get("/", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置" });
    return;
  }
  try {
    const pool = getDbPool();
    const r = await pool.query<LayoutRow>(
      `
      SELECT id, name, is_default, updated_at
      FROM auth.user_layouts
      WHERE user_id = $1
      ORDER BY is_default DESC, updated_at DESC
      `,
      [req.user!.userId]
    );
    res.json({
      success: true,
      data: r.rows.map(row => ({
        id: Number(row.id),
        name: row.name,
        isDefault: row.is_default,
        updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at)
      }))
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: msg });
  }
});

userLayoutsRouter.get("/item/:id", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "非法 id" });
    return;
  }
  try {
    const pool = getDbPool();
    const r = await pool.query<{ layout_json: unknown }>(
      `
      SELECT layout_json
      FROM auth.user_layouts
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [id, req.user!.userId]
    );
    const row = r.rows[0];
    if (!row) {
      res.status(404).json({ success: false, error: "布局不存在" });
      return;
    }
    res.json({ success: true, data: { layout: row.layout_json } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: msg });
  }
});

userLayoutsRouter.put("/default", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ success: false, error: "数据库未配置" });
    return;
  }
  const layout = req.body?.layout;
  if (layout === null || typeof layout !== "object" || Array.isArray(layout)) {
    res.status(400).json({ success: false, error: "请求体需包含对象字段 layout" });
    return;
  }
  const uid = req.user!.userId;
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE auth.user_layouts SET is_default = FALSE WHERE user_id = $1`, [uid]);
    await client.query(
      `
      INSERT INTO auth.user_layouts (user_id, name, layout_json, is_default)
      VALUES ($1, $2, $3::jsonb, TRUE)
      ON CONFLICT (user_id, name)
      DO UPDATE SET
        layout_json = EXCLUDED.layout_json,
        is_default = TRUE,
        updated_at = now()
      `,
      [uid, DEFAULT_USER_LAYOUT_NAME, JSON.stringify(layout)]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: msg });
  } finally {
    client.release();
  }
});
