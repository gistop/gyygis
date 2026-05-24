import type { DockviewChartKind } from "@/charts/types";
import { isDockviewChartKind } from "@/charts/types";

/** 演示用占位图（可替换为任意 https 图片） */
export const DEFAULT_PANEL_IMAGE_URL =
  "https://picsum.photos/id/237/800/450";

/** 地图控件面板：图层列表 / 鹰眼（OverviewMap） */
export type MapControlKind = "layers" | "overview";

export type PanelContentRadio =
  | "map"
  | "chart"
  | "table"
  | "stats"
  | "image"
  | "time"
  | "mapControls"
  | "auto";

export type EffectivePanelContent =
  | "map"
  | "chart"
  | "table"
  | "stats"
  | "image"
  | "time"
  | "mapControls"
  | "none";

/** 时间面板：24 小时数字时钟 / 表盘 */
export type TimeDisplayMode = "digital" | "dial";

export function coerceTimeDisplayMode(raw: unknown): TimeDisplayMode {
  const s = String(raw ?? "").toLowerCase();
  if (s === "dial" || s === "analog") return "dial";
  return "digital";
}

/** 图片面板：拉伸铺满（不裁切、可不保持宽高比） / 完整显示（保持比例、可留边） */
export type PanelImageObjectFit = "fill" | "contain";

export function coercePanelImageObjectFit(raw: unknown): PanelImageObjectFit {
  const s = String(raw ?? "").toLowerCase();
  if (s === "contain") return "contain";
  // 旧版 cover（裁切铺满）按大屏需求并入 fill（铺满不裁切，必要时拉伸）
  if (s === "cover" || s === "fill") return "fill";
  return "fill";
}

/**
 * 显式 `panelContent` 优先；否则按 kind / chartKind / embedKind 推导。
 */
export function getEffectivePanelContent(
  params: Record<string, unknown>,
  panelId: string
): EffectivePanelContent {
  const pc = params.panelContent;
  if (
    pc === "map" ||
    pc === "chart" ||
    pc === "table" ||
    pc === "stats" ||
    pc === "image" ||
    pc === "time" ||
    pc === "mapControls"
  ) {
    return pc;
  }
  const kind = String(params.kind ?? "");
  const chartRaw = String(params.chartKind ?? "");
  const embedKind = String(params.embedKind ?? "");
  if (kind === "tianditu" || kind === "map") return "map";
  if (isDockviewChartKind(chartRaw)) return "chart";
  if (embedKind === "table") return "table";
  if (embedKind === "stats") return "stats";
  if (embedKind === "mapControls") return "mapControls";
  if (embedKind === "image") return "image";
  if (embedKind === "time") return "time";
  return "none";
}

/** Tab / 抽屉展示用短标题（未手动设置 title 时） */
export function getPanelTabDisplayTitle(
  params: Record<string, unknown>,
  panelId: string,
  dockviewTitle?: string
): string {
  const manual = typeof params.title === "string" ? params.title.trim() : "";
  if (manual) return manual;
  const dock = typeof dockviewTitle === "string" ? dockviewTitle.trim() : "";
  if (dock) return dock;

  const eff = getEffectivePanelContent(params, panelId);
  if (eff === "none") return "空面板";
  if (eff === "map") return "地图";
  if (eff === "mapControls") {
    return coerceMapControlKind(params.mapControlKind) === "overview" ? "鹰眼" : "地图控件";
  }
  if (eff === "chart") {
    const ck = String(params.chartKind ?? "bar");
    if (ck === "pie") return "饼图";
    if (ck === "line") return "折线图";
    return "柱状图";
  }
  if (eff === "table") return "表格";
  if (eff === "stats") return "统计值";
  if (eff === "time") {
    return coerceTimeDisplayMode(params.timeDisplayMode) === "dial" ? "表盘时钟" : "数字时钟";
  }
  if (eff === "image") return "图片";
  return panelId || "面板";
}

/** 根据编辑抽屉所选类型生成 Tab 标题 */
export function getPanelTabTitleForMode(
  mode: PanelContentRadio,
  chartKind?: DockviewChartKind
): string {
  if (mode === "auto") return "";
  if (mode === "map") return "地图";
  if (mode === "mapControls") return "地图控件";
  if (mode === "chart") {
    if (chartKind === "pie") return "饼图";
    if (chartKind === "line") return "折线图";
    return "柱状图";
  }
  if (mode === "table") return "表格";
  if (mode === "stats") return "统计值";
  if (mode === "time") return "数字时钟";
  if (mode === "image") return "图片";
  return "";
}

