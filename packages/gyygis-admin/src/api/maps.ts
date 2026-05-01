import { http } from "@/utils/http";

export type PublishCsvFromOssRequest = {
  objectKey: string;
  tableBase: string;
  lonColumn?: string;
  latColumn?: string;
  nameColumn?: string;
};

export type PublishFromOssMapResponse = {
  tableName: string;
  workspace: string;
  datastore: string;
  layerName: string;
  rowsInserted: number;
  rowsSkipped: number;
  wmsLayersParam: string;
};

/** @deprecated 与 PublishFromOssMapResponse 相同，保留别名避免外部引用断裂 */
export type PublishCsvFromOssResponse = PublishFromOssMapResponse;

/** 从 OSS 拉取 CSV 写入 PostGIS 并由 GeoServer 发布图层（耗时较长） */
export function publishCsvFromOss(body: PublishCsvFromOssRequest) {
  return http.request<PublishFromOssMapResponse>("post", "/api/maps/publish-csv-from-oss", {
    data: body,
    timeout: 120000
  });
}

export type PublishXlsxFromOssRequest = PublishCsvFromOssRequest;

/** 从 OSS 拉取 xlsx 首表（点）写入 PostGIS 并由 GeoServer 发布图层 */
export function publishXlsxFromOss(body: PublishXlsxFromOssRequest) {
  return http.request<PublishFromOssMapResponse>("post", "/api/maps/publish-xlsx-from-oss", {
    data: body,
    timeout: 120000
  });
}

export type PublishGeojsonFromOssRequest = {
  objectKey: string;
  tableBase: string;
};

/** 从 OSS 拉取 GeoJSON（Feature / FeatureCollection）写入 PostGIS 并由 GeoServer 发布图层 */
export function publishGeojsonFromOss(body: PublishGeojsonFromOssRequest) {
  return http.request<PublishFromOssMapResponse>("post", "/api/maps/publish-geojson-from-oss", {
    data: body,
    timeout: 180000
  });
}

export type MapLayerInfo = {
  name: string;
  enabled: boolean;
};

export type MapLayersListResponse = {
  layers: MapLayerInfo[];
};

/** 列出 geoworkspace / postgis_store 中已发布图层 */
export function fetchMapLayers() {
  return http.request<MapLayersListResponse>("get", "/api/maps/layers");
}

/** 启用 / 停用图层（不删表） */
export function setMapLayerEnabled(layerName: string, enabled: boolean) {
  return http.request<void>("patch", `/api/maps/layers/${encodeURIComponent(layerName)}`, {
    data: { enabled }
  });
}

/** 删除 GeoServer 图层并 DROP 同名 PostGIS 表 */
export function deleteMapLayer(layerName: string) {
  return http.request<void>("delete", `/api/maps/layers/${encodeURIComponent(layerName)}`);
}
