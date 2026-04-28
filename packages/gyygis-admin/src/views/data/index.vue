<script setup lang="ts">
import OSS from "ali-oss";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { computed, reactive, ref } from "vue";
import { fetchStsCredentials } from "@/api/oss";
import {
  deleteMapLayer,
  fetchMapLayers,
  publishCsvFromOss,
  setMapLayerEnabled,
  type MapLayerInfo
} from "@/api/maps";
import {
  createWebMapCatalog,
  deleteWebMapCatalog,
  fetchWebMapServices,
  patchWebMapCatalog,
  putWebMapServiceMe,
  type WebMapServiceRow
} from "@/api/webMapServices";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({ name: "DataIndex" });

const userStore = useUserStoreHook();
const isAdmin = computed(() => (userStore.roles ?? []).includes("admin"));

const publishObjectKey = ref("");
const tableBase = ref("");
const lonColumn = ref("");
const latColumn = ref("");
const nameColumn = ref("");
const publishing = ref(false);

const mapLayers = ref<MapLayerInfo[]>([]);
const layersLoading = ref(false);
const layerAction = ref<string | null>(null);

const activeTab = ref("upload");

const webMapList = ref<WebMapServiceRow[]>([]);
const webMapLoading = ref(false);
const webMapSaving = ref<number | null>(null);
const webMapCatalogAction = ref<number | null>(null);
const userKeyDraft = reactive<Record<number, string>>({});

const wmForm = reactive({
  name: "",
  code: "",
  serviceType: "xyz" as const,
  serviceUrl: "",
  adminApiKey: "",
  sortOrder: 0
});
const wmCreating = ref(false);

const wmEditOpen = ref(false);
const wmEditCatalogId = ref<number | null>(null);
const wmEditForm = reactive({
  name: "",
  serviceUrl: "",
  adminApiKey: "",
  clearAdminKey: false,
  requiresUserKey: true,
  isEnabled: true,
  sortOrder: 0
});
const wmEditSaving = ref(false);

function syncUserKeyDrafts(rows: WebMapServiceRow[]) {
  for (const k of Object.keys(userKeyDraft)) {
    delete userKeyDraft[Number(k)];
  }
  for (const r of rows) {
    userKeyDraft[r.catalogId] = "";
  }
}

async function loadWebMapServices() {
  webMapLoading.value = true;
  try {
    const res = await fetchWebMapServices();
    const list = res.services ?? [];
    webMapList.value = list;
    syncUserKeyDrafts(list);
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "加载第三方地图服务失败");
    webMapList.value = [];
  } finally {
    webMapLoading.value = false;
  }
}

async function onWebMapCatalogEnabledChange(row: WebMapServiceRow, enabled: boolean) {
  if (!isAdmin.value) return;
  webMapCatalogAction.value = row.catalogId;
  try {
    await patchWebMapCatalog(row.catalogId, { isEnabled: enabled });
    row.catalogEnabled = enabled;
    ElMessage.success(enabled ? "已全站启用" : "已全站停用");
    await loadWebMapServices();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "更新失败");
    await loadWebMapServices();
  } finally {
    webMapCatalogAction.value = null;
  }
}

async function onWebMapUserEnabledChange(row: WebMapServiceRow, enabled: boolean) {
  if (row.requiresUserKey && !row.hasUserKey) {
    ElMessage.warning("请先填写并保存您自己的密钥");
    return;
  }
  webMapSaving.value = row.catalogId;
  try {
    await putWebMapServiceMe(row.catalogId, { isEnabled: enabled });
    row.userEnabled = enabled;
    ElMessage.success(enabled ? "已启用（个人）" : "已停用（个人）");
    await loadWebMapServices();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "更新失败");
    await loadWebMapServices();
  } finally {
    webMapSaving.value = null;
  }
}

async function saveUserWebMapKey(row: WebMapServiceRow) {
  webMapSaving.value = row.catalogId;
  try {
    await putWebMapServiceMe(row.catalogId, {
      userApiKey: (userKeyDraft[row.catalogId] ?? "").trim()
    });
    ElMessage.success("已保存用户密钥（仅服务端存储）");
    userKeyDraft[row.catalogId] = "";
    await loadWebMapServices();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "保存失败");
  } finally {
    webMapSaving.value = null;
  }
}