/**
 * Dockview `updateParameters` 会整体替换 parameters，因此始终基于当前参数做浅拷贝再改。
 * `auto`：清空内容相关参数，面板恢复为空槽位。
 */
export function coerceMapControlKind(raw: unknown): MapControlKind {
  return String(raw ?? "").toLowerCase() === "overview" ? "overview" : "layers";
}

export function mergePanelContentParams(
  base: Record<string, unknown>,
  mode: PanelContentRadio,
  opts?: {
    chartKind?: DockviewChartKind;
    imageUrl?: string;
    imageObjectFit?: PanelImageObjectFit;
    tableLayerName?: string;
    tableFields?: string[];
    statsLayerName?: string;
    statsFields?: string[];
    timeDisplayMode?: TimeDisplayMode;
    mapControlKind?: MapControlKind;
    linkedMapPanelId?: string;
  }
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  if (mode === "auto") {
    delete out.panelContent;
    delete out.kind;
    delete out.chartKind;
    delete out.embedKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.timeDisplayMode;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
    delete out.mapLayers;
    delete out.mapCatalogId;
    delete out.mapCatalogIds;
    return out;
  }
  out.panelContent = mode;
  if (mode === "map") {
    out.kind = "map";
    delete out.chartKind;
    delete out.embedKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.timeDisplayMode;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
  } else if (mode === "chart") {
    delete out.kind;
    delete out.embedKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.timeDisplayMode;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
    const ck = opts?.chartKind;
    out.chartKind = ck && isDockviewChartKind(ck) ? ck : "bar";
  } else if (mode === "table") {
    delete out.kind;
    delete out.chartKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.timeDisplayMode;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
    out.embedKind = "table";
    const layerName = (opts?.tableLayerName ?? "").trim();
    if (layerName) out.tableLayerName = layerName;
    else delete out.tableLayerName;
    if (Array.isArray(opts?.tableFields)) {
      const f = opts!.tableFields!.map(s => String(s).trim()).filter(Boolean);
      if (f.length) out.tableFields = f;
      else delete out.tableFields;
    }
  } else if (mode === "stats") {
    delete out.kind;
    delete out.chartKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.timeDisplayMode;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
    out.embedKind = "stats";
    const statsLayer = (opts?.statsLayerName ?? "").trim();
    if (statsLayer) out.statsLayerName = statsLayer;
    else delete out.statsLayerName;
    if (Array.isArray(opts?.statsFields)) {
      const f = opts!.statsFields!.map(s => String(s).trim()).filter(Boolean);
      if (f.length) out.statsFields = f;
      else delete out.statsFields;
    }
  } else if (mode === "image") {
    delete out.kind;
    delete out.chartKind;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.timeDisplayMode;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
    out.embedKind = "image";
    const url = (opts?.imageUrl ?? "").trim();
    out.imageUrl = url || DEFAULT_PANEL_IMAGE_URL;
    out.imageObjectFit = coercePanelImageObjectFit(opts?.imageObjectFit ?? out.imageObjectFit);
  } else if (mode === "time") {
    delete out.kind;
    delete out.chartKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.mapControlKind;
    delete out.linkedMapPanelId;
    out.embedKind = "time";
    out.timeDisplayMode = coerceTimeDisplayMode(opts?.timeDisplayMode ?? out.timeDisplayMode);
  } else if (mode === "mapControls") {
    delete out.kind;
    delete out.chartKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    delete out.statsLayerName;
    delete out.statsFields;
    delete out.timeDisplayMode;
    delete out.mapLayers;
    delete out.mapCatalogIds;
    delete out.mapCatalogId;
    out.embedKind = "mapControls";
    out.mapControlKind = coerceMapControlKind(opts?.mapControlKind ?? base.mapControlKind);
    const lid = (opts?.linkedMapPanelId ?? "").trim();
    if (lid) out.linkedMapPanelId = lid;
    else delete out.linkedMapPanelId;
  }
  return out;
}
