import { getAccessTokenFromAuthorizedCookie } from "@/utils/authorizedToken";

export type MapLayerInfo = {
  name: string;
  enabled: boolean;
};

export type MapLayerField = {
  name: string;
  dataType: string;
  udtName: string;
};

export type MapLayerRowsResponse = {
  page: number;
  pageSize: number;
  total: number;
  fields: string[];
  rows: Record<string, unknown>[];
};

type LayersResponse = { layers: MapLayerInfo[]; error?: string };
type FieldsResponse = { fields: MapLayerField[]; error?: string };
type RowsResponse = MapLayerRowsResponse & { error?: string };

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

export async function fetchUserMapLayers(): Promise<MapLayerInfo[]> {
  const res = await fetch("/api/maps/layers", { headers: authHeadersJson() });
  const body = (await res.json()) as LayersResponse;
  if (!res.ok) throw new Error(httpErr(res, body));
  if (!Array.isArray(body.layers)) throw new Error(body.error || "加载图层列表失败");
  return body.layers;
}

export async function fetchLayerFields(layerName: string): Promise<MapLayerField[]> {
  const res = await fetch(`/api/maps/layers/${encodeURIComponent(layerName)}/fields`, {
    headers: authHeadersJson()
  });
  const body = (await res.json()) as FieldsResponse;
  if (!res.ok) throw new Error(httpErr(res, body));
  if (!Array.isArray(body.fields)) throw new Error(body.error || "加载字段列表失败");
  return body.fields;
}

export async function fetchLayerRows(args: {
  layerName: string;
  fields?: string[];
  page?: number;
  pageSize?: number;
}): Promise<MapLayerRowsResponse> {
  const { layerName, fields, page = 1, pageSize = 50 } = args;
  const qs = new URLSearchParams();
  if (fields && fields.length) qs.set("fields", fields.join(","));
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  const res = await fetch(`/api/maps/layers/${encodeURIComponent(layerName)}/rows?${qs.toString()}`, {
    headers: authHeadersJson()
  });
  const body = (await res.json()) as RowsResponse;
  if (!res.ok) throw new Error(httpErr(res, body));
  if (!Array.isArray(body.rows) || !Array.isArray(body.fields)) {
    throw new Error(body.error || "加载属性数据失败");
  }
  return {
    page: body.page,
    pageSize: body.pageSize,
    total: body.total,
    fields: body.fields,
    rows: body.rows
  };
}