async function onDeleteWebMapCatalog(row: WebMapServiceRow) {
  try {
    await ElMessageBox.confirm(
      `将删除第三方地图服务「${row.name}」并移除所有用户的个人配置。是否继续？`,
      "删除服务",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  webMapCatalogAction.value = row.catalogId;
  try {
    await deleteWebMapCatalog(row.catalogId);
    ElMessage.success("已删除");
    await loadWebMapServices();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "删除失败");
  } finally {
    webMapCatalogAction.value = null;
  }
}

async function submitWebMapCatalog() {
  if (!wmForm.name.trim()) {
    ElMessage.warning("请填写名称");
    return;
  }
  if (!wmForm.serviceUrl.trim()) {
    ElMessage.warning("请填写服务地址");
    return;
  }
  wmCreating.value = true;
  try {
    await createWebMapCatalog({
      name: wmForm.name.trim(),
      code: wmForm.code.trim() || undefined,
      serviceType: "xyz",
      serviceUrl: wmForm.serviceUrl.trim(),
      adminApiKey: wmForm.adminApiKey.trim() || undefined,
      sortOrder: wmForm.sortOrder || 0
    });
    ElMessage.success("已添加");
    wmForm.name = "";
    wmForm.code = "";
    wmForm.serviceUrl = "";
    wmForm.adminApiKey = "";
    wmForm.sortOrder = 0;
    await loadWebMapServices();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "添加失败");
  } finally {
    wmCreating.value = false;
  }
}

function openWmEdit(row: WebMapServiceRow) {
  wmEditCatalogId.value = row.catalogId;
  wmEditForm.name = row.name;
  wmEditForm.serviceUrl = row.serviceUrl;
  wmEditForm.adminApiKey = "";
  wmEditForm.clearAdminKey = false;
  wmEditForm.requiresUserKey = row.requiresUserKey;
  wmEditForm.isEnabled = row.catalogEnabled;
  wmEditForm.sortOrder = row.sortOrder;
  wmEditOpen.value = true;
}

async function submitWmEdit() {
  const id = wmEditCatalogId.value;
  if (id == null) return;
  if (!wmEditForm.name.trim() || !wmEditForm.serviceUrl.trim()) {
    ElMessage.warning("名称与地址不能为空");
    return;
  }
  wmEditSaving.value = true;
  try {
    const body: Parameters<typeof patchWebMapCatalog>[1] = {
      name: wmEditForm.name.trim(),
      serviceUrl: wmEditForm.serviceUrl.trim(),
      requiresUserKey: wmEditForm.requiresUserKey,
      isEnabled: wmEditForm.isEnabled,
      sortOrder: wmEditForm.sortOrder
    };
    if (wmEditForm.clearAdminKey) {
      body.adminApiKey = null;
    } else if (wmEditForm.adminApiKey.trim()) {
      body.adminApiKey = wmEditForm.adminApiKey.trim();
    }
    await patchWebMapCatalog(id, body);
    ElMessage.success("已保存");
    wmEditOpen.value = false;
    await loadWebMapServices();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "保存失败");
  } finally {
    wmEditSaving.value = false;
  }
}

async function loadMapLayers() {
  layersLoading.value = true;
  try {
    const res = await fetchMapLayers();
    mapLayers.value = res.layers ?? [];
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "加载图层列表失败");
    mapLayers.value = [];
  } finally {
    layersLoading.value = false;
  }
}

function coerceSwitchValue(v: boolean | string | number): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v === "true" || v === "1";
}

async function onLayerEnabledChange(row: MapLayerInfo, enabled: boolean) {
  layerAction.value = row.name;
  try {
    await setMapLayerEnabled(row.name, enabled);
    row.enabled = enabled;
    ElMessage.success(enabled ? "已启用" : "已停用");
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "更新失败");
    await loadMapLayers();
  } finally {
    layerAction.value = null;
  }
}

