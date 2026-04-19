import axios from "axios";
import pg from "pg";
import { isMapPublishConfigured } from "./mapPublishFromOss.js";

const WORKSPACE = "geoworkspace";
const DATASTORE = "postgis_store";

function readGsEnv() {
  const postgresHost = process.env.POSTGRES_HOST ?? "";
  const postgresPort = Number(process.env.POSTGRES_PORT ?? "5432");
  const postgresUser = process.env.POSTGRES_USER ?? "";
  const postgresPassword = process.env.POSTGRES_PASSWORD ?? "";
  const postgresDb = process.env.POSTGRES_DB ?? "";
  const geoserverUrl = (process.env.GEOSERVER_INTERNAL_URL ?? "").replace(/\/$/, "");
  const geoserverUser = process.env.GEOSERVER_USER ?? "";
  const geoserverPassword = process.env.GEOSERVER_PASSWORD ?? "";
  return {
    postgresHost,
    postgresPort,
    postgresUser,
    postgresPassword,
    postgresDb,
    geoserverUrl,
    geoserverUser,
    geoserverPassword
  };
}

const auth = (user: string, pass: string) => ({ username: user, password: pass });

function assertSafeLayerName(name: string): void {
  if (!name || name.length > 63) {
    throw new Error("非法图层名");
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error("图层名仅允许字母、数字、下划线且不以数字开头");
  }
}

function normalizeFtList(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const ft = (raw as { featureTypes?: { featureType?: unknown } }).featureTypes?.featureType;
  if (!ft) return [];
  const arr = Array.isArray(ft) ? ft : [ft];
  return arr
    .map((x: unknown) => {
      if (typeof x === "object" && x !== null && "name" in x) {
        return String((x as { name: string }).name);
      }
      return "";
    })
    .filter(Boolean);
}

export type CatalogLayerRow = {
  name: string;
  enabled: boolean;
};

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const e = readGsEnv();
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

export async function listPostgisStoreLayers(): Promise<CatalogLayerRow[]> {
  if (!isMapPublishConfigured()) {
    throw new Error("地图服务未配置");
  }
  const e = readGsEnv();
  const listUrl = `${e.geoserverUrl}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes.json`;
  const listRes = await axios.get(listUrl, {
    auth: auth(e.geoserverUser, e.geoserverPassword),
    validateStatus: () => true
  });
  if (listRes.status !== 200) {
    throw new Error(
      `GeoServer 列出图层失败 HTTP ${listRes.status}: ${typeof listRes.data === "string" ? listRes.data.slice(0, 300) : ""}`
    );
  }
  const names = normalizeFtList(listRes.data);
  const rows: CatalogLayerRow[] = [];
  for (const name of names) {
    const layerUrl = `${e.geoserverUrl}/rest/workspaces/${WORKSPACE}/layers/${encodeURIComponent(name)}.json`;
    const lr = await axios.get(layerUrl, {
      auth: auth(e.geoserverUser, e.geoserverPassword),
      validateStatus: () => true
    });
    if (lr.status !== 200) {
      rows.push({ name, enabled: true });
      continue;
    }
    const layer = (lr.data as { layer?: { enabled?: boolean } })?.layer;
    const enabled = layer?.enabled !== false;
    rows.push({ name, enabled });
  }
  return rows;
}

export async function setLayerEnabled(layerName: string, enabled: boolean): Promise<void> {
  if (!isMapPublishConfigured()) {
    throw new Error("地图服务未配置");
  }
  assertSafeLayerName(layerName);
  const e = readGsEnv();
  const layerUrl = `${e.geoserverUrl}/rest/workspaces/${WORKSPACE}/layers/${encodeURIComponent(layerName)}.json`;
  const getRes = await axios.get(layerUrl, {
    auth: auth(e.geoserverUser, e.geoserverPassword),
    validateStatus: () => true
  });
  if (getRes.status !== 200) {
    throw new Error(`GeoServer 读取图层失败 HTTP ${getRes.status}: ${layerName}`);
  }
  const body = getRes.data as { layer?: Record<string, unknown> };
  if (!body.layer) {
    throw new Error("GeoServer 返回缺少 layer 字段");
  }
  const src = body.layer;
  const resObj = src.resource as Record<string, unknown> | undefined;
  const minimal: Record<string, unknown> = {
    name: src.name,
    type: src.type,
    enabled,
    defaultStyle: src.defaultStyle
  };
  if (resObj && typeof resObj["@class"] === "string" && typeof resObj.name === "string") {
    minimal.resource = { "@class": resObj["@class"], name: resObj.name };
  }
  const next = minimal;
  const putRes = await axios.put(
    `${e.geoserverUrl}/rest/workspaces/${WORKSPACE}/layers/${encodeURIComponent(layerName)}`,
    { layer: next },
    {
      auth: auth(e.geoserverUser, e.geoserverPassword),
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true
    }
  );
  if (putRes.status < 200 || putRes.status >= 300) {
    throw new Error(
      `GeoServer 更新图层失败 HTTP ${putRes.status}: ${typeof putRes.data === "string" ? putRes.data.slice(0, 400) : JSON.stringify(putRes.data).slice(0, 400)}`
    );
  }
}

export async function deleteLayerAndTable(layerName: string): Promise<void> {
  if (!isMapPublishConfigured()) {
    throw new Error("地图服务未配置");
  }
  assertSafeLayerName(layerName);
  const e = readGsEnv();
  const ftUrl = `${e.geoserverUrl}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes/${encodeURIComponent(layerName)}?recurse=true`;
  const delRes = await axios.delete(ftUrl, {
    auth: auth(e.geoserverUser, e.geoserverPassword),
    validateStatus: () => true
  });
  if (delRes.status !== 200 && delRes.status !== 204) {
    throw new Error(
      `GeoServer 删除图层失败 HTTP ${delRes.status}: ${typeof delRes.data === "string" ? delRes.data.slice(0, 400) : JSON.stringify(delRes.data).slice(0, 400)}`
    );
  }
  const poolInst = getPool();
  await poolInst.query(`DROP TABLE IF EXISTS ${pg.escapeIdentifier(layerName)} CASCADE`);
}
