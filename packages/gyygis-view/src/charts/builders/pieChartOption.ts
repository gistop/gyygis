import type { EChartsOption } from "echarts";

/**
 * 饼图 option 占位：与柱状图数据流一致后可改为同一套数据源映射。
 * 需在 echartsRegistry 中已注册 PieChart（已完成）。
 */
const MOCK_PIE = [
  { name: "类型 A", value: 42 },
  { name: "类型 B", value: 28 },
  { name: "类型 C", value: 18 },
  { name: "其他", value: 12 }
];

export function buildPieChartOption(): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "rgba(255,255,255,0.88)" },
    title: {
      text: "占比（示例）",
      left: "center",
      top: 4,
      textStyle: { fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }
    },
    tooltip: { trigger: "item" },
    legend: {
      bottom: 4,
      textStyle: { color: "rgba(255,255,255,0.78)" }
    },
    series: [
      {
        type: "pie",
        radius: ["34%", "58%"],
        center: ["50%", "52%"],
        itemStyle: { borderRadius: 6, borderColor: "rgba(15, 23, 42, 0.9)", borderWidth: 2 },
        label: { color: "rgba(255,255,255,0.88)" },
        data: MOCK_PIE
      }
    ]
  };
}
