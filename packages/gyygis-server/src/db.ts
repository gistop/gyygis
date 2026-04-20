import pg from "pg";

type DbEnv = {
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
};

function readDbEnv(): DbEnv {
  return {
    postgresHost: process.env.POSTGRES_HOST ?? "",
    postgresPort: Number(process.env.POSTGRES_PORT ?? "5432"),
    postgresUser: process.env.POSTGRES_USER ?? "",
    postgresPassword: process.env.POSTGRES_PASSWORD ?? "",
    postgresDb: process.env.POSTGRES_DB ?? ""
  };
}

export function isDbConfigured(): boolean {
  const e = readDbEnv();
  return Boolean(e.postgresHost && e.postgresUser && e.postgresDb);
}

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (pool) return pool;
  const e = readDbEnv();
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

