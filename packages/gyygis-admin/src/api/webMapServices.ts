import { http } from "@/utils/http";

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

export type WebMapServicesListResponse = {
  services: WebMapServiceRow[];
};

export function fetchWebMapServices() {
  return http.request<WebMapServicesListResponse>("get", "/api/web-map-services");
}

export type CreateWebMapCatalogBody = {
  name: string;
  code?: string;
  serviceType: "xyz";
  serviceUrl: string;
  adminApiKey?: string;
  requiresUserKey?: boolean;
  isEnabled?: boolean;
  sortOrder?: number;
};

export function createWebMapCatalog(body: CreateWebMapCatalogBody) {
  return http.request<{ catalogId: number }>("post", "/api/web-map-services/catalog", { data: body });
}

export function patchWebMapCatalog(
  catalogId: number,
  body: Partial<{
    name: string;
    serviceUrl: string;
    serviceType: "xyz";
    adminApiKey: string | null;
    requiresUserKey: boolean;
    isEnabled: boolean;
    sortOrder: number;
  }>
) {
  return http.request<{ ok: boolean }>(
    "patch",
    `/api/web-map-services/catalog/${catalogId}`,
    { data: body }
  );
}

export function deleteWebMapCatalog(catalogId: number) {
  return http.request<{ ok: boolean }>(
    "delete",
    `/api/web-map-services/catalog/${catalogId}`
  );
}

export function putWebMapServiceMe(
  catalogId: number,
  body: { userApiKey?: string; isEnabled?: boolean }
) {
  return http.request<{ ok: boolean }>(
    "put",
    `/api/web-map-services/me/${catalogId}`,
    { data: body }
  );
}
