import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import type { EChartsType } from "echarts/core";
import { echarts } from "@/charts/echartsRegistry";
import { buildDockviewChartOption } from "@/charts/buildDockviewChartOption";
import type { DockviewChartKind } from "@/charts/types";

/**
 * 在 Dockview 面板内挂载 ECharts：resize、切换 chartKind、卸载时 dispose。
 */
export function useEchartsDockHost(
  elRef: Ref<HTMLDivElement | null>,
  chartKind: Ref<DockviewChartKind>
) {
  let chart: EChartsType | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function dispose() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    chart?.dispose();
    chart = null;
  }

  function applyOption() {
    if (!chart) return;
    chart.setOption(buildDockviewChartOption(chartKind.value), { notMerge: true });
  }

  function ensureChart() {
    const el = elRef.value;
    if (!el) return;

    if (!chart) {
      chart = echarts.init(el, undefined, { renderer: "canvas" });
      resizeObserver = new ResizeObserver(() => {
        chart?.resize();
      });
      resizeObserver.observe(el);
    }
    applyOption();
  }

  onMounted(() => {
    void nextTick(() => {
      ensureChart();
    });
  });

  watch(chartKind, () => {
    ensureChart();
  });

  onBeforeUnmount(() => {
    dispose();
  });

  return { dispose };
}
