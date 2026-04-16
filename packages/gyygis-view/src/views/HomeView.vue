<template>
  <main class="homeDockview">
    <DockviewVue class="dockviewFill" @ready="onReady" />
    <div
      class="cornerHotspot"
      aria-label="corner-hotspot"
      role="button"
      tabindex="0"
      @click.stop="onCornerClick"
      @pointerdown.stop.prevent="onCornerPointerDown"
      @pointerup.stop="onCornerPointerUp"
      @pointercancel.stop="onCornerPointerCancel"
      @pointerleave.stop="onCornerPointerCancel"
      @contextmenu.prevent
    />
  </main>
</template>

<script lang="ts">
import { computed, defineComponent, h } from "vue";
import { DockviewVue } from "dockview-vue";
import TiandituMapPanel from "@/panels/TiandituMapPanel.vue";

const TDT_WEB_TK = "fa7482bbcd44e52cb5fb76cde5e7c83e";

type DockviewVuePanelProps = {
  // dockview-vue 会将真正的业务 params 再包一层：props.params.params
  params?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  containerApi?: any;
  tabLocation?: unknown;
};

const GridPanel = defineComponent({
  name: "GridPanel",
  props: {
    params: { type: Object, required: true }
  },
  setup(props: { params: unknown }) {
    const dv = props.params as DockviewVuePanelProps;
    const panelId = computed(() => {
      const apiId = (dv.api as { id?: string } | undefined)?.id;
      if (apiId) return apiId;
      const pId = (dv.params as { id?: string } | undefined)?.id;
      return pId ?? "";
    });
    const panelTitle = computed(() => {
      const t = (dv.params as { title?: string } | undefined)?.title;
      return t ?? panelId.value ?? "Panel";
    });
    const kind = computed(() => {
      return ((dv.params as { kind?: string } | undefined)?.kind ?? "") as string;
    });

    const shouldRenderMap = computed(() => kind.value === "tianditu" || panelId.value === "r2c2");

    return () =>
      h("section", { class: "gridPanel" }, [
        h("header", { class: "gridPanel__header" }, [
          h("div", { class: "gridPanel__title" }, panelTitle.value),
          h(
            "div",
            { class: "gridPanel__meta" },
            panelId.value ? `id: ${panelId.value}${kind.value ? ` · ${kind.value}` : ""}` : ""
          )
        ]),
        shouldRenderMap.value
          ? h(TiandituMapPanel, { tk: TDT_WEB_TK })
          : h("div", { class: "gridPanel__body" }, [
              h("div", { class: "gridPanel__hint" }, "Dockview 3×3 网格示例")
            ])
      ]);
  }
});

export default {
  components: {
    DockviewVue,
    GridPanel
  }
};
</script>

<script setup lang="ts">
import { onBeforeUnmount as onBeforeUnmountSetup, ref as refSetup } from "vue";
import type { DockviewApi, DockviewReadyEvent } from "dockview-core";

const dockviewApi = refSetup<DockviewApi | null>(null);

const CORNER_MULTI_TAP_WINDOW_MS = 2000;
const CORNER_MULTI_TAP_COUNT = 5;
const CORNER_LONG_PRESS_MS = 1500;

const cornerTapTs = refSetup<number[]>([]);
const cornerLongPressTimer = refSetup<number | null>(null);
const cornerLongPressFired = refSetup(false);

function triggerCornerAlert(reason: "multi-tap" | "long-press") {
  cornerTapTs.value = [];
  if (cornerLongPressTimer.value != null) {
    window.clearTimeout(cornerLongPressTimer.value);
    cornerLongPressTimer.value = null;
  }
  cornerLongPressFired.value = true;
  window.alert(reason === "multi-tap" ? "已触发：2秒内连点5次" : "已触发：长按1.5秒");

  // 避免长按触发后紧跟着的 click 再触发一次
  window.setTimeout(() => {
    cornerLongPressFired.value = false;
  }, 0);
}

function onCornerClick() {
  if (cornerLongPressFired.value) return;

  const now = Date.now();
  const keepAfter = now - CORNER_MULTI_TAP_WINDOW_MS;
  cornerTapTs.value = cornerTapTs.value.filter((t: number) => t >= keepAfter);
  cornerTapTs.value.push(now);

  if (cornerTapTs.value.length >= CORNER_MULTI_TAP_COUNT) {
    triggerCornerAlert("multi-tap");
  }
}

function clearCornerLongPressTimer() {
  if (cornerLongPressTimer.value != null) {
    window.clearTimeout(cornerLongPressTimer.value);
    cornerLongPressTimer.value = null;
  }
}

function onCornerPointerDown() {
  cornerLongPressFired.value = false;
  clearCornerLongPressTimer();
  cornerLongPressTimer.value = window.setTimeout(() => {
    triggerCornerAlert("long-press");
  }, CORNER_LONG_PRESS_MS);
}

