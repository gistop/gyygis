import { nextTick, onBeforeUnmount, ref, type Ref } from "vue";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
export type TiandituOlMapOptions = {
  tk: string;
  /** 经纬度 [lon, lat] */
  center?: readonly [number, number];
  zoom?: number;
};

/**
 * 在指定 DOM 上创建天地图影像 + 注记图层，并在容器尺寸变化时 updateSize。
 * 调用方需在组件卸载时调用 dispose()（composable 内部也会 onBeforeUnmount 自动 dispose）。
 */
export function useTiandituOlMap(mapEl: Ref<HTMLDivElement | null>, getOptions: () => TiandituOlMapOptions) {
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

    const { tk, center = [116.407526, 39.90403], zoom = 12 } = getOptions();

    try {
      const imgLayer = new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
          crossOrigin: "anonymous"
        })
      });
      const imgLabelLayer = new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${tk}`,
          crossOrigin: "anonymous"
        })
      });

      mapInstance = new Map({
        target: el,
        layers: [imgLayer, imgLabelLayer],
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
