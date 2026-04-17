import type { EChartsOption } from "echarts";

/** 示例柱状图数据（可后续替换为接口数据） */
const MOCK_CATEGORIES = ["华东", "华北", "华南", "西南", "西北"];
const MOCK_VALUES = [128, 96, 156, 72, 88];

export function buildBarChartOption(): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "rgba(255,255,255,0.88)" },
    title: {
      text: "区域指标（示例）",
      left: "center",
      top: 4,
      textStyle: { fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }
    },
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
    xAxis: {
      type: "category",
      data: MOCK_CATEGORIES,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.25)" } },
      axisLabel: { color: "rgba(255,255,255,0.75)" }
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
      axisLabel: { color: "rgba(255,255,255,0.75)" }
    },
    series: [
      {
        type: "bar",
        name: "数值",
        data: MOCK_VALUES,
        barMaxWidth: 36,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(96, 165, 250, 0.95)" },
              { offset: 1, color: "rgba(59, 130, 246, 0.55)" }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  };
}
