import axios from "axios";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDbPool, isDbConfigured } from "../db.js";

export const webMapServicesRouter = Router();
webMapServicesRouter.use(requireAuth);

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "需要管理员权限" });
    return false;
  }
  return true;
}

const ALLOWED_TYPES = new Set(["xyz"]);

function slugCode(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 48);
  return base || "svc";
}

/** GET /api/web-map-services 合并目录与当前用户配置；密钥永不返回明文 */
webMapServicesRouter.get("/", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }
  const uid = req.user!.userId;
  const isAdmin = req.user!.isAdmin;
  try {
    const pool = getDbPool();
    const q = await pool.query<{
      id: string;
      code: string;
      name: string;
      service_type: string;
      service_url: string;
      requires_user_key: boolean;
      is_enabled: boolean;
      sort_order: string;
      admin_key_len: number | null;
      user_key_len: number | null;
      user_is_enabled: boolean | null;
    }>(
      `
      SELECT
        c.id::text,
        c.code,
        c.name,
        c.service_type,
        c.service_url,
        c.requires_user_key,
        c.is_enabled,
        c.sort_order::text,
        length(coalesce(c.admin_api_key, '')) AS admin_key_len,
        length(coalesce(u.user_api_key, '')) AS user_key_len,
        u.is_enabled AS user_is_enabled
      FROM auth.web_map_service_catalog c
      LEFT JOIN auth.user_web_map_services u
        ON u.catalog_id = c.id AND u.user_id = $1
      WHERE ($2::boolean OR c.is_enabled = TRUE)
      ORDER BY c.sort_order ASC, c.id ASC
      `,
      [uid, isAdmin]
    );

    res.json({
      services: q.rows.map(r => ({
        catalogId: Number(r.id),
        code: r.code,
        name: r.name,
        serviceType: r.service_type,
        serviceUrl: r.service_url,
        requiresUserKey: r.requires_user_key,
        catalogEnabled: r.is_enabled,
        sortOrder: Number(r.sort_order),
        hasAdminKey: (r.admin_key_len ?? 0) > 0,
        hasUserKey: (r.user_key_len ?? 0) > 0,
        userEnabled: r.user_is_enabled === true
      }))
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[web-map-services GET]", e);
    res.status(500).json({ error: msg });
  }
});

/** POST /api/web-map-services/catalog 管理员新增目录项 */
webMapServicesRouter.post("/catalog", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }
  if (!requireAdmin(req, res)) return;

  const body = req.body ?? {};
  const name = String(body.name ?? "").trim();
  let code = String(body.code ?? "").trim().toLowerCase();
  const serviceType = String(body.serviceType ?? body.service_type ?? "xyz").toLowerCase();
  const serviceUrl = String(body.serviceUrl ?? body.service_url ?? "").trim();
  const adminApiKey =
    body.adminApiKey !== undefined && body.adminApiKey !== null
      ? String(body.adminApiKey)
      : body.admin_api_key !== undefined && body.admin_api_key !== null
        ? String(body.admin_api_key)
        : null;
  const requiresUserKey = body.requiresUserKey !== false && body.requires_user_key !== false;
  const isEnabled = body.isEnabled !== false && body.is_enabled !== false;
  const sortOrder = Number(body.sortOrder ?? body.sort_order ?? 0) || 0;

  if (!name) {
    res.status(400).json({ error: "请填写名称" });
    return;
  }
  if (!ALLOWED_TYPES.has(serviceType)) {
    res.status(400).json({ error: "仅支持服务类型 xyz" });
    return;
  }
  if (!serviceUrl || !/^https?:\/\//i.test(serviceUrl)) {
    res.status(400).json({ error: "服务地址需为 http(s) URL" });
    return;
  }
  if (!code) code = slugCode(name);
  if (!/^[a-z0-9_]+$/.test(code)) {
    res.status(400).json({ error: "标识 code 仅允许小写字母、数字、下划线" });
    return;
  }

  try {
    const pool = getDbPool();
    const ins = await pool.query<{ id: string }>(
      `
      INSERT INTO auth.web_map_service_catalog
        (code, name, service_type, service_url, admin_api_key, requires_user_key, is_enabled, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id::text
      `,
      [
        code,
        name,
        serviceType,
        serviceUrl,
        adminApiKey && adminApiKey.trim() ? adminApiKey.trim() : null,
        requiresUserKey,
        isEnabled,
        sortOrder
      ]
    );
    res.status(201).json({ catalogId: Number(ins.rows[0]?.id) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (String(msg).includes("unique") || String(msg).includes("duplicate")) {
      res.status(409).json({ error: "标识 code 已存在" });
      return;
    }
    console.error("[web-map-services POST catalog]", e);
    res.status(500).json({ error: msg });
  }
});

