import { http } from "@/utils/http";

export type StsCredentialsResponse = {
  region: string;
  bucket: string;
  uploadPrefix: string;
  expiration: string;
  credentials: {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
  };
};

/** 向 gyygis-server 申请 STS 临时凭证（用于浏览器直传 OSS） */
export function fetchStsCredentials() {
  return http.post<StsCredentialsResponse, undefined>(
    "/api/oss/sts-credentials",
    undefined
  );
}
