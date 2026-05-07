<template>
  <div
    class="timePanel"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <div v-if="displayMode === 'digital'" class="timePanel__digital">{{ digitalLine }}</div>
    <svg v-else class="timePanel__dial" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="timePanel__dialFace" cx="100" cy="100" r="88" />
      <g class="timePanel__ticks">
        <line
          v-for="n in 12"
          :key="'t' + n"
          x1="100"
          y1="22"
          x2="100"
          y2="30"
          class="timePanel__tickMajor"
          :transform="`rotate(${(n - 1) * 30} 100 100)`"
        />
      </g>
      <!-- 指针在 <g translate+rotate> 内绘制，避免 line 上混用 SVG transform 与 CSS transform-origin（viewBox 缩放后像素原点与几何中心不一致） -->
      <g :transform="`translate(100 100) rotate(${hourDeg})`">
        <line class="timePanel__hand timePanel__handHour" x1="0" y1="0" x2="0" y2="-48" />
      </g>
      <g :transform="`translate(100 100) rotate(${minuteDeg})`">
        <line class="timePanel__hand timePanel__handMin" x1="0" y1="0" x2="0" y2="-64" />
      </g>
      <g :transform="`translate(100 100) rotate(${secondDeg})`">
        <line class="timePanel__hand timePanel__handSec" x1="0" y1="0" x2="0" y2="-72" />
      </g>
      <circle class="timePanel__cap" cx="100" cy="100" r="4" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { TimeDisplayMode } from "@/panelContentMode";

const props = defineProps<{
  displayMode: TimeDisplayMode;
}>();

const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const digitalLine = computed(() => {
  const d = now.value;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
});

/** 12 点方向为 0°，顺时针 */
const secondDeg = computed(() => now.value.getSeconds() * 6);
const minuteDeg = computed(() => now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1);
const hourDeg = computed(() => {
  const h = now.value.getHours() % 12;
  return h * 30 + now.value.getMinutes() * 0.5 + now.value.getSeconds() * (1 / 120);
});

function tick() {
  now.value = new Date();
}

onMounted(() => {
  tick();
  timer = setInterval(tick, 1000);
});

onUnmounted(() => {
  if (timer != null) clearInterval(timer);
});

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}
</script>

<style scoped>
.timePanel {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: var(--gyygis-panel-content-border-radius, 10px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.timePanel__digital {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  font-size: clamp(1.5rem, 5.5vw, 2.75rem);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(230, 240, 255, 0.95);
  text-shadow: 0 0 20px rgba(100, 180, 255, 0.35);
}

.timePanel__dial {
  width: min(92%, 280px);
  height: auto;
  aspect-ratio: 1;
  max-height: 100%;
}

.timePanel__dialFace {
  fill: rgba(20, 32, 48, 0.85);
  stroke: rgba(120, 180, 255, 0.35);
  stroke-width: 2;
}

.timePanel__tickMajor {
  stroke: rgba(200, 220, 255, 0.45);
  stroke-width: 2;
  stroke-linecap: round;
}

.timePanel__hand {
  stroke-linecap: round;
}

.timePanel__handHour {
  stroke: rgba(230, 240, 255, 0.92);
  stroke-width: 5;
}

.timePanel__handMin {
  stroke: rgba(160, 200, 255, 0.9);
  stroke-width: 3;
}

.timePanel__handSec {
  stroke: rgba(255, 120, 100, 0.95);
  stroke-width: 1.5;
}

.timePanel__cap {
  fill: rgba(230, 240, 255, 0.95);
}
</style>
