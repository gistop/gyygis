import { getAccessTokenFromAuthorizedCookie } from "@/utils/authorizedToken";

export type UserLayoutListItem = {
  id: number;
  name: string;
  isDefault: boolean;
  updatedAt: string;
};

type ListResponse = { success: boolean; data?: UserLayoutListItem[]; error?: string };
type PutDefaultResponse = { success: boolean; error?: string };
type ItemResponse = { success: boolean; data?: { layout: unknown }; error?: string };

function httpErr(res: Response, body: { error?: string } | null): string {
  if (body && typeof body.error === "string" && body.error) return body.error;
  return `请求失败（${res.status}）`;
}

function authHeadersJson(): HeadersInit {
  const token = getAccessTokenFromAuthorizedCookie();
  if (!token) {
    throw new Error("未登录或登录已过期，请从设置中重新登录");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

export async function fetchUserLayouts(): Promise<UserLayoutListItem[]> {
  const res = await fetch("/api/user-layouts", { headers: authHeadersJson() });
  const body = (await res.json()) as ListResponse;
  if (!res.ok) {
    throw new Error(httpErr(res, body));
  }
  if (!body.success || !Array.isArray(body.data)) {
    throw new Error(body.error || "加载布局列表失败");
  }
  return body.data;
}

export async function saveDefaultUserLayout(layout: object): Promise<void> {
  const res = await fetch("/api/user-layouts/default", {
    method: "PUT",
    headers: authHeadersJson(),
    body: JSON.stringify({ layout })
  });
  const body = (await res.json()) as PutDefaultResponse;
  if (!res.ok || !body.success) {
    throw new Error(httpErr(res, body));
  }
}

export async function fetchUserLayoutById(id: number): Promise<unknown> {
  const res = await fetch(`/api/user-layouts/item/${id}`, { headers: authHeadersJson() });
  const body = (await res.json()) as ItemResponse;
  if (!res.ok || !body.success || body.data?.layout === undefined) {
    throw new Error(httpErr(res, body));
  }
  return body.data.layout;
}
