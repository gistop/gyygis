import OSS from "ali-oss";
import { parse } from "csv-parse/sync";
import axios from "axios";
import pg from "pg";
import * as XLSX from "xlsx";
import { tenantDatastoreName } from "./tenant.js";

const LON_ALIASES = ["lon", "lng", "longitude", "x", "经度"];
const LAT_ALIASES = ["lat", "latitude", "y", "纬度"];
const NAME_ALIASES = ["name", "label", "名称", "title"];

const MAX_GEOJSON_FEATURES = 200_000;

export type PublishCsvBody = {
  objectKey: string;
  /** 字母开头的标识，将存为表名 gyy_csv_<name> */
  tableBase: string;
  lonColumn?: string;
  latColumn?: string;
  nameColumn?: string;
};

/** 与 CSV 相同：首表 + 经纬度列 → 点图层 */
export type PublishXlsxBody = PublishCsvBody;

export type PublishGeojsonBody = {
  objectKey: string;
  /** 字母开头的标识，将存为表名 gyy_geojson_<name> */
  tableBase: string;
};

export type PublishCsvContext = {
  userId: number;
  /** PostGIS schema，例如 u_12 */
  schema: string;
  /** GeoServer workspace，例如 u_12 */
  workspace: string;
  /** 允许写入的 OSS objectKey 前缀，例如 uploads/u_12/ */
  uploadPrefix: string;
};

export type PublishCsvResult = {
  tableName: string;
  workspace: string;
  datastore: string;
  layerName: string;
  rowsInserted: number;
  rowsSkipped: number;
  wmsLayersParam: string;
};

function readEnv() {
  const postgresHost = process.env.POSTGRES_HOST ?? "";
  const postgresPort = Number(process.env.POSTGRES_PORT ?? "5432");
  const postgresUser = process.env.POSTGRES_USER ?? "";
  const postgresPassword = process.env.POSTGRES_PASSWORD ?? "";
  const postgresDb = process.env.POSTGRES_DB ?? "";
  const ossBucket = process.env.ALIYUN_OSS_BUCKET ?? "";
  const ossRegion = process.env.ALIYUN_OSS_REGION ?? "";
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET ?? "";
  const uploadPrefix = (process.env.ALIYUN_OSS_UPLOAD_PREFIX ?? "uploads/").replace(
    /\/?$/,
    "/"
  );
  const geoserverUrl = (process.env.GEOSERVER_INTERNAL_URL ?? "").replace(/\/$/, "");
  const geoserverUser = process.env.GEOSERVER_USER ?? "";
  const geoserverPassword = process.env.GEOSERVER_PASSWORD ?? "";
  return {
    postgresHost,
    postgresPort,
    postgresUser,
    postgresPassword,
    postgresDb,
    ossBucket,
    ossRegion,
    accessKeyId,
    accessKeySecret,
    uploadPrefix,
    geoserverUrl,
    geoserverUser,
    geoserverPassword
  };
}

export function isMapPublishConfigured(): boolean {
  const e = readEnv();
  return Boolean(
    e.postgresHost &&
      e.postgresUser &&
      e.postgresDb &&
      e.ossBucket &&
      e.ossRegion &&
      e.accessKeyId &&
      e.accessKeySecret &&
      e.geoserverUrl &&
      e.geoserverUser
  );
}

/** 列出/启停图层只需要 PostGIS + GeoServer（不依赖 OSS AK） */
export function isGeoMapsConfigured(): boolean {
  const e = readEnv();
  return Boolean(
    e.postgresHost && e.postgresUser && e.postgresDb && e.geoserverUrl && e.geoserverUser && e.geoserverPassword
  );
}

function tableSlugFromBase(tableBase: string): string {
  const slug = tableBase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!slug || slug.length < 2) {
    throw new Error("tableBase 过短：请使用至少 2 个字符的英文/数字/下划线标识");
  }
  if (!/^[a-z]/.test(slug)) {
    throw new Error("tableBase 须以字母开头");
  }
  if (slug.length > 48) {
    throw new Error("tableBase 过长");
  }
  return slug;
}

/** 生成 PostGIS 表名：gyy_csv_<slug> */
export function toCsvTableName(tableBase: string): string {
  return `gyy_csv_${tableSlugFromBase(tableBase)}`;
}

/** 生成 PostGIS 表名：gyy_xlsx_<slug> */
export function toXlsxTableName(tableBase: string): string {
  return `gyy_xlsx_${tableSlugFromBase(tableBase)}`;
}