function onCornerPointerUp() {
  clearCornerLongPressTimer();
}

function onCornerPointerCancel() {
  clearCornerLongPressTimer();
}

function onReady(event: DockviewReadyEvent) {
  const { api } = event;
  dockviewApi.value = api;

  // 用 addPanel + position(referencePanel, direction) 构造 3 行 × 3 列（共 9 个 Panel）。
  // 关键点：每一列单独向下 split 出三行，避免出现“只在左侧列分割、右侧没跟着分割”的情况。
  // “中间更大”：通过给中行/中列的 split 提供更大的 size 提示（不同版本可能忽略该字段）。
  const p11 = "r1c1";
  const p12 = "r1c2";
  const p13 = "r1c3";
  const p21 = "r2c1";
  const p22 = "r2c2";
  const p23 = "r2c3";
  const p31 = "r3c1";
  const p32 = "r3c2";
  const p33 = "r3c3";

  // 第 1 行：先生成 3 列
  api.addPanel({ id: p11, component: "GridPanel", title: "1-1", params: { id: p11, title: "1-1" } });
  api.addPanel({
    id: p12,
    component: "GridPanel",
    title: "1-2（中列）",
    params: { id: p12, title: "1-2（中列）" },
    position: { referencePanel: p11, direction: "right", size: 520 } as any
  });
  api.addPanel({
    id: p13,
    component: "GridPanel",
    title: "1-3",
    params: { id: p13, title: "1-3" },
    position: { referencePanel: p12, direction: "right" } as any
  });

  // 第 2 行：每一列都向下 split 一次（中行更大）
  api.addPanel({
    id: p21,
    component: "GridPanel",
    title: "2-1（中行）",
    params: { id: p21, title: "2-1（中行）" },
    position: { referencePanel: p11, direction: "below", size: 420 } as any
  });
  api.addPanel({
    id: p22,
    component: "GridPanel",
    title: "2-2（中心更大）",
    params: { id: p22, title: "2-2（中心更大）", kind: "tianditu" },
    position: { referencePanel: p12, direction: "below", size: 420 } as any
  });
  api.addPanel({
    id: p23,
    component: "GridPanel",
    title: "2-3（中行）",
    params: { id: p23, title: "2-3（中行）" },
    position: { referencePanel: p13, direction: "below", size: 420 } as any
  });

  // 第 3 行：再对第 2 行各列继续向下 split 一次
  api.addPanel({
    id: p31,
    component: "GridPanel",
    title: "3-1",
    params: { id: p31, title: "3-1" },
    position: { referencePanel: p21, direction: "below" } as any
  });
  api.addPanel({
    id: p32,
    component: "GridPanel",
    title: "3-2（中列）",
    params: { id: p32, title: "3-2（中列）" },
    position: { referencePanel: p22, direction: "below" } as any
  });
  api.addPanel({
    id: p33,
    component: "GridPanel",
    title: "3-3",
    params: { id: p33, title: "3-3" },
    position: { referencePanel: p23, direction: "below" } as any
  });
}

onBeforeUnmountSetup(() => {
  dockviewApi.value = null;
  cornerTapTs.value = [];
  clearCornerLongPressTimer();
});
</script>

<style scoped>
.homeDockview {
  height: 100vh;
  width: 100%;
  min-height: 0;
  min-width: 0;
  position: relative;
}

.dockviewFill {
  height: 100%;
  width: 100%;
  min-height: 0;
  min-width: 0;
}

.cornerHotspot {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  z-index: 50;
  background: transparent;
  cursor: default;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.2;
}

.btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--primary {
  border-color: rgba(64, 140, 255, 0.45);
  background: rgba(64, 140, 255, 0.18);
}

.muted {
  opacity: 0.75;
  font-size: 12px;
}
</style>

<style>
.gridPanel {
  box-sizing: border-box;
  height: 100%;
  padding: 12px;
  color: var(--dv-activegroup-visiblepanel-tab-color, rgba(255, 255, 255, 0.92));
  background: var(--dv-group-view-background-color, rgba(11, 16, 32, 0.65));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.gridPanel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}

.gridPanel__title {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.gridPanel__meta {
  font-size: 12px;
  opacity: 0.75;
}

.gridPanel__body {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.85;
}

.gridPanel__mapWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  pointer-events: auto;
}

.tdtMap {
  height: 100%;
  width: 100%;
  min-height: 0;
  pointer-events: auto;
  touch-action: none;
}


.gridPanel__mapWrap .ol-viewport,
.gridPanel__mapWrap .ol-layers,
.gridPanel__mapWrap canvas {
  width: 100%;
  height: 100%;
}

.tdtError {
  padding: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
}
</style>
