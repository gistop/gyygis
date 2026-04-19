import { http } from "@/utils/http";

export type PublishCsvFromOssRequest = {
  objectKey: string;
  tableBase: string;
  lonColumn?: string;
  latColumn?: string;
  nameColumn?: string;
};

export type PublishCsvFromOssResponse = {
  tableName: string;
  workspace: string;
  datastore: string;
  layerName: string;
  rowsInserted: number;
  rowsSkipped: number;
  wmsLayersParam: string;
};

/** 从 OSS 拉取 CSV 写入 PostGIS 并由 GeoServer 发布图层（耗时较长） */
export function publishCsvFromOss(body: PublishCsvFromOssRequest) {
  return http.request<PublishCsvFromOssResponse>(
    "post",
    "/api/maps/publish-csv-from-oss",
    {
      data: body,
      timeout: 120000
    }
  );
}