/** 生成 PostGIS 表名：gyy_geojson_<slug> */
export function toGeojsonTableName(tableBase: string): string {
  return `gyy_geojson_${tableSlugFromBase(tableBase)}`;
}

function assertSafeObjectKey(key: string, allowedPrefix: string): void {
  if (!key || key.includes("..") || key.startsWith("/")) {
    throw new Error("非法 objectKey");
  }
  if (!key.startsWith(allowedPrefix)) {
    throw new Error(`objectKey 必须以配置的前缀开头：${allowedPrefix}`);
  }
}

function pickColumn(
  headers: string[],
  explicit: string | undefined,
  aliases: string[]
): string {
  if (explicit?.trim()) {
    const want = explicit.trim().toLowerCase();
    const found = headers.find(h => h.trim().toLowerCase() === want);
    if (!found) {
      throw new Error(`未找到列：${explicit.trim()}（可用列：${headers.join(", ")}）`);
    }
    return found;
  }
  const lower = new Map(headers.map(h => [h.toLowerCase().trim(), h]));
  for (const a of aliases) {
    const h = lower.get(a);
    if (h) return h;
  }
  throw new Error(
    `无法自动识别列，请传入 lonColumn/latColumn。表头：${headers.join(", ")}`
  );
}

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const e = readEnv();
  pool = new pg.Pool({
    host: e.postgresHost,
    port: e.postgresPort,
    user: e.postgresUser,
    password: e.postgresPassword,
    database: e.postgresDb,
    max: 4
  });
  return pool;
}

async function fetchOssBuffer(objectKey: string): Promise<Buffer> {
  const e = readEnv();
  const client = new OSS({
    region: e.ossRegion,
    accessKeyId: e.accessKeyId,
    accessKeySecret: e.accessKeySecret,
    bucket: e.ossBucket,
    secure: true
  });
  const r = await client.get(objectKey);
  const buf = r.content as Buffer | string;
  if (Buffer.isBuffer(buf)) return buf;
  return Buffer.from(buf, "utf8");
}

async function geoserverDeleteFeatureType(
  baseUrl: string,
  user: string,
  pass: string,
  workspace: string,
  datastore: string,
  layerName: string
): Promise<void> {
  const url = `${baseUrl}/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(datastore)}/featuretypes/${encodeURIComponent(layerName)}`;
  try {
    await axios.delete(url, {
      auth: { username: user, password: pass },
      validateStatus: s => s < 500
    });
  } catch {
    /* 忽略网络错误，创建阶段会再失败 */
  }
}

async function geoserverCreateFeatureType(
  baseUrl: string,
  user: string,
  pass: string,
  workspace: string,
  datastore: string,
  tableName: string
): Promise<void> {
  const url = `${baseUrl}/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(datastore)}/featuretypes`;
  const xml = `<featureType>
  <name>${tableName}</name>
  <nativeName>${tableName}</nativeName>
  <srs>EPSG:4326</srs>
  <nativeCRS>EPSG:4326</nativeCRS>
  <projectionPolicy>REPROJECT_TO_DECLARED</projectionPolicy>
</featureType>`;
  const res = await axios.post(url, xml, {
    auth: { username: user, password: pass },
    headers: { "Content-Type": "application/xml" },
    validateStatus: () => true
  });
  if (res.status >= 200 && res.status < 300) return;
  throw new Error(
    `GeoServer 发布失败 HTTP ${res.status}: ${typeof res.data === "string" ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500)}`
  );
}

async function geoserverPublishTable(
  workspace: string,
  datastore: string,
  tableName: string
): Promise<void> {
  const e = readEnv();
  await geoserverDeleteFeatureType(
    e.geoserverUrl,
    e.geoserverUser,
    e.geoserverPassword,
    workspace,
    datastore,
    tableName
  );
  await geoserverCreateFeatureType(
    e.geoserverUrl,
    e.geoserverUser,
    e.geoserverPassword,
    workspace,
    datastore,
    tableName
  );
}

