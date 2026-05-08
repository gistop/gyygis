<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { getToken } from "@/utils/auth";
import {
  deleteAdminUser,
  fetchAdminUsers,
  patchAdminUser,
  type AdminUserRow
} from "@/api/adminUsers";

defineOptions({ name: "SystemUser" });

function httpErrText(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const data = (e as { response?: { data?: { error?: string; message?: string } } }).response
      ?.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

const loading = ref(false);
const tableData = ref<AdminUserRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const searchQ = ref("");

const currentSuper = computed(() => Boolean(getToken()?.isSuperAdmin));
const currentUserId = computed(() => getToken()?.userId ?? 0);

function canEditActive(row: AdminUserRow): boolean {
  if (row.id === currentUserId.value) return false;
  if (row.isSuperAdmin) return currentSuper.value;
  if (row.isAdmin) return currentSuper.value;
  return true;
}

function canEditAdmin(row: AdminUserRow): boolean {
  return currentSuper.value && !row.isSuperAdmin;
}

function canDelete(row: AdminUserRow): boolean {
  if (row.id === currentUserId.value) return false;
  if (row.isSuperAdmin) return false;
  if (row.isAdmin && !currentSuper.value) return false;
  return true;
}

async function loadList() {
  loading.value = true;
  try {
    const res = await fetchAdminUsers({
      page: page.value,
      pageSize: pageSize.value,
      q: searchQ.value.trim() || undefined
    });
    if (!res?.success) {
      message(res?.error || "加载失败", { type: "error" });
      tableData.value = [];
      total.value = 0;
      return;
    }
    tableData.value = res.data?.items ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: unknown) {
    message(httpErrText(e) || "加载失败", { type: "error" });
    tableData.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1;
  loadList();
}, 400);

watch(searchQ, () => {
  debouncedSearch();
});

async function onActiveChange(row: AdminUserRow, val: boolean) {
  if (!canEditActive(row)) {
    message("无权修改该用户的启用状态", { type: "warning" });
    return;
  }
  const prev = row.isActive;
  row.isActive = val;
  try {
    const res = await patchAdminUser(row.id, { isActive: val });
    if (!res?.success) {
      row.isActive = prev;
      message(res?.error || "更新失败", { type: "error" });
      return;
    }
    if (res.data) {
      row.isActive = res.data.isActive;
      row.isAdmin = res.data.isAdmin;
      row.isSuperAdmin = res.data.isSuperAdmin;
    }
    message("已更新启用状态", { type: "success" });
  } catch (e: unknown) {
    row.isActive = prev;
    message(httpErrText(e) || "更新失败", { type: "error" });
  }
}

async function onAdminChange(row: AdminUserRow, val: boolean) {
  if (!canEditAdmin(row)) {
    message("仅超级管理员可修改管理员权限", { type: "warning" });
    return;
  }
  const prev = row.isAdmin;
  row.isAdmin = val;
  try {
    const res = await patchAdminUser(row.id, { isAdmin: val });
    if (!res?.success) {
      row.isAdmin = prev;
      message(res?.error || "更新失败", { type: "error" });
      return;
    }
    if (res.data) {
      row.isActive = res.data.isActive;
      row.isAdmin = res.data.isAdmin;
      row.isSuperAdmin = res.data.isSuperAdmin;
    }
    message("已更新管理员权限", { type: "success" });
  } catch (e: unknown) {
    row.isAdmin = prev;
    message(httpErrText(e) || "更新失败", { type: "error" });
  }
}

async function onDeleteClick(row: AdminUserRow) {
  if (!canDelete(row)) return;
  try {
    await ElMessageBox.confirm(`确定永久删除用户「${row.username}」？此操作不可恢复。`, "删除用户", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    const res = await deleteAdminUser(row.id);
    if (!res?.success) {
      message(res?.error || "删除失败", { type: "error" });
      return;
    }
    message("已删除", { type: "success" });
    await loadList();
  } catch (e: unknown) {
    message(httpErrText(e) || "删除失败", { type: "error" });
  }
}

function onSearchClick() {
  page.value = 1;
  loadList();
}

function onPageChange(p: number) {
  page.value = p;
  loadList();
}

function onSizeChange(s: number) {
  pageSize.value = s;
  page.value = 1;
  loadList();
}

loadList();
</script>

<template>
  <div class="p-4">
    <h1 class="mb-4 text-lg font-medium">用户管理</h1>
    <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
      仅管理员可见。超级管理员（用户名为 admin）可授予或撤销管理员、启用/禁用任意用户、删除除内置超管外的账号；普通管理员仅能管理非管理员用户（启用/停用与硬删）。不能删除自己，不能删除内置超级管理员。
    </p>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <el-input
        v-model="searchQ"
        clearable
        placeholder="搜索用户名"
        class="max-w-xs"
        @clear="onSearchClick"
      />
      <el-button type="primary" @click="onSearchClick">搜索</el-button>
    </div>
    <el-table v-loading="loading" :data="tableData" border stripe style="width: 100%; max-width: 1080px">
      <el-table-column prop="id" label="ID" width="72" />
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column label="超级管理员" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isSuperAdmin ? 'danger' : 'info'" size="small">
            {{ row.isSuperAdmin ? "是" : "否" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :disabled="!canEditActive(row)"
            :model-value="row.isActive"
            @update:model-value="(v: boolean) => onActiveChange(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="管理员" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :disabled="!canEditAdmin(row)"
            :model-value="row.isAdmin"
            @update:model-value="(v: boolean) => onAdminChange(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="租户就绪" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.geoserverReady ? 'success' : 'info'" size="small">
            {{ row.geoserverReady ? "是" : "否" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canDelete(row)"
            type="danger"
            link
            size="small"
            @click="onDeleteClick(row)"
          >
            删除
          </el-button>
          <span v-else class="text-gray-400 text-xs">—</span>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="mt-4"
      background
      layout="total, sizes, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      :page-sizes="[10, 20, 50]"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />
  </div>
</template>
