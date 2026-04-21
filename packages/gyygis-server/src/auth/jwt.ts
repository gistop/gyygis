import crypto from "node:crypto";

type JwtHeader = { alg: "HS256"; typ: "JWT" };
export type AccessClaims = {
  sub: string; // user id as string
  username: string;
  isAdmin: boolean;
  typ: "access";
  iat: number;
  exp: number;
};

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncode(Buffer.from(JSON.stringify(obj), "utf8"));
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    // 允许本地开发开箱即用；生产环境请务必设置 JWT_SECRET
    return "gyygis-dev-insecure-jwt-secret-change-me";
  }
  return secret;
}

export function signJwtHs256(payload: Record<string, unknown>): string {
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const h = base64UrlEncodeJson(header);
  const p = base64UrlEncodeJson(payload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", getJwtSecret()).update(data).digest();
  const s = base64UrlEncode(sig);
  return `${data}.${s}`;
}

export function verifyJwtHs256<T extends Record<string, unknown>>(token: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("非法 token");
  }
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = base64UrlEncode(crypto.createHmac("sha256", getJwtSecret()).update(data).digest());
  if (!timingSafeEqualString(expected, s)) {
    throw new Error("token 签名校验失败");
  }
  const payloadJson = Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(payloadJson) as T;
}