async function replacePointFeatureTable(
  client: pg.PoolClient,
  schema: string,
  tableName: string,
  rows: Record<string, unknown>[],
  lonCol: string,
  latCol: string,
  nameCol: string | null
): Promise<{ inserted: number; skipped: number }> {
  await client.query(
    `DROP TABLE IF EXISTS ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} CASCADE`
  );
  await client.query(`
      CREATE TABLE ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} (
        id SERIAL PRIMARY KEY,
        name TEXT,
        geom geometry(Point, 4326)
      )
    `);
  await client.query(
    `CREATE INDEX ${pg.escapeIdentifier(`${tableName}_geom_gix`)} ON ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} USING GIST (geom)`
  );

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const lon = Number(String(row[lonCol] ?? "").replace(",", "."));
    const lat = Number(String(row[latCol] ?? "").replace(",", "."));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      skipped++;
      continue;
    }
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      skipped++;
      continue;
    }
    const nm =
      nameCol && row[nameCol] != null && String(row[nameCol]).trim() !== ""
        ? String(row[nameCol]).slice(0, 512)
        : null;
    await client.query(
      `INSERT INTO ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} (name, geom) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326))`,
      [nm, lon, lat]
    );
    inserted++;
  }
  return { inserted, skipped };
}

function resolveLonLatNameColumns(
  headers: string[],
  body: Pick<PublishCsvBody, "lonColumn" | "latColumn" | "nameColumn">
): { lonCol: string; latCol: string; nameCol: string | null } {
  const lonCol = pickColumn(headers, body.lonColumn, LON_ALIASES);
  const latCol = pickColumn(headers, body.latColumn, LAT_ALIASES);
  let nameCol: string | null = null;
  if (body.nameColumn?.trim()) {
    nameCol = pickColumn(headers, body.nameColumn, []);
  } else {
    try {
      nameCol = pickColumn(headers, undefined, NAME_ALIASES);
    } catch {
      nameCol = null;
    }
  }
  return { lonCol, latCol, nameCol };
}

export async function publishCsvFromOss(ctx: PublishCsvContext, body: PublishCsvBody): Promise<PublishCsvResult> {
  if (!isMapPublishConfigured()) {
    throw new Error(
      "发布功能未配置：请设置 POSTGRES_*、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_ACCESS_KEY_*、GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD"
    );
  }
  const e = readEnv();
  assertSafeObjectKey(body.objectKey.trim(), ctx.uploadPrefix);
  const tableName = toCsvTableName(body.tableBase);
  const schema = ctx.schema;
  const workspace = ctx.workspace;
  const datastore = tenantDatastoreName();
  if (!/^u_[1-9][0-9]*$/.test(schema) || schema !== workspace) {
    throw new Error("非法租户 schema/workspace");
  }

  const raw = await fetchOssBuffer(body.objectKey.trim());
  const text = raw.toString("utf8");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  }) as Record<string, string>[];

  if (!records.length) {
    throw new Error("CSV 无数据行");
  }
  const headers = Object.keys(records[0]);
  const { lonCol, latCol, nameCol } = resolveLonLatNameColumns(headers, body);

  const poolInst = getPool();
  const client = await poolInst.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    const r = await replacePointFeatureTable(client, schema, tableName, records, lonCol, latCol, nameCol);
    inserted = r.inserted;
    skipped = r.skipped;
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (inserted === 0) {
    throw new Error("没有有效经纬度行可写入（请检查列名与数值）");
  }

  await geoserverPublishTable(workspace, datastore, tableName);

  return {
    tableName,
    workspace,
    datastore,
    layerName: tableName,
    rowsInserted: inserted,
    rowsSkipped: skipped,
    wmsLayersParam: `${workspace}:${tableName}`
  };
}

export async function publishXlsxFromOss(
  ctx: PublishCsvContext,
  body: PublishXlsxBody
): Promise<PublishCsvResult> {
  if (!isMapPublishConfigured()) {
    throw new Error(
      "发布功能未配置：请设置 POSTGRES_*、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_ACCESS_KEY_*、GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD"
    );
  }
  assertSafeObjectKey(body.objectKey.trim(), ctx.uploadPrefix);
  const tableName = toXlsxTableName(body.tableBase);
  const schema = ctx.schema;
  const workspace = ctx.workspace;
  const datastore = tenantDatastoreName();
  if (!/^u_[1-9][0-9]*$/.test(schema) || schema !== workspace) {
    throw new Error("非法租户 schema/workspace");
  }

  const raw = await fetchOssBuffer(body.objectKey.trim());
  const wb = XLSX.read(raw, { type: "buffer", cellDates: true });
  if (!wb.SheetNames.length) {
    throw new Error("xlsx 无工作表");
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });
  if (!records.length) {
    throw new Error("xlsx 首表无数据行");
  }
  const headers = Object.keys(records[0]).map(h => String(h));
  const { lonCol, latCol, nameCol } = resolveLonLatNameColumns(headers, body);

  const poolInst = getPool();
  const client = await poolInst.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    const r = await replacePointFeatureTable(client, schema, tableName, records, lonCol, latCol, nameCol);
    inserted = r.inserted;
    skipped = r.skipped;
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (inserted === 0) {
    throw new Error("没有有效经纬度行可写入（请检查列名与数值）");
  }

  await geoserverPublishTable(workspace, datastore, tableName);

  return {
    tableName,
    workspace,
    datastore,
    layerName: tableName,
    rowsInserted: inserted,
    rowsSkipped: skipped,
    wmsLayersParam: `${workspace}:${tableName}`
  };
}

