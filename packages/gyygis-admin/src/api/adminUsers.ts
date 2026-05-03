import { http } from "@/utils/http";

export type AdminUserRow = {
  id: number;
  username: string;
  isActive: boolean;
  isAdmin: boolean;
  geoserverReady: boolean;
};

export type AdminUserListResponse = {
  success: boolean;
  data?: { items: AdminUserRow[]; total: number };
  error?: string;
};

export type AdminUserPatchResponse = {
  success: boolean;
  data?: AdminUserRow;
  error?: string;
};

export function fetchAdminUsers(params: { page: number; pageSize: number; q?: string }) {
  return http.request<AdminUserListResponse>("get", "/api/admin/users", { params });
}

export function patchAdminUser(
  id: number,
  body: Partial<{ isActive: boolean; isAdmin: boolean }>
) {
  return http.request<AdminUserPatchResponse>("patch", `/api/admin/users/${id}`, { data: body });
}
