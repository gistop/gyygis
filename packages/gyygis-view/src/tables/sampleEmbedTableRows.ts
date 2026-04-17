/** Dockview 嵌入表格示例数据（可后续替换为接口） */
export type SampleEmbedTableRow = {
  layerName: string;
  featureCount: number;
  lastSync: string;
  status: "正常" | "延迟" | "离线";
};

export const SAMPLE_EMBED_TABLE_ROWS: SampleEmbedTableRow[] = [
  { layerName: "行政区划", featureCount: 342, lastSync: "2026-04-18 09:12", status: "正常" },
  { layerName: "POI 兴趣点", featureCount: 12840, lastSync: "2026-04-18 08:55", status: "正常" },
  { layerName: "道路中心线", featureCount: 5602, lastSync: "2026-04-18 08:40", status: "延迟" },
  { layerName: "水系面", featureCount: 918, lastSync: "2026-04-17 22:10", status: "正常" },
  { layerName: "卫星影像索引", featureCount: 64, lastSync: "2026-04-17 18:00", status: "离线" },
  { layerName: "三维白模", featureCount: 2105, lastSync: "2026-04-18 07:30", status: "正常" }
];
