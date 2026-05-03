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
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import type ImageTile from "ol/ImageTile";
import XYZ from "ol/source/XYZ";
import TileWMS from "ol/source/TileWMS";
import { fromLonLat } from "ol/proj";
import { useTiandituOlMap } from "@/composables/useTiandituOlMap";
import { fetchBrowserTileConfig, fetchWebMapServices, type WebMapServiceRow } from "@/api/webMapServices";
import { getUserIdFromAccessTokenJwt } from "@/utils/authorizedToken";
import { prepareXyzUrlTemplateForOpenLayers } from "@/utils/xyzTileUrl";
import "ol/ol.css";

type PanelMapLayer =
  | {
      kind: "xyz";
      catalogId: number;
      enabled: boolean;
      opacity: number; // 0..1
      title?: string;
    }
  | {
      kind: "wms";
      layerName: string;
      enabled: boolean;
      opacity: number; // 0..1
      title?: string;
    };

const props = withDefaults(
  defineProps<{
    centerLon?: number;
    centerLat?: number;
    zoom?: number;
    /** 新版：叠加图层列表（排序即叠加顺序） */
    mapLayers?: unknown[] | null;
    /** 当前面板应用的第三方地图服务 catalogId（优先于天地图） */
    mapCatalogId?: number | null;
    /** 面板允许展示的服务列表（暂不用于渲染，仅用于未来扩展） */
    mapCatalogIds?: number[] | null;
  }>(),
  {
    centerLon: 116.407526,
    centerLat: 39.90403,
    zoom: 12,
    mapLayers: null,
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

const customError = ref<string | null>(null);
let mapInstance: Map | null = null;
let ro: ResizeObserver | null = null;

function disposeCustom() {
  ro?.disconnect();
  ro = null;
  mapInstance?.setTarget(undefined);
  mapInstance = null;
  customError.value = null;
}

function coerceOpacity01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function parseMapLayers(): PanelMapLayer[] {
  const raw = props.mapLayers;
  const list: PanelMapLayer[] = [];
  if (Array.isArray(raw)) {
    for (const it of raw) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const kind = String(o.kind ?? "");
      const enabled = o.enabled !== false;
      const opacity = coerceOpacity01(o.opacity);
      const title = typeof o.title === "string" ? o.title : undefined;
      if (kind === "xyz") {
        const cid = Number(o.catalogId);
        if (Number.isFinite(cid) && cid > 0) {
          list.push({ kind: "xyz", catalogId: cid, enabled, opacity, title });
        }
      }
      if (kind === "wms") {
        const layerName = typeof o.layerName === "string" ? o.layerName.trim() : "";
        if (layerName) {
          list.push({ kind: "wms", layerName, enabled, opacity, title });
        }
      }
    }
  }

  // 旧参数兼容：只有 mapCatalogId / mapCatalogIds
  if (list.length === 0) {
    const ids = Array.isArray(props.mapCatalogIds) ? props.mapCatalogIds : [];
    const one = typeof props.mapCatalogId === "number" ? props.mapCatalogId : null;
    const uniq: number[] = [];
    for (const n of ids) {
      if (!Number.isFinite(n) || n <= 0) continue;
      if (!uniq.includes(n)) uniq.push(n);
    }
    if (one != null && Number.isFinite(one) && one > 0 && !uniq.includes(one)) {
      uniq.unshift(one);
    }
    for (const cid of uniq) {
      list.push({ kind: "xyz", catalogId: cid, enabled: true, opacity: 1 });
    }
  }
  return list;
}

async function mountCustom() {
  const el = mapEl.value;
  if (!el) return;

  const layersSpec = parseMapLayers().filter(x => x.enabled);
  if (layersSpec.length === 0) return;

  const userId = getUserIdFromAccessTokenJwt();
  const workspace = userId != null ? `u_${userId}` : null;

  try {
    const layers: Array<TileLayer<XYZ | TileWMS>> = [];

    let svcById = new Map<number, WebMapServiceRow>();
    try {
      const list = await fetchWebMapServices();
      for (const row of list) {
        svcById.set(row.catalogId, {
          ...row,
          tileKeyMode: row.tileKeyMode === "browser" ? "browser" : "proxy"
        });
      }
    } catch {
      svcById = new Map();
    }

    for (const s of layersSpec) {
      if (s.kind === "xyz") {
        const row = svcById.get(s.catalogId);
        const mode = row?.tileKeyMode ?? "proxy";
        if (mode === "browser") {
          const { serviceUrl, apiKey } = await fetchBrowserTileConfig(s.catalogId);
          const urlTemplate = prepareXyzUrlTemplateForOpenLayers(serviceUrl, apiKey);
          const layer = new TileLayer({
            opacity: s.opacity,
            source: new XYZ({
              url: urlTemplate,
              crossOrigin: "anonymous",
              tileLoadFunction: (tile: ImageTile, src: string) => {
                console.log("[tianditu browser xyz]", src);
                const image = tile.getImage() as HTMLImageElement;
                if (image) {
                  image.crossOrigin = "anonymous";
                  image.src = src;
                }
              }
            })
          });
          layers.push(layer);
        } else {
          const layer = new TileLayer({
            opacity: s.opacity,
            source: new XYZ({
              url: `/api/web-map-services/tiles/${encodeURIComponent(String(s.catalogId))}?x={x}&y={y}&z={z}`
            })
          });
          layers.push(layer);
        }
        continue;
      }

      // wms
      if (!workspace) {
        throw new Error("未登录或无法识别用户ID，无法加载用户发布的 WMS 图层");
      }
      const layerFullName = `${workspace}:${s.layerName}`;
      // 用 tile wms 便于缓存与缩放；若后续遇到问题可换成 ImageWMS
      const layer = new TileLayer({
        opacity: s.opacity,
        source: new TileWMS({
          url: "/geoserver/ows",
          params: {
            SERVICE: "WMS",
            VERSION: "1.1.1",
            REQUEST: "GetMap",
            LAYERS: layerFullName,
            STYLES: "",
            FORMAT: "image/png",
            TRANSPARENT: true
          }
        })
      });
      layers.push(layer);
    }

    mapInstance = new Map({
      target: el,
      layers,
      view: new View({
        center: fromLonLat([props.centerLon, props.centerLat]),
        zoom: props.zoom
      })
    });

    requestAnimationFrame(() => mapInstance?.updateSize());
    ro = new ResizeObserver(() => mapInstance?.updateSize());
    ro.observe(el);
  } catch (e) {
    customError.value = e instanceof Error ? e.message : String(e);
  }
}

const errorMessage = computed(() => customError.value ?? tdtError.value);

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}

onMounted(() => {
  const anyNew = Array.isArray(props.mapLayers) && props.mapLayers.length > 0;
  if (anyNew) void mountCustom();
  else if (props.mapCatalogId != null) void mountCustom();
  else void mountTdt();
});

watch(
  () => [props.mapLayers, props.mapCatalogId, props.mapCatalogIds, props.centerLon, props.centerLat, props.zoom] as const,
  () => {
    // 参数变化：释放旧实例，再挂载新实例（DOM 复用）
    disposeCustom();
    disposeTdt();
    const anyNew = Array.isArray(props.mapLayers) && props.mapLayers.length > 0;
    if (anyNew) void mountCustom();
    else if (props.mapCatalogId != null || (Array.isArray(props.mapCatalogIds) && props.mapCatalogIds.length > 0)) {
      void mountCustom();
    } else {
      void mountTdt();
    }
  },
  { deep: true }
);
</script>