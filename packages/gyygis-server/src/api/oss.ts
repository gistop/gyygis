import { Router } from "express";
import * as StsPkg from "@alicloud/sts20150401";
import { AssumeRoleRequest } from "@alicloud/sts20150401";
import * as $OpenApi from "@alicloud/openapi-client";

type StsClientInstance = {
  assumeRole(request: AssumeRoleRequest): Promise<{
    body?: { credentials?: Record<string, string | undefined> };
  }>;
};

/**
 * tsx/ESM 下 CJS 包常出现 `default` 再包一层 `default` 才是真实类构造函数。
 */
function resolveStsClientCtor(): new (config: $OpenApi.Config) => StsClientInstance {
  const root = StsPkg.default as unknown;
  if (typeof root === "function") {
    return root as new (config: $OpenApi.Config) => StsClientInstance;
  }
  const inner = (root as { default?: unknown })?.default;
  if (typeof inner === "function") {
    return inner as new (config: $OpenApi.Config) => StsClientInstance;
  }
  throw new Error(
    "@alicloud/sts20150401: 无法解析 STS Client（请检查包版本与 ESM/CJS 互操作）"
  );
}

const StsClient = resolveStsClientCtor();

export const ossRouter = Router();

/** STS 临时凭证有效期：阿里云要求 900～角色 MaxSessionDuration 秒之间 */
const MIN_DURATION = 900;
const MAX_DURATION = 43200;

function parseDuration(): number {
  const raw = Number(process.env.ALIYUN_STS_DURATION_SECONDS ?? "3600");
  if (!Number.isFinite(raw)) return 3600;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.floor(raw)));
}

/**
 * POST /api/oss/sts-credentials
 * 使用 RAM 用户 AK 调用 STS AssumeRole，返回前端直传 OSS 所需临时凭证（及 bucket/region）。
 */
ossRouter.post("/sts-credentials", async (_req, res) => {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET ?? "";
  const roleArn = process.env.ALIYUN_OSS_ROLE_ARN ?? "";
  const bucket = process.env.ALIYUN_OSS_BUCKET ?? "";
  /** 与 OSS 控制台「地域」一致，如 oss-cn-hangzhou */
  const ossRegion = process.env.ALIYUN_OSS_REGION ?? "";
  /** STS 接入地域，如 cn-hangzhou（与 bucket 地域对应） */
  const stsRegion = process.env.ALIYUN_STS_REGION ?? "cn-hangzhou";
  /** 对象 key 前缀，如 uploads/ */
  const uploadPrefix = process.env.ALIYUN_OSS_UPLOAD_PREFIX ?? "uploads/";

  if (!accessKeyId || !accessKeySecret || !roleArn || !bucket || !ossRegion) {
    res.status(503).json({
      error:
        "OSS STS 未配置：请设置 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、ALIYUN_OSS_ROLE_ARN、ALIYUN_OSS_BUCKET、ALIYUN_OSS_REGION"
    });
    return;
  }

  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret
  });
  config.endpoint = `sts.${stsRegion}.aliyuncs.com`;

  const client = new StsClient(config);
  const durationSeconds = parseDuration();
  const request = new AssumeRoleRequest({
    roleArn,
    roleSessionName: "gyygis-admin-upload",
    durationSeconds
  });

  try {
    const response = await client.assumeRole(request);
    const credentials = response.body?.credentials;
    if (
      !credentials?.accessKeyId ||
      !credentials.accessKeySecret ||
      !credentials.securityToken
    ) {
      res.status(500).json({ error: "STS 返回缺少临时凭证字段" });
      return;
    }

    res.json({
      region: ossRegion,
      bucket,
      uploadPrefix: uploadPrefix.endsWith("/") ? uploadPrefix : `${uploadPrefix}/`,
      expiration: credentials.expiration ?? "",
      credentials: {
        accessKeyId: credentials.accessKeyId,
        accessKeySecret: credentials.accessKeySecret,
        securityToken: credentials.securityToken
      }
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[oss/sts-credentials]", e);
    res.status(500).json({ error: message || "STS AssumeRole 失败" });
  }
});
