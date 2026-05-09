<template>
  <div
    class="mapControlsPanel"
    :class="{ 'mapControlsPanel--overviewFill': isOverviewFillLayout }"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <p v-if="!linkedId" class="muted mapControlsPanel__hint">请在编辑抽屉中选择要关联的地图面板。</p>
    <p v-else-if="!linkedMap" class="muted mapControlsPanel__hint">
      等待目标地图加载（面板 <code>{{ linkedId }}</code>）…
    </p>
    <template v-else>
      <div v-if="controlKind === 'layers'" class="mapControlsPanel__layers">
        <div v-for="(row, idx) in layerRows" :key="row.uid" class="mapControlsPanel__layerRow">
          <el-checkbox
            :model-value="row.visible"
            @update:model-value="(v: boolean | string | number) => setLayerVisible(idx, v === true)"
          >
            {{ row.label }}
          </el-checkbox>
        </div>
        <p v-if="layerRows.length === 0" class="muted mapControlsPanel__hint">该地图上暂无图层。</p>
      </div>
      <div v-else ref="overviewHostEl" class="mapControlsPanel__overviewHost" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type OlMap from "ol/Map";
import type BaseLayer from "ol/layer/Base";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import OverviewMap from "ol/control/OverviewMap";
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";
import { getUid } from "ol/util";
import {
  getOlMapForPanel,
  subscribeOlMapPanelRegistry
} from "@/mapPanelRegistry";
import { coerceMapControlKind, type MapControlKind } from "@/panelContentMode";

const props = defineProps<{
  params: Record<string, unknown>;
}>();

const linkedId = computed(() => {
  const v = props.params.linkedMapPanelId;
  return typeof v === "string" ? v.trim() : "";
});

const controlKind = computed<MapControlKind>(() => coerceMapControlKind(props.params.mapControlKind));

const linkedMap = shallowRef<OlMap | null>(null);

const isOverviewFillLayout = computed(
  () => Boolean(linkedId.value && linkedMap.value && controlKind.value === "overview")
);
const overviewHostEl = ref<HTMLDivElement | null>(null);
let overviewControl: OverviewMap | null = null;
/** 当前挂载 Overview 控件的地图（用于卸载时 removeControl） */
let overviewOwnerMap: OlMap | null = null;
let overviewResizeRo: ResizeObserver | null = null;
let layerListenKeys: EventsKey[] = [];

type LayerRow = { uid: string; label: string; visible: boolean; layer: BaseLayer };
const layerRows = ref<LayerRow[]>([]);

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}

function resolveLinkedMap(): OlMap | null {
  const id = linkedId.value;
  if (!id) return null;
  return getOlMapForPanel(id) ?? null;
}

function syncLinkedMap(): void {
  linkedMap.value = resolveLinkedMap();
}

function layerLabel(layer: BaseLayer, index: number): string {
  const t = layer.get("title");
  if (typeof t === "string" && t.trim()) return t.trim();
  const n = layer.get("name");
  if (typeof n === "string" && n.trim()) return n.trim();
  return `图层 ${index + 1}`;
}

function refreshLayerRows(map: OlMap): void {
  const arr = map.getLayers().getArray();
  layerRows.value = arr.map((layer, index) => ({
    uid: getUid(layer),
    label: layerLabel(layer, index),
    visible: layer.getVisible(),
    layer
  }));
}

function setLayerVisible(index: number, visible: boolean): void {
  const row = layerRows.value[index];
  if (!row) return;
  row.layer.setVisible(visible);
  row.visible = visible;
}

function teardownLayerListeners(): void {
  if (layerListenKeys.length) {
    unByKey(layerListenKeys);
    layerListenKeys = [];
  }
}

function setupLayerListeners(map: OlMap): void {
  teardownLayerListeners();
  const col = map.getLayers();
  const bump = () => refreshLayerRows(map);
  layerListenKeys = [col.on("add", bump), col.on("remove", bump)];
}

