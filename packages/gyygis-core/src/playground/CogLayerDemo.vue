<template>
  <div class="wrap">
    <div class="toolbar">
      <label class="item">
        <input type="checkbox" v-model="showSatellite" @change="syncVisible" />
        卫星底图
      </label>
      <label class="item">
        <input type="checkbox" v-model="showCog" @change="syncVisible" />
        Sentinel-2 COG 影像
      </label>
      <button class="btn" type="button" @click="flyToCog">定位到 COG</button>
      <button class="btn" type="button" @click="logCogView">打印 COG view</button>
    </div>

    <div ref="mapEl" class="map"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import "ol/ol.css";
import Map from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import XYZ from "ol/source/XYZ.js";
import { fromLonLat } from "ol/proj.js";
import { easeOut } from "ol/easing.js";

import { createCogLayer } from "../layers/createCogLayer";

const mapEl = ref<HTMLDivElement | null>(null);

const showSatellite = ref(true);
const showCog = ref(true);

const cogCenter = fromLonLat([33.0, -2.0]);

let map: Map | null = null;

const satelliteLayer = new TileLayer({
  source: new XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    crossOrigin: "anonymous",
  }),
  visible: showSatellite.value,
});

const { source: cogSource, layer: cogLayer } = createCogLayer({
  id: "sentinel2-cog",
  title: "Sentinel-2 COG 影像",
  visible: showCog.value,
  opacity: 0.9,
  cog: {
    url: "https://bucket-gistest.oss-cn-shanghai.aliyuncs.com/cropped_middle_cog.tif",
  },
});

onMounted(() => {
  if (!mapEl.value) throw new Error("map element not found");

  map = new Map({
    target: mapEl.value,
    layers: [satelliteLayer, cogLayer],
    view: new View({
      projection: "EPSG:3857",
      center: cogCenter,
      zoom: 10,
    }),
  });
});

onBeforeUnmount(() => {
  map?.setTarget(undefined);
  map = null;
});

function syncVisible() {
  satelliteLayer.setVisible(showSatellite.value);
  cogLayer.setVisible(showCog.value);
}

function flyToCog() {
  if (!map) return;
  map.getView().animate({
    center: cogCenter,
    zoom: 13,
    duration: 1200,
    easing: easeOut,
  });
}

async function logCogView() {
  const view = await cogSource.getView();
  // 重点：如果 CORS 或 Range 不支持，这里通常会报错或一直 pending
  console.log("COG view:", view);
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
</style>

