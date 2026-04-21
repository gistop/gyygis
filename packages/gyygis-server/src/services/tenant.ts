import axios from "axios";
import type pg from "pg";

export function tenantSchemaName(userId: number): string {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("非法 userId");
  }
  return `u_${userId}`;
}

/** GeoServer workspace 名：与 schema 对齐，便于排查 */
export function tenantWorkspaceName(userId: number): string {
  return tenantSchemaName(userId);
}

export function tenantDatastoreName(): string {
  // 每个 workspace 下各自一个 datastore，名称固定即可
  return "postgis_store";
}

export function userOssUploadPrefix(userId: number): string {
  const base = (process.env.ALIYUN_OSS_UPLOAD_PREFIX ?? "uploads/").replace(/\/?$/, "/");
  return `${base}u_${userId}/`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type PgConn = {
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
};

type GeoCreds = {
  geoserverUrl: string;
  geoserverUser: string;
  geoserverPassword: string;
};

const geoserverAuth = (user: string, pass: string) => ({ username: user, password: pass });

export async function ensurePostgisTenantSchema(pool: pg.Pool, schema: string): Promise<void> {
  // schema 名由服务端生成（u_<id>），避免 SQL 注入
  if (!/^u_[1-9][0-9]*$/.test(schema)) {
    throw new Error("非法 schema");
  }
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
}

export async function ensureGeoserverWorkspaceAndStore(
  pgConn: PgConn,
  geo: GeoCreds,
  workspace: string
): Promise<void> {
  if (!/^u_[1-9][0-9]*$/.test(workspace)) {
    throw new Error("非法 workspace");
  }
  const baseUrl = geo.geoserverUrl.replace(/\/$/, "");
  const auth = geoserverAuth(geo.geoserverUser, geo.geoserverPassword);
  const DATASTORE = tenantDatastoreName();

  const wsUrl = `${baseUrl}/rest/workspaces/${encodeURIComponent(workspace)}.json`;
  const wsGet = await axios.get(wsUrl, { auth, validateStatus: () => true });
  if (wsGet.status !== 200) {
    if (wsGet.status !== 404) {
      throw new Error(
        `GeoServer 检查工作区失败 HTTP ${wsGet.status}: ${typeof wsGet.data === "string" ? wsGet.data.slice(0, 300) : ""}`
      );
    }
    const wsPost = await axios.post(
      `${baseUrl}/rest/workspaces`,
      `<workspace><name>${workspace}</name></workspace>`,
      {
        auth,
        headers: { "Content-Type": "application/xml" },
        validateStatus: () => true
      }
    );
    if (wsPost.status < 200 || wsPost.status >= 300) {
      if (wsPost.status !== 409) {
        throw new Error(
          `GeoServer 创建工作区失败 HTTP ${wsPost.status}: ${typeof wsPost.data === "string" ? wsPost.data.slice(0, 400) : JSON.stringify(wsPost.data).slice(0, 400)}`
        );
      }
    }
  }

  const dsUrl = `${baseUrl}/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(DATASTORE)}.json`;
  const dsGet = await axios.get(dsUrl, { auth, validateStatus: () => true });
  if (dsGet.status === 200) return;
  if (dsGet.status !== 404) {
    throw new Error(
      `GeoServer 检查数据存储失败 HTTP ${dsGet.status}: ${typeof dsGet.data === "string" ? dsGet.data.slice(0, 300) : ""}`
    );
  }

  const host = escapeXml(pgConn.postgresHost);
  const port = String(pgConn.postgresPort);
  const database = escapeXml(pgConn.postgresDb);
  const dbUser = escapeXml(pgConn.postgresUser);
  const dbPass = escapeXml(pgConn.postgresPassword);

  const dsXml = `<dataStore>
  <name>${DATASTORE}</name>
  <connectionParameters>
    <host>${host}</host>
    <port>${port}</port>
    <database>${database}</database>
    <user>${dbUser}</user>
    <passwd>${dbPass}</passwd>
    <dbtype>postgis</dbtype>
    <schema>${workspace}</schema>
  </connectionParameters>
</dataStore>`;

  const dsPost = await axios.post(
    `${baseUrl}/rest/workspaces/${encodeURIComponent(workspace)}/datastores`,
    dsXml,
    {
      auth,
      headers: { "Content-Type": "application/xml" },
      validateStatus: () => true
    }
  );
  if (dsPost.status >= 200 && dsPost.status < 300) return;
  if (dsPost.status === 409) return;
  throw new Error(
    `GeoServer 创建 PostGIS 数据存储失败 HTTP ${dsPost.status}: ${typeof dsPost.data === "string" ? dsPost.data.slice(0, 500) : JSON.stringify(dsPost.data).slice(0, 500)}`
  );
}