type GeoJsonFeature = {
  type?: string;
  geometry?: unknown;
  properties?: Record<string, unknown> | null;
};

function parseGeoJsonFeatures(buf: Buffer): GeoJsonFeature[] {
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const root = JSON.parse(text) as {
    type?: string;
    features?: unknown[];
    geometry?: unknown;
    properties?: Record<string, unknown> | null;
  };
  if (root.type === "FeatureCollection") {
    const feats = root.features;
    if (!Array.isArray(feats)) {
      throw new Error("GeoJSON FeatureCollection.features 须为数组");
    }
    return feats.filter(
      (f): f is GeoJsonFeature =>
        Boolean(f) && typeof f === "object" && (f as GeoJsonFeature).type === "Feature"
    );
  }
  if (root.type === "Feature") {
    return [root as GeoJsonFeature];
  }
  throw new Error("仅支持 GeoJSON FeatureCollection 或单个 Feature");
}

function pickNameFromProperties(props: Record<string, unknown>): string | null {
  const lower = new Map(
    Object.keys(props).map(k => [k.toLowerCase().trim(), props[k] as unknown])
  );
  for (const a of NAME_ALIASES) {
    const v = lower.get(a);
    if (v != null && String(v).trim() !== "") {
      return String(v).slice(0, 512);
    }
  }
  return null;
}

export async function publishGeojsonFromOss(
  ctx: PublishCsvContext,
  body: PublishGeojsonBody
): Promise<PublishCsvResult> {
  if (!isMapPublishConfigured()) {
    throw new Error(
      "发布功能未配置：请设置 POSTGRES_*、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION、ALIYUN_ACCESS_KEY_*、GEOSERVER_INTERNAL_URL、GEOSERVER_USER、GEOSERVER_PASSWORD"
    );
  }
  assertSafeObjectKey(body.objectKey.trim(), ctx.uploadPrefix);
  const tableName = toGeojsonTableName(body.tableBase);
  const schema = ctx.schema;
  const workspace = ctx.workspace;
  const datastore = tenantDatastoreName();
  if (!/^u_[1-9][0-9]*$/.test(schema) || schema !== workspace) {
    throw new Error("非法租户 schema/workspace");
  }

  const raw = await fetchOssBuffer(body.objectKey.trim());
  const features = parseGeoJsonFeatures(raw);
  if (!features.length) {
    throw new Error("GeoJSON 无 Feature");
  }
  if (features.length > MAX_GEOJSON_FEATURES) {
    throw new Error(`要素数量超过上限 ${MAX_GEOJSON_FEATURES}`);
  }

  const poolInst = getPool();
  const client = await poolInst.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    await client.query(
      `DROP TABLE IF EXISTS ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} CASCADE`
    );
    await client.query(`
      CREATE TABLE ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} (
        id SERIAL PRIMARY KEY,
        name TEXT,
        properties JSONB,
        geom geometry
      )
    `);
    await client.query(
      `CREATE INDEX ${pg.escapeIdentifier(`${tableName}_geom_gix`)} ON ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} USING GIST (geom)`
    );

    for (const f of features) {
      const g = f.geometry;
      if (g == null || typeof g !== "object") {
        skipped++;
        continue;
      }
      const geomStr = JSON.stringify(g);
      const props =
        f.properties && typeof f.properties === "object" && !Array.isArray(f.properties)
          ? (f.properties as Record<string, unknown>)
          : {};
      const nm = pickNameFromProperties(props);
      const propsJson = JSON.stringify(props);
      try {
        await client.query(
          `INSERT INTO ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(tableName)} (name, properties, geom) VALUES ($1, $2::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($3::text), 4326))`,
          [nm, propsJson, geomStr]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (inserted === 0) {
    throw new Error("没有可写入的有效几何（请检查 GeoJSON 几何是否为 PostGIS 支持的类型）");
  }

  await geoserverPublishTable(workspace, datastore, tableName);

  return {
    tableName,
    workspace,
    datastore,
    layerName: tableName,
    rowsInserted: inserted,
    rowsSkipped: skipped,
    wmsLayersParam: `${workspace}:${tableName}`
  };
}
