<template>
  <div class="wrap">
    <div class="toolbar">
      <label class="item">
        <input type="checkbox" v-model="showSatellite" @change="syncVisible" />
        卫星底图
      </label>
      <label class="item">
        <input type="checkbox" v-model="showGpq" @change="syncVisible" />
        GeoParquet 点图层
      </label>
      <button class="btn" type="button" :disabled="loading" @click="reload">
        {{ loading ? "加载中..." : "加载 GPQ" }}
      </button>
      <button class="btn" type="button" :disabled="!rows.length" @click="fitToLayer">
        缩放到点
      </button>
    </div>

    <div ref="mapEl" class="map"></div>

    <div class="panel">
      <div class="panel-hd">
        <div>读取结果（前 {{ rows.length }} 条）</div>
        <div class="muted">{{ status }}</div>
      </div>
      <pre class="json">{{ JSON.stringify(rows, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import "ol/ol.css";
import Map from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import XYZ from "ol/source/XYZ.js";
import { fromLonLat } from "ol/proj.js";
import { boundingExtent } from "ol/extent.js";

import { createGpqLayer } from "../layers/createGpqLayer";

const mapEl = ref<HTMLDivElement | null>(null);
const showSatellite = ref(true);
const showGpq = ref(true);

const loading = ref(false);
const status = ref("");
const rows = ref<any[]>([]);

let map: Map | null = null;

const satelliteLayer = new TileLayer({
  source: new XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    crossOrigin: "anonymous",
  }),
  visible: showSatellite.value,
});

const { layer: gpqLayer, source: gpqSource, load } = createGpqLayer({
  id: "gpq-points",
  title: "GeoParquet 点图层",
  visible: showGpq.value,
  opacity: 1,
  url: "https://bucket-gistest.oss-cn-shanghai.aliyuncs.com/pointgeo.parquet",
  columns: ["FEAT_CODE", "HID", "geometry"],
  rowStart: 10,
  rowEnd: 20,
});

onMounted(() => {
  if (!mapEl.value) throw new Error("map element not found");

  map = new Map({
    target: mapEl.value,
    layers: [satelliteLayer, gpqLayer],
    view: new View({
      projection: "EPSG:3857",
      center: fromLonLat([120, 30]),
      zoom: 3,
    }),
  });
});

onBeforeUnmount(() => {
  map?.setTarget(undefined);
  map = null;
});

function syncVisible() {
  satelliteLayer.setVisible(showSatellite.value);
  gpqLayer.setVisible(showGpq.value);
}

async function reload() {
  loading.value = true;
  status.value = "开始读取 GeoParquet...";
  try {
    const data = await load();
    rows.value = data;
    status.value = `读取成功：${data.length} 行；生成点要素：${gpqSource.getFeatures().length} 个`;
  } catch (e: any) {
    status.value = `读取失败：${String(e?.message ?? e)}`;
    // eslint-disable-next-line no-console
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function fitToLayer() {
  if (!map) return;
  const feats = gpqSource.getFeatures();
  if (!feats.length) return;

  const coords = feats
    .map((f) => (f.getGeometry() as any)?.getCoordinates?.())
    .filter(Boolean);
  if (!coords.length) return;

  const extent = boundingExtent(coords as any);
  map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 16 });
}
</script>

<style scoped>
.wrap {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.map {
  width: 100%;
  height: 100%;
}

.toolbar {
  position: absolute;
  left: 36px;
  top: 16px;
  z-index: 10;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 8px;
  backdrop-filter: blur(6px);
}

.item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.btn {
  padding: 6px 10px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.panel {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 10;
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.panel-hd {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.muted {
  color: #666;
}

.json {
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.4;
  background: transparent;
}
</style>

