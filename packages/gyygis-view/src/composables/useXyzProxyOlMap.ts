import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import { nextTick, onBeforeUnmount, ref, type Ref } from "vue";

export type XyzProxyOlMapOptions = {
  /** 经纬度 [lon, lat] */
  center?: readonly [number, number];
  zoom?: number;
  /** 第三方服务 catalogId；为空则不挂载 */
  catalogId?: number | null;
};

/**
 * 在指定 DOM 上创建单层 XYZ 瓦片底图（通过服务端代理 `/api/web-map-services/tiles/:id`）。
 */
export function useXyzProxyOlMap(
  mapEl: Ref<HTMLDivElement | null>,
  getOptions: () => XyzProxyOlMapOptions
) {
  const errorMessage = ref<string | null>(null);
  let mapInstance: Map | null = null;
  let ro: ResizeObserver | null = null;

  function dispose() {
    ro?.disconnect();
    ro = null;
    mapInstance?.setTarget(undefined);
    mapInstance = null;
  }

  async function mount() {
    await nextTick();
    const el = mapEl.value;
    if (!el) return;

    const { center = [116.407526, 39.90403], zoom = 12, catalogId = null } = getOptions();
    if (catalogId == null) return;

    try {
      const layer = new TileLayer({
        source: new XYZ({
          url: `/api/web-map-services/tiles/${encodeURIComponent(String(catalogId))}?x={x}&y={y}&z={z}`
        })
      });

      mapInstance = new Map({
        target: el,
        layers: [layer],
        view: new View({
          center: fromLonLat([center[0], center[1]]),
          zoom
        })
      });

      await nextTick();
      requestAnimationFrame(() => {
        mapInstance?.updateSize();
      });

      ro = new ResizeObserver(() => {
        mapInstance?.updateSize();
      });
      ro.observe(el);
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e);
    }
  }

  onBeforeUnmount(() => {
    dispose();
  });

  return {
    errorMessage,
    mount,
    dispose
  };
}

