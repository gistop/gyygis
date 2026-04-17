import type { EChartsOption } from "echarts";

/** 折线图示例数据 */
const MOCK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const MOCK_SERIES = [12, 19, 15, 22, 28, 24, 18];

export function buildLineChartOption(): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "rgba(255,255,255,0.88)" },
    title: {
      text: "趋势（示例）",
      left: "center",
      top: 4,
      textStyle: { fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }
    },
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 16, top: 40, bottom: 28 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: MOCK_DAYS,
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
        type: "line",
        name: "指标",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color: "rgba(52, 211, 153, 0.95)" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(52, 211, 153, 0.35)" },
              { offset: 1, color: "rgba(52, 211, 153, 0.02)" }
            ]
          }
        },
        data: MOCK_SERIES
      }
    ]
  };
}