/** PATCH /api/web-map-services/catalog/:id 管理员更新目录 */
webMapServicesRouter.patch("/catalog/:id", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "非法 id" });
    return;
  }

  const body = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];
  let n = 1;

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      res.status(400).json({ error: "名称不能为空" });
      return;
    }
    fields.push(`name = $${n++}`);
    values.push(name);
  }
  if (body.serviceUrl !== undefined || body.service_url !== undefined) {
    const u = String(body.serviceUrl ?? body.service_url ?? "").trim();
    if (!u || !/^https?:\/\//i.test(u)) {
      res.status(400).json({ error: "服务地址需为 http(s) URL" });
      return;
    }
    fields.push(`service_url = $${n++}`);
    values.push(u);
  }
  if (body.serviceType !== undefined || body.service_type !== undefined) {
    const t = String(body.serviceType ?? body.service_type ?? "").toLowerCase();
    if (!ALLOWED_TYPES.has(t)) {
      res.status(400).json({ error: "仅支持服务类型 xyz" });
      return;
    }
    fields.push(`service_type = $${n++}`);
    values.push(t);
  }
  if (body.requiresUserKey !== undefined || body.requires_user_key !== undefined) {
    fields.push(`requires_user_key = $${n++}`);
    values.push(Boolean(body.requiresUserKey ?? body.requires_user_key));
  }
  if (body.isEnabled !== undefined || body.is_enabled !== undefined) {
    fields.push(`is_enabled = $${n++}`);
    values.push(Boolean(body.isEnabled ?? body.is_enabled));
  }
  if (body.sortOrder !== undefined || body.sort_order !== undefined) {
    fields.push(`sort_order = $${n++}`);
    values.push(Number(body.sortOrder ?? body.sort_order) || 0);
  }
  if (body.adminApiKey !== undefined || body.admin_api_key !== undefined) {
    const k = body.adminApiKey ?? body.admin_api_key;
    if (k === null || k === "") {
      fields.push(`admin_api_key = $${n++}`);
      values.push(null);
    } else {
      const s = String(k).trim();
      fields.push(`admin_api_key = $${n++}`);
      values.push(s || null);
    }
  }

  if (fields.length === 0) {
    res.status(400).json({ error: "无更新字段" });
    return;
  }

  fields.push(`updated_at = now()`);
  values.push(id);

  try {
    const pool = getDbPool();
    const r = await pool.query(
      `UPDATE auth.web_map_service_catalog SET ${fields.join(", ")} WHERE id = $${n}`,
      values
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "记录不存在" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[web-map-services PATCH catalog]", e);
    res.status(500).json({ error: msg });
  }
});

/** DELETE /api/web-map-services/catalog/:id 管理员删除 */
webMapServicesRouter.delete("/catalog/:id", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "非法 id" });
    return;
  }

  try {
    const pool = getDbPool();
    const r = await pool.query(`DELETE FROM auth.web_map_service_catalog WHERE id = $1`, [id]);
    if (r.rowCount === 0) {
      res.status(404).json({ error: "记录不存在" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[web-map-services DELETE catalog]", e);
    res.status(500).json({ error: msg });
  }
});

/** PUT /api/web-map-services/me/:catalogId 当前用户设置自己的 key 与个人启用（密钥仅存服务端） */
webMapServicesRouter.put("/me/:catalogId", async (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }

  const catalogId = Number(req.params.catalogId);
  if (!Number.isFinite(catalogId) || catalogId <= 0) {
    res.status(400).json({ error: "非法 catalogId" });
    return;
  }

  const body = req.body ?? {};
  const hasKeyField = Object.prototype.hasOwnProperty.call(body, "userApiKey")
    || Object.prototype.hasOwnProperty.call(body, "user_api_key");
  const hasEnabledField =
    Object.prototype.hasOwnProperty.call(body, "isEnabled")
    || Object.prototype.hasOwnProperty.call(body, "is_enabled");

  if (!hasKeyField && !hasEnabledField) {
    res.status(400).json({ error: "需提供 userApiKey 或 isEnabled" });
    return;
  }

  try {
    const pool = getDbPool();
    const cat = await pool.query<{
      is_enabled: boolean;
      requires_user_key: boolean;
    }>(
      `SELECT is_enabled, requires_user_key FROM auth.web_map_service_catalog WHERE id = $1`,
      [catalogId]
    );
    if (cat.rowCount === 0) {
      res.status(404).json({ error: "服务不存在" });
      return;
    }
    if (!cat.rows[0].is_enabled) {
      res.status(403).json({ error: "该服务已全站停用" });
      return;
    }

    const requiresUserKey = cat.rows[0].requires_user_key;

    const cur = await pool.query<{ user_api_key: string | null; is_enabled: boolean }>(
      `SELECT user_api_key, is_enabled FROM auth.user_web_map_services WHERE user_id = $1 AND catalog_id = $2`,
      [req.user!.userId, catalogId]
    );
    const prev = cur.rows[0];

    let nextKey = prev?.user_api_key ?? null;
    if (hasKeyField) {
      const raw = String(body.userApiKey ?? body.user_api_key ?? "").trim();
      nextKey = raw.length > 0 ? raw : null;
    }

    let nextEnabled = prev?.is_enabled ?? false;
    if (hasEnabledField) {
      nextEnabled = Boolean(body.isEnabled ?? body.is_enabled);
    }

    if (requiresUserKey && (!nextKey || nextKey.length === 0)) {
      nextEnabled = false;
    }

    await pool.query(
      `
      INSERT INTO auth.user_web_map_services (user_id, catalog_id, user_api_key, is_enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, catalog_id)
      DO UPDATE SET
        user_api_key = EXCLUDED.user_api_key,
        is_enabled = EXCLUDED.is_enabled,
        updated_at = now()
      `,
      [req.user!.userId, catalogId, nextKey, nextEnabled]
    );

    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[web-map-services PUT me]", e);
    res.status(500).json({ error: msg });
  }
});

