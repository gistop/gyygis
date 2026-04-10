import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const dir = path.dirname(fileURLToPath(import.meta.url));
// 开发：.env 覆盖系统/IDE 里误设的占位符；生产：以平台注入的环境变量为准，避免磁盘上误放的 .env 盖住密钥
const overrideEnvFile = process.env.NODE_ENV !== "production";
dotenv.config({ path: path.resolve(dir, "../.env"), override: overrideEnvFile });
