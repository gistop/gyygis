import type { EChartsOption } from "echarts";
import type { DockviewChartKind } from "./types";
import { buildBarChartOption } from "./builders/barChartOption";
import { buildLineChartOption } from "./builders/lineChartOption";
import { buildPieChartOption } from "./builders/pieChartOption";

/**
 * 集中分发：新增图类时增加 case 与对应 builder 即可。
 */
export function buildDockviewChartOption(kind: DockviewChartKind): EChartsOption {
  switch (kind) {
    case "bar":
      return buildBarChartOption();
    case "pie":
      return buildPieChartOption();
    case "line":
      return buildLineChartOption();
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
