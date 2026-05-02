import type { DockviewChartKind } from "@/charts/types";
import { isDockviewChartKind } from "@/charts/types";

/** 演示用占位图（可替换为任意 https 图片） */
export const DEFAULT_PANEL_IMAGE_URL =
  "https://picsum.photos/id/237/800/450";

export type PanelContentRadio = "map" | "chart" | "table" | "image" | "auto";

export type EffectivePanelContent = "map" | "chart" | "table" | "image" | "none";

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
 * 显式 `panelContent` 优先；否则沿用原有规则（含 r2c2 默认地图等）。
 */
export function getEffectivePanelContent(
  params: Record<string, unknown>,
  panelId: string
): EffectivePanelContent {
  const pc = params.panelContent;
  if (pc === "map" || pc === "chart" || pc === "table" || pc === "image") {
    return pc;
  }
  const kind = String(params.kind ?? "");
  const chartRaw = String(params.chartKind ?? "");
  const embedKind = String(params.embedKind ?? "");
  if (kind === "tianditu" || kind === "map" || panelId === "r2c2") return "map";
  if (isDockviewChartKind(chartRaw)) return "chart";
  if (embedKind === "table") return "table";
  if (embedKind === "image") return "image";
  return "none";
}

/**
 * Dockview `updateParameters` 会整体替换 parameters，因此始终基于当前参数做浅拷贝再改。
 * `auto`：仅移除 `panelContent`，恢复为按 kind / chartKind / embedKind / panelId 推导。
 */
export function mergePanelContentParams(
  base: Record<string, unknown>,
  mode: PanelContentRadio,
  opts?: {
    chartKind?: DockviewChartKind;
    imageUrl?: string;
    imageObjectFit?: PanelImageObjectFit;
    tableLayerName?: string;
    tableFields?: string[];
  }
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  if (mode === "auto") {
    delete out.panelContent;
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
  } else if (mode === "chart") {
    delete out.kind;
    delete out.embedKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    delete out.tableLayerName;
    delete out.tableFields;
    const ck = opts?.chartKind;
    out.chartKind = ck && isDockviewChartKind(ck) ? ck : "bar";
  } else if (mode === "table") {
    delete out.kind;
    delete out.chartKind;
    delete out.imageUrl;
    delete out.imageObjectFit;
    out.embedKind = "table";
    const layerName = (opts?.tableLayerName ?? "").trim();
    if (layerName) out.tableLayerName = layerName;
    else delete out.tableLayerName;
    if (Array.isArray(opts?.tableFields)) {
      const f = opts!.tableFields!.map(s => String(s).trim()).filter(Boolean);
      if (f.length) out.tableFields = f;
      else delete out.tableFields;
    }
  } else if (mode === "image") {
    delete out.kind;
    delete out.chartKind;
    delete out.tableLayerName;
    delete out.tableFields;
    out.embedKind = "image";
    const url = (opts?.imageUrl ?? "").trim();
    out.imageUrl = url || DEFAULT_PANEL_IMAGE_URL;
    out.imageObjectFit = coercePanelImageObjectFit(opts?.imageObjectFit ?? out.imageObjectFit);
  }
  return out;
}
