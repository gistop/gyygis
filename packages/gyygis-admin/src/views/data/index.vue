<script setup lang="ts">
import OSS from "ali-oss";
import { ElMessage } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { fetchStsCredentials } from "@/api/oss";

defineOptions({ name: "DataIndex" });

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
    ElMessage.success(`已上传：${objectName}`);
    onSuccess?.(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error(msg || "上传失败");
    onError?.(e as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0]);
  }
};
</script>

<template>
  <div class="p-4">
    <h1 class="mb-4 text-lg font-medium">数据上传</h1>
    <p class="mb-4 text-secondary text-sm">
      使用 STS 临时凭证直传阿里云 OSS（需启动 gyygis-server 并配置 RAM/OSS 环境变量）。
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
  </div>
</template>
