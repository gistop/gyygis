import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import { fromLonLat } from "ol/proj.js";
import { Style, Circle as CircleStyle, Fill, Stroke } from "ol/style.js";

import { asyncBufferFromUrl, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

import type { BaseLayerOptions } from "./types";

export type GpqGeometry = {
  coordinates?: [number, number] | number[];
};

export type GpqRow = {
  geometry?: GpqGeometry | null;
  [k: string]: unknown;
};

export type CreateGpqLayerOptions = BaseLayerOptions & {
  /**
   * GeoParquet 文件 URL（需要 CORS，且一般也依赖 Range 请求）。
   */
  url: string;

  /**
   * 读取的字段。默认会包含 "geometry"（用于生成要素）。
   * 例如：["FEAT_CODE", "HID", "geometry"]
   */
  columns?: string[];

  /**
   * 读取行范围（左闭右开，行为参考 hyparquet 的语义）。
   * 不传则读取全部（大文件建议务必分页/抽样）。
   */
  rowStart?: number;
  rowEnd?: number;

  /**
   * geometry 坐标是否是 (lon, lat)。默认 true。
   * 如果你的数据坐标顺序是 (lat, lon) 可以设为 false 并自行在外部转换。
   */
  lonLatOrder?: true;
};

export type CreateGpqLayerResult<T extends GpqRow = GpqRow> = {
  source: VectorSource<Feature<Point>>;
  layer: VectorLayer<VectorSource<Feature<Point>>>;
  /**
   * 拉取并解析 GPQ，生成 Feature 并写入 source。
   * 返回解析出的原始行对象，便于在 UI 中展示表格/JSON。
   */
  load: () => Promise<T[]>;
};

const defaultPointStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(0, 153, 255, 0.75)" }),
    stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: 1.5 }),
  }),
});

function toLonLat(
  coords: unknown,
): { lon: number; lat: number } | null {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

export function createGpqLayer<T extends GpqRow = GpqRow>(
  options: CreateGpqLayerOptions,
): CreateGpqLayerResult<T> {
  const {
    visible = true,
    opacity = 1,
    columns,
    rowStart,
    rowEnd,
    lonLatOrder = true,
  } = options;

  const source = new VectorSource<Feature<Point>>();

  const layer = new VectorLayer({
    source,
    visible,
    opacity,
    style: defaultPointStyle,
  });

  layer.set("id", options.id);
  if (options.title) layer.set("title", options.title);

  async function load(): Promise<T[]> {
    const file = await asyncBufferFromUrl({ url: options.url });
    const data = (await parquetReadObjects({
      file,
      columns: columns ?? ["geometry"],
      rowStart,
      rowEnd,
      compressors,
    })) as T[];

    const feats: Feature<Point>[] = [];

    for (const row of data) {
      const rawCoords = (row as any)?.geometry?.coordinates;
      const ll = toLonLat(rawCoords);
      if (!ll) continue;

      // 目前只处理 lon/lat 顺序；如果未来要支持 lat/lon，这里可以扩展选项。
      const lon = lonLatOrder ? ll.lon : ll.lat;
      const lat = lonLatOrder ? ll.lat : ll.lon;
      console.log(lon, lat);

      // const f = new Feature({ ...row });
      // f.setGeometry(new Point(fromLonLat([lon, lat])));
      // feats.push(f);
    }

    source.clear(true);
    source.addFeatures(feats);

    return data;
  }

  return { source, layer, load };
}

