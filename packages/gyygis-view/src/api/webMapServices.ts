import { getAccessTokenFromAuthorizedCookie } from "@/utils/authorizedToken";

export type WebMapServiceRow = {
  catalogId: number;
  code: string;
  name: string;
  serviceType: string;
  serviceUrl: string;
  requiresUserKey: boolean;
  catalogEnabled: boolean;
  sortOrder: number;
  hasAdminKey: boolean;
  hasUserKey: boolean;
  userEnabled: boolean;
};

type ListResponse = { services: WebMapServiceRow[]; error?: string };

function httpErr(res: Response, body: { error?: string } | null): string {
  if (body && typeof body.error === "string" && body.error) return body.error;
  return `请求失败（${res.status}）`;
}

function authHeadersJson(): HeadersInit {
  const token = getAccessTokenFromAuthorizedCookie();
  if (!token) throw new Error("未登录或登录已过期，请从设置中重新登录");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

export async function fetchWebMapServices(): Promise<WebMapServiceRow[]> {
  const res = await fetch("/api/web-map-services", { headers: authHeadersJson() });
  const body = (await res.json()) as ListResponse;
  if (!res.ok) throw new Error(httpErr(res, body));
  if (!Array.isArray(body.services)) throw new Error(body.error || "加载第三方地图服务失败");
  return body.services;
}

