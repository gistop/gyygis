<template>
  <div class="wrap">
    <div class="toolbar">
      <label class="item">
        <input type="checkbox" v-model="showImg" @change="syncVisible" />
        影像 (GET /api/tianditu/img)
      </label>
      <label class="item">
        <input type="checkbox" v-model="showLabel" @change="syncVisible" />
        注记 (GET /api/tianditu/label)
      </label>
      <div class="hint">
        需先启动 <code>gyygis-server</code>（含 <code>TIANDITU_KEY</code>）；Vite 将 <code>/api</code> 代理到
        <code>GYYGIS_SERVER_URL</code>（默认 <code>http://localhost:3000</code>）。
      </div>
    </div>

    <div ref="mapEl" class="map"></div>
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

/** 与 gyygis-server 路由一致：query 为 x, y, l（层级） */
const IMG_TILE_URL = "/api/tianditu/img?x={x}&y={y}&l={z}";
const LABEL_TILE_URL = "/api/tianditu/label?x={x}&y={y}&l={z}";

const mapEl = ref<HTMLDivElement | null>(null);
const showImg = ref(true);
const showLabel = ref(true);

const center = fromLonLat([116.397_428, 39.909_23]);

const imgLayer = new TileLayer({
  source: new XYZ({
    url: IMG_TILE_URL,
    maxZoom: 18,
    crossOrigin: "anonymous",
  }),
  visible: showImg.value,
});

const labelLayer = new TileLayer({
  source: new XYZ({
    url: LABEL_TILE_URL,
    maxZoom: 18,
    crossOrigin: "anonymous",
  }),
  visible: showLabel.value,
});

let map: Map | null = null;

onMounted(() => {
  if (!mapEl.value) throw new Error("map element not found");

  map = new Map({
    target: mapEl.value,
    layers: [imgLayer, labelLayer],
    view: new View({
      projection: "EPSG:3857",
      center,
      zoom: 12,
      maxZoom: 18,
    }),
  });
});

onBeforeUnmount(() => {
  map?.setTarget(undefined);
  map = null;
});

function syncVisible() {
  imgLayer.setVisible(showImg.value);
  labelLayer.setVisible(showLabel.value);
}
</script>

<style scoped>
.wrap {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.map {
  width: 100%;
  height: 100%;
}

.toolbar {
  position: absolute;
  left: 36px;
  top: 16px;
  right: 36px;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
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
  font-size: 13px;
}

.hint {
  flex: 1 1 100%;
  font-size: 12px;
  color: #555;
  line-height: 1.45;
}

.hint code {
  font-size: 11px;
  padding: 1px 4px;
  background: #f0f0f0;
  border-radius: 4px;
}
</style>
