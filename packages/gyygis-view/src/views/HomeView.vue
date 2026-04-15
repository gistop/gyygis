<template>
  <main class="homeDockview">
    <DockviewVue class="dockviewFill" @ready="onReady" />
  </main>
</template>

<script lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { DockviewVue } from "dockview-vue";
// 注意：安装依赖前会暂时在编辑器里报 “Cannot find module 'ol'”
// 执行 `pnpm -C packages/gyygis-view add ol && pnpm -C packages/gyygis-view install` 后即可恢复
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import "ol/ol.css";

const TDT_WEB_TK = "";

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
  setup(props) {
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

    const mapEl = ref<HTMLDivElement | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any | null = null;
    let ro: ResizeObserver | null = null;

    const shouldRenderMap = computed(() => kind.value === "tianditu" || panelId.value === "r2c2");

    onMounted(async () => {
      if (!shouldRenderMap.value) return;
      if (!mapEl.value) return;

      try {
        await nextTick();

        const imgLayer = new TileLayer({
          source: new XYZ({
            url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${TDT_WEB_TK}`,
            crossOrigin: "anonymous"
          })
        });
        const imgLabelLayer = new TileLayer({
          source: new XYZ({
            url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${TDT_WEB_TK}`,
            crossOrigin: "anonymous"
          })
        });

        mapInstance = new Map({
          target: mapEl.value,
          layers: [imgLayer, imgLabelLayer],
          view: new View({
            center: fromLonLat([116.407526, 39.90403]),
            zoom: 12
          })
        });

        // Dockview 初次布局时容器尺寸可能在 mounted 后才稳定，补一次 updateSize
        await nextTick();
        requestAnimationFrame(() => {
          mapInstance?.updateSize?.();
        });

        ro = new ResizeObserver(() => {
          mapInstance?.updateSize?.();
        });
        ro.observe(mapEl.value);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        mapEl.value.innerHTML = `<div class="tdtError">天地图加载失败：${msg}</div>`;
      }
    });

    onBeforeUnmount(() => {
      // dockview 面板卸载时尽量释放引用
      ro?.disconnect();
      ro = null;
      mapInstance?.setTarget?.(undefined);
      mapInstance = null;
    });

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
          ? h("div", {
              class: "gridPanel__mapWrap",
              // Dockview 容器可能会监听/劫持拖拽手势（用于面板拖拽/分割），
              // 这里阻断冒泡，确保 OpenLayers 能收到 pointer drag 事件。
              onPointerdown: (e: PointerEvent) => e.stopPropagation(),
              onMousedown: (e: MouseEvent) => e.stopPropagation(),
              onTouchstart: (e: TouchEvent) => e.stopPropagation()
            }, [
              h("div", { ref: mapEl, class: "tdtMap" })
            ])
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
});
</script>

<style scoped>
.homeDockview {
  height: 100vh;
  width: 100%;
  min-height: 0;
  min-width: 0;
}

.dockviewFill {
  height: 100%;
  width: 100%;
  min-height: 0;
  min-width: 0;
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
