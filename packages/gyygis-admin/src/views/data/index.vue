<script setup lang="ts">
import OSS from "ali-oss";
import { ElMessage } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { ref } from "vue";
import { fetchStsCredentials } from "@/api/oss";
import { publishCsvFromOss } from "@/api/maps";

defineOptions({ name: "DataIndex" });

const publishObjectKey = ref("");
const tableBase = ref("");
const lonColumn = ref("");
const latColumn = ref("");
const nameColumn = ref("");
const publishing = ref(false);

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
    <h1 class="mb-4 text-lg font-medium">数据上传与地图发布</h1>
    <p class="mb-4 text-secondary text-sm">
      使用 STS 临时凭证直传阿里云 OSS（需启动 gyygis-server 并配置 RAM/OSS 环境变量）。
      若浏览器报 CORS：请在 OSS 控制台该 Bucket 的「跨域设置」中允许来源
      <code class="mx-1 rounded bg-fill px-1">http://localhost:8848</code>
     （生产环境改为管理端域名），并允许 PUT/POST/GET/HEAD 及必要 Header。
    </p>
    <p class="mb-4 text-secondary text-sm">
      发布地图：服务端从 OSS 读取 CSV，写入 PostGIS 表 <code>gyy_csv_*</code>，并调用 GeoServer REST 发布到已有工作区
      <code>geoworkspace</code>（与 <code>deploy/docker-compose.yml</code> 一致）。请在 Docker Compose 启动
      <code>api / postgis / geoserver</code> 且 RAM 账号具备 OSS 读权限后使用。pgAdmin 仅用于库表管理，发布入口在本页。
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

    <el-divider />

    <h2 class="mb-2 text-base font-medium">新建地图服务（CSV → PostGIS → GeoServer）</h2>
    <p class="mb-3 text-secondary text-sm">
      CSV 首行为表头；需包含经纬度列（可自动识别 lon/lng/longitude/latitude/x/y/经度/纬度）。可选名称列（name/label/名称）。
    </p>
    <el-form label-width="120px" class="max-w-xl" @submit.prevent>
      <el-form-item label="OSS 对象 key">
        <el-input v-model="publishObjectKey" placeholder="上传成功后自动填入，也可手填" clearable />
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
  </div>
</template>
