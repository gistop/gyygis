<template>
  <div
    class="gridPanel__chartWrap"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <div ref="chartEl" class="echartsDockHost" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { DockviewChartKind } from "@/charts/types";
import { useEchartsDockHost } from "@/composables/useEchartsDockHost";

const props = defineProps<{
  chartKind: DockviewChartKind;
}>();

const chartEl = ref<HTMLDivElement | null>(null);
const kindRef = computed<DockviewChartKind>(() => props.chartKind);

useEchartsDockHost(chartEl, kindRef);

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}
</script>

<style scoped>
.gridPanel__chartWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: var(--gyygis-panel-content-border-radius, 10px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  pointer-events: auto;
}

.echartsDockHost {
  width: 100%;
  height: 100%;
  min-height: 160px;
  pointer-events: auto;
  touch-action: pan-x pan-y;
}
</style>