async function onDeleteLayer(row: MapLayerInfo) {
  try {
    await ElMessageBox.confirm(
      `将删除 GeoServer 图层「${row.name}」并删除 PostGIS 中同名表（不可恢复）。是否继续？`,
      "删除地图服务",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  layerAction.value = row.name;
  try {
    await deleteMapLayer(row.name);
    ElMessage.success("已删除");
    await loadMapLayers();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "删除失败");
  } finally {
    layerAction.value = null;
  }
}

function onDataTabChange(name: string | number) {
  if (name === "layers") {
    void loadMapLayers();
  }
  if (name === "webMaps") {
    void loadWebMapServices();
  }
}

/** 5 分钟刷新一次 STS，避免大文件/分片上传中途过期（与 ali-oss 默认一致） */
const REFRESH_STS_MS = 5 * 60 * 1000;

async function createOssClient() {
  const sts = await fetchStsCredentials();
  return {
    client: new OSS({
      region: sts.region,
      accessKeyId: sts.credentials.accessKeyId,
      accessKeySecret: sts.credentials.accessKeySecret,
      stsToken: sts.credentials.securityToken,
      bucket: sts.bucket,
      secure: true,
      refreshSTSToken: async () => {
        const next = await fetchStsCredentials();
        return {
          accessKeyId: next.credentials.accessKeyId,
          accessKeySecret: next.credentials.accessKeySecret,
          stsToken: next.credentials.securityToken
        };
      },
      refreshSTSTokenInterval: REFRESH_STS_MS
    }),
    uploadPrefix: sts.uploadPrefix
  };
}

const handleUpload = async (options: UploadRequestOptions) => {
  const { file, onError, onSuccess } = options;
  try {
    const { client, uploadPrefix } = await createOssClient();
    const safeName = file.name.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_");
    const objectName = `${uploadPrefix}${Date.now()}-${safeName}`;
    const result = await client.put(objectName, file);
    publishObjectKey.value = objectName;
    ElMessage.success(`已上传：${objectName}`);
    onSuccess?.(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error(msg || "上传失败");
    onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
  }
};

async function handlePublishMap() {
  if (!publishObjectKey.value.trim()) {
    ElMessage.warning("请填写 OSS 对象 key（可先上传 CSV 自动填入）");
    return;
  }
  if (!tableBase.value.trim()) {
    ElMessage.warning("请填写图层标识（英文，如 my_sites）");
    return;
  }
  publishing.value = true;
  try {
    const res = await publishCsvFromOss({
      objectKey: publishObjectKey.value.trim(),
      tableBase: tableBase.value.trim(),
      lonColumn: lonColumn.value.trim() || undefined,
      latColumn: latColumn.value.trim() || undefined,
      nameColumn: nameColumn.value.trim() || undefined
    });
    ElMessage.success(
      `已发布 ${res.rowsInserted} 点（跳过 ${res.rowsSkipped} 行）。WMS layers=${res.wmsLayersParam}`
    );
    await loadMapLayers();
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (e instanceof Error ? e.message : String(e));
    ElMessage.error(msg || "发布失败");
  } finally {
    publishing.value = false;
  }
}
</script>

<template>
  <div class="p-4">
    <h1 class="mb-4 text-lg font-medium">数据与地图服务</h1>

    <el-tabs v-model="activeTab" class="data-tabs" @tab-change="onDataTabChange">
      <el-tab-pane label="数据上传" name="upload" lazy>
        <p class="mb-4 text-secondary text-sm">
          使用 STS 临时凭证直传阿里云 OSS（需先登录；并启动 gyygis-server 且配置 RAM/OSS 环境变量）。
          上传路径会落在当前用户目录：<code class="mx-1 rounded bg-fill px-1">uploads/u_&lt;用户ID&gt;/</code>。
          若浏览器报 CORS：请在 OSS 控制台该 Bucket 的「跨域设置」中允许来源
          <code class="mx-1 rounded bg-fill px-1">http://localhost:8848</code>
          （生产环境改为管理端域名），并允许 PUT/POST/GET/HEAD 及必要 Header。
        </p>
        <el-upload drag :http-request="handleUpload" :show-file-list="true" multiple>
          <IconifyIconOffline icon="ep:upload-filled" class="m-auto mb-2 text-4xl" />
          <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
          <template #tip>
            <div class="el-upload__tip">
              大文件将自动分片上传；STS 会按间隔自动刷新。若仍失败请先检查 OSS 跨域（CORS）。
            </div>
          </template>
        </el-upload>
      </el-tab-pane>

      <el-tab-pane label="地图发布" name="publish" lazy>
        <p class="mb-4 text-secondary text-sm">
          服务端从 OSS 读取 CSV，写入当前用户 PostGIS schema（<code>u_&lt;用户ID&gt;</code>）下的表
          <code>gyy_csv_*</code>，并调用 GeoServer REST 发布到当前用户工作区（同名
          <code>u_&lt;用户ID&gt;</code>）/ 数据存储 <code>postgis_store</code>。请确保 Docker Compose 中
          <code>api / postgis / geoserver</code> 已启动，且 RAM 账号具备 OSS 读权限。
        </p>
        <p class="mb-3 text-secondary text-sm">
          CSV 首行为表头；需包含经纬度列（可自动识别 lon/lng/longitude/latitude/x/y/经度/纬度）。可选名称列（name/label/名称）。
        </p>
        <el-form label-width="120px" class="max-w-xl" @submit.prevent>
          <el-form-item label="OSS 对象 key">
            <el-input v-model="publishObjectKey" placeholder="可先在上传 Tab 传 CSV 自动填入" clearable />
          </el-form-item>
          <el-form-item label="图层标识" required>
            <el-input
              v-model="tableBase"
              placeholder="英文标识，如 my_sites → 表名 gyy_csv_my_sites"
              clearable
            />
          </el-form-item>
          <el-form-item label="经度列（可选）">
            <el-input v-model="lonColumn" placeholder="留空则按表头自动识别" clearable />
          </el-form-item>
          <el-form-item label="纬度列（可选）">
            <el-input v-model="latColumn" placeholder="留空则按表头自动识别" clearable />
          </el-form-item>
          <el-form-item label="名称列（可选）">
            <el-input v-model="nameColumn" placeholder="留空则尝试 name/label/名称" clearable />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="publishing" @click="handlePublishMap">
              发布地图服务
            </el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="地图服务管理" name="layers" lazy>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p class="text-secondary text-sm">
            列出当前用户在 GeoServer <code>postgis_store</code> 中已发布图层；停用后不再对外提供 WMS/WFS；删除会同时移除图层并
            <strong>DROP</strong> 当前用户 schema 下同名表（请谨慎）。
          </p>
          <el-button :loading="layersLoading" @click="loadMapLayers">刷新列表</el-button>
        </div>
        <el-table v-loading="layersLoading" :data="mapLayers" border stripe empty-text="暂无图层或尚未加载">
          <el-table-column prop="name" label="图层名" min-width="160" />
          <el-table-column label="启用" width="120" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                :disabled="layerAction === row.name"
                @change="(v: boolean | string | number) => onLayerEnabledChange(row, coerceSwitchValue(v))"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button
                type="danger"
                link
                :disabled="layerAction === row.name"
                @click="onDeleteLayer(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="第三方地图服务" name="webMaps" lazy>
        <p class="mb-3 text-secondary text-sm">
          全站目录由管理员维护服务地址与管理员密钥；用户密钥仅保存在服务端，不在浏览器使用明文 key。
          需用户自备 key 时，未填写则该服务对该用户不可用。
        </p>

        <div v-if="isAdmin" class="mb-6 rounded border border-[var(--el-border-color)] p-4">
          <h2 class="mb-3 text-base font-medium">添加地图服务（仅管理员）</h2>
          <el-form label-width="100px" class="max-w-3xl" @submit.prevent>
            <el-form-item label="名称" required>
              <el-input v-model="wmForm.name" placeholder="展示名称" clearable />
            </el-form-item>
            <el-form-item label="标识" prop="code">
              <el-input
                v-model="wmForm.code"
                placeholder="可选，留空则根据名称生成；仅小写字母、数字、下划线"
                clearable
              />
            </el-form-item>
            <el-form-item label="服务类型" required>
              <el-select v-model="wmForm.serviceType" disabled style="width: 200px">
                <el-option label="XYZ 瓦片" value="xyz" />
              </el-select>
            </el-form-item>
            <el-form-item label="服务地址" required>
              <el-input
                v-model="wmForm.serviceUrl"
                placeholder="https://... 含 {z}/{x}/{y} 或天地图等占位"
                clearable
              />
            </el-form-item>
            <el-form-item label="管理员 key">
              <el-input
                v-model="wmForm.adminApiKey"
                type="password"
                show-password
                placeholder="可选；仅存服务端"
                clearable
              />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="wmForm.sortOrder" :min="0" :max="9999" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="wmCreating" @click="submitWebMapCatalog">
                添加
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span class="text-secondary text-sm">已配置的 Web 地图服务</span>
          <el-button :loading="webMapLoading" @click="loadWebMapServices">刷新</el-button>
        </div>

        <el-table v-loading="webMapLoading" :data="webMapList" border stripe empty-text="暂无数据">
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column prop="code" label="标识" width="140" />
          <el-table-column prop="serviceType" label="类型" width="80" />
          <el-table-column prop="serviceUrl" label="服务地址" min-width="200" show-overflow-tooltip />
          <el-table-column v-if="isAdmin" label="全站启用" width="110" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.catalogEnabled"
                :disabled="webMapCatalogAction === row.catalogId"
                @change="
                  (v: boolean | string | number) =>
                    onWebMapCatalogEnabledChange(row, coerceSwitchValue(v))
                "
              />
            </template>
          </el-table-column>
          <el-table-column v-else label="全站状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.catalogEnabled ? 'success' : 'info'" size="small">
                {{ row.catalogEnabled ? "启用" : "停用" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="需用户 key" width="100" align="center">
            <template #default="{ row }">
              {{ row.requiresUserKey ? "是" : "否" }}
            </template>
          </el-table-column>
          <el-table-column label="用户密钥" min-width="220">
            <template #default="{ row }">
              <div class="flex flex-wrap items-center gap-2">
                <el-input
                  v-model="userKeyDraft[row.catalogId]"
                  type="password"
                  show-password
                  placeholder="填写您自己的 key"
                  clearable
                  class="min-w-[140px] flex-1"
                />
                <el-button
                  size="small"
                  :loading="webMapSaving === row.catalogId"
                  @click="saveUserWebMapKey(row)"
                >
                  保存
                </el-button>
              </div>
              <div v-if="row.hasUserKey" class="mt-1 text-xs text-secondary">已配置（可留空保存以清除）</div>
            </template>
          </el-table-column>
          <el-table-column label="个人启用" width="110" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.userEnabled"
                :disabled="
                  webMapSaving === row.catalogId ||
                  (row.requiresUserKey && !row.hasUserKey) ||
                  !row.catalogEnabled
                "
                @change="
                  (v: boolean | string | number) =>
                    onWebMapUserEnabledChange(row, coerceSwitchValue(v))
                "
              />
            </template>
          </el-table-column>
          <el-table-column v-if="isAdmin" label="操作" width="160" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openWmEdit(row)">编辑</el-button>
              <el-button
                link
                type="danger"
                :disabled="webMapCatalogAction === row.catalogId"
                @click="onDeleteWebMapCatalog(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-dialog v-model="wmEditOpen" title="编辑第三方地图服务" width="560px" destroy-on-close>
          <el-form v-if="wmEditCatalogId != null" label-width="120px" @submit.prevent>
            <el-form-item label="名称" required>
              <el-input v-model="wmEditForm.name" clearable />
            </el-form-item>
            <el-form-item label="服务地址" required>
              <el-input v-model="wmEditForm.serviceUrl" type="textarea" :rows="2" clearable />
            </el-form-item>
            <el-form-item label="需用户 key">
              <el-switch v-model="wmEditForm.requiresUserKey" />
            </el-form-item>
            <el-form-item label="全站启用">
              <el-switch v-model="wmEditForm.isEnabled" />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="wmEditForm.sortOrder" :min="0" :max="9999" />
            </el-form-item>
            <el-form-item label="新管理员 key">
              <el-input
                v-model="wmEditForm.adminApiKey"
                type="password"
                show-password
                placeholder="留空表示不修改原密钥"
                clearable
              />
            </el-form-item>
            <el-form-item label="清除管理员 key">
              <el-checkbox v-model="wmEditForm.clearAdminKey">清除已存的管理员密钥</el-checkbox>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="wmEditOpen = false">取消</el-button>
            <el-button type="primary" :loading="wmEditSaving" @click="submitWmEdit">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