function teardownOverview(): void {
  overviewResizeRo?.disconnect();
  overviewResizeRo = null;
  if (overviewControl && overviewOwnerMap) {
    overviewOwnerMap.removeControl(overviewControl);
  }
  overviewControl = null;
  overviewOwnerMap = null;
}

function buildOverviewLayers() {
  return [
    new TileLayer({
      source: new XYZ({ url: `/api/tianditu/img?x={x}&y={y}&l={z}` })
    }),
    new TileLayer({
      source: new XYZ({ url: `/api/tianditu/label?x={x}&y={y}&l={z}` })
    })
  ];
}

async function setupOverview(map: OlMap): Promise<void> {
  teardownOverview();
  await nextTick();
  const target = overviewHostEl.value;
  if (!target || !linkedId.value) return;
  const ctrl = new OverviewMap({
    target,
    layers: buildOverviewLayers(),
    collapsible: false,
    collapsed: false,
    className: "gyygis-overviewmap--panel"
  });
  map.addControl(ctrl);
  overviewControl = ctrl;
  overviewOwnerMap = map;

  const bumpOverviewSize = () => {
    ctrl.getOverviewMap()?.updateSize();
  };
  overviewResizeRo = new ResizeObserver(() => {
    requestAnimationFrame(bumpOverviewSize);
  });
  overviewResizeRo.observe(target);

  requestAnimationFrame(() => {
    map.updateSize();
    bumpOverviewSize();
  });
}

watch(linkedId, () => {
  syncLinkedMap();
});

const unsubRegistry = subscribeOlMapPanelRegistry(() => {
  syncLinkedMap();
});

watch(
  () => ({
    map: linkedMap.value,
    kind: controlKind.value,
    host: overviewHostEl.value
  }),
  (cur, prev) => {
    const prevMap = prev?.map ?? null;
    if (prevMap && prevMap !== cur.map) {
      teardownLayerListeners();
    }
    teardownOverview();

    if (!cur.map) {
      layerRows.value = [];
      return;
    }

    if (cur.kind === "layers") {
      setupLayerListeners(cur.map);
      refreshLayerRows(cur.map);
    } else {
      teardownLayerListeners();
      layerRows.value = [];
      if (cur.host) void setupOverview(cur.map);
    }
  },
  { flush: "post", immediate: true }
);

syncLinkedMap();

onBeforeUnmount(() => {
  teardownLayerListeners();
  teardownOverview();
  unsubRegistry();
});
</script>

<style scoped>
.mapControlsPanel {
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  overflow: auto;
}

.mapControlsPanel--overviewFill {
  padding: 0;
  overflow: hidden;
}

.mapControlsPanel__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.mapControlsPanel__layers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.mapControlsPanel__layerRow {
  font-size: 13px;
}

.mapControlsPanel__overviewHost {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mapControlsPanel--overviewFill .mapControlsPanel__overviewHost {
  border-radius: var(--gyygis-panel-content-border-radius, 10px);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

/* OpenLayers OverviewMap：铺满 target，随容器变化 */
.mapControlsPanel__overviewHost :deep(.gyygis-overviewmap--panel) {
  position: relative;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.mapControlsPanel__overviewHost :deep(.gyygis-overviewmap--panel .ol-overviewmap-map) {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: none;
  border-radius: 0;
}

.mapControlsPanel__overviewHost :deep(.gyygis-overviewmap--panel .ol-overviewmap-map .ol-viewport),
.mapControlsPanel__overviewHost :deep(.gyygis-overviewmap--panel .ol-overviewmap-map canvas) {
  width: 100% !important;
  height: 100% !important;
}

/* collapsible:false 时仍可能占位，收掉折叠按钮区域 */
.mapControlsPanel__overviewHost :deep(.gyygis-overviewmap--panel button) {
  display: none;
}
</style>
