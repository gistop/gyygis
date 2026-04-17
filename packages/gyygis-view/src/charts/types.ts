/** 与 Dockview 面板 params.chartKind 对齐，可在此扩展更多类型 */
export type DockviewChartKind = "bar" | "pie" | "line";

export function isDockviewChartKind(v: string): v is DockviewChartKind {
  return v === "bar" || v === "pie" || v === "line";
}
