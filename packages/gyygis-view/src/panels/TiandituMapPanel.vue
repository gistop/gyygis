<template>
  <div
    class="gridPanel__mapWrap"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <div v-if="errorMessage" class="tdtError">天地图加载失败：{{ errorMessage }}</div>
    <div v-else ref="mapEl" class="tdtMap" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useTiandituOlMap } from "@/composables/useTiandituOlMap";
import "ol/ol.css";

const props = withDefaults(
  defineProps<{
    tk: string;
    centerLon?: number;
    centerLat?: number;
    zoom?: number;
  }>(),
  {
    centerLon: 116.407526,
    centerLat: 39.90403,
    zoom: 12
  }
);

const mapEl = ref<HTMLDivElement | null>(null);

const { errorMessage, mount } = useTiandituOlMap(mapEl, () => ({
  tk: props.tk,
  center: [props.centerLon, props.centerLat],
  zoom: props.zoom
}));

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}

onMounted(() => {
  void mount();
});
</script>