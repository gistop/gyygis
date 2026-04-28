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
import { computed, onMounted, ref, watch } from "vue";
import { useTiandituOlMap } from "@/composables/useTiandituOlMap";
import { useXyzProxyOlMap } from "@/composables/useXyzProxyOlMap";
import "ol/ol.css";

const props = withDefaults(
  defineProps<{
    centerLon?: number;
    centerLat?: number;
    zoom?: number;
    /** 当前面板应用的第三方地图服务 catalogId（优先于天地图） */
    mapCatalogId?: number | null;
    /** 面板允许展示的服务列表（暂不用于渲染，仅用于未来扩展） */
    mapCatalogIds?: number[] | null;
  }>(),
  {
    centerLon: 116.407526,
    centerLat: 39.90403,
    zoom: 12,
    mapCatalogId: null,
    mapCatalogIds: null
  }
);

const mapEl = ref<HTMLDivElement | null>(null);

const { errorMessage: tdtError, mount: mountTdt, dispose: disposeTdt } = useTiandituOlMap(
  mapEl,
  () => ({
  center: [props.centerLon, props.centerLat],
  zoom: props.zoom
  })
);

const { errorMessage: xyzError, mount: mountXyz, dispose: disposeXyz } = useXyzProxyOlMap(
  mapEl,
  () => ({
  center: [props.centerLon, props.centerLat],
  zoom: props.zoom,
  catalogId: props.mapCatalogId ?? null
  })
);

const errorMessage = computed(() => xyzError.value ?? tdtError.value);

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}

onMounted(() => {
  if (props.mapCatalogId != null) void mountXyz();
  else void mountTdt();
});

watch(
  () => props.mapCatalogId,
  next => {
    // 切换底图时先释放旧实例，再挂载新实例（DOM 复用）
    disposeXyz();
    disposeTdt();
    if (next != null) void mountXyz();
    else void mountTdt();
  }
);
</script>