type TileQuery = {
  x?: string;
  y?: string;
  z?: string;
};

function pickRandomSubDomain(u: string): string {
  if (u.includes("{0-7}")) {
    const n = Math.floor(Math.random() * 8);
    return u.replaceAll("{0-7}", String(n));
  }
  if (u.includes("{s}")) {
    const n = Math.floor(Math.random() * 8);
    return u.replaceAll("{s}", String(n));
  }
  return u;
}

function applyXyzTemplate(template: string, args: { x: string; y: string; z: string; key: string }): string {
  const withSub = pickRandomSubDomain(template);
  return withSub
    .replaceAll("{x}", args.x)
    .replaceAll("{y}", args.y)
    .replaceAll("{z}", args.z)
    .replaceAll("{key}", encodeURIComponent(args.key))
    .replaceAll("{tk}", encodeURIComponent(args.key));
}

async function proxyTile(res: Response, url: string): Promise<void> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      validateStatus: () => true,
      timeout: 60_000,
      headers: { "User-Agent": "Gyygis-TileProxy/1.0" }
    });
    const { status, data, headers } = response;
    const contentType = headers["content-type"];
    if (contentType) res.setHeader("Content-Type", contentType);
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    res.status(status).send(body);
  } catch (e) {
    console.error("[web-map-services tile proxy]", e);
    res.status(502).send("获取瓦片失败");
  }
}

/** GET /api/web-map-services/tiles/:catalogId?x=&y=&z=（xyz）服务端取用户 key，不下发浏览器 */
webMapServicesRouter.get(
  "/tiles/:catalogId",
  async (req: Request<{ catalogId: string }, unknown, unknown, TileQuery>, res: Response) => {
    if (!isDbConfigured()) {
      res.status(503).send("数据库未配置");
      return;
    }
    const catalogId = Number(req.params.catalogId);
    if (!Number.isFinite(catalogId) || catalogId <= 0) {
      res.status(400).send("非法 catalogId");
      return;
    }
    const x = String(req.query.x ?? "");
    const y = String(req.query.y ?? "");
    const z = String(req.query.z ?? "");
    if (!x || !y || !z) {
      res.status(400).send("缺少 x/y/z");
      return;
    }

    try {
      const pool = getDbPool();
      const cat = await pool.query<{
        service_type: string;
        service_url: string;
        requires_user_key: boolean;
        is_enabled: boolean;
      }>(
        `SELECT service_type, service_url, requires_user_key, is_enabled
         FROM auth.web_map_service_catalog
         WHERE id = $1`,
        [catalogId]
      );
      if (cat.rowCount === 0) {
        res.status(404).send("服务不存在");
        return;
      }
      if (!cat.rows[0].is_enabled) {
        res.status(403).send("该服务已全站停用");
        return;
      }
      if (cat.rows[0].service_type !== "xyz") {
        res.status(400).send("仅支持 xyz");
        return;
      }

      const u = await pool.query<{ user_api_key: string | null; is_enabled: boolean }>(
        `SELECT user_api_key, is_enabled
         FROM auth.user_web_map_services
         WHERE user_id = $1 AND catalog_id = $2`,
        [req.user!.userId, catalogId]
      );
      const userRow = u.rows[0];
      if (!userRow || userRow.is_enabled !== true) {
        res.status(403).send("该服务对当前用户不可用");
        return;
      }
      const key = String(userRow.user_api_key ?? "").trim();
      if (!key) {
        res.status(403).send("未配置用户密钥");
        return;
      }
      if (cat.rows[0].requires_user_key && !key) {
        res.status(403).send("未配置用户密钥");
        return;
      }

      const url = applyXyzTemplate(String(cat.rows[0].service_url), { x, y, z, key });
      // TODO: 临时排障日志（包含 key 尾号），正式发布前必须删除或改为可控开关
      const safeUrl = url.replace(
        /([?&](?:tk|key)=)([^&]*)/gi,
        (_m, prefix: string, value: string) => {
          const tail3 = (value ?? "").slice(-3);
          return `${prefix}***${tail3}`;
        }
      );
      console.log("[web-map-services tiles] upstream", { catalogId, x, y, z, url: safeUrl });
      await proxyTile(res, url);
    } catch (e) {
      console.error("[web-map-services tiles]", e);
      res.status(500).send("瓦片代理失败");
    }
  }
);
