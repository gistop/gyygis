import GeoTIFF from "ol/source/GeoTIFF.js";
import WebGLTileLayer from "ol/layer/WebGLTile.js";
import type { BaseLayerOptions } from "./types";

export type CogSourceInput =
  | { url: string }
  | { sources: ConstructorParameters<typeof GeoTIFF>[0]["sources"] };

export type CreateCogLayerOptions = BaseLayerOptions & {
  /**
   * GeoTIFF COG 数据源配置：
   * - 传 `url`：最常见的单文件 COG
   * - 传 `sources`：高级用法（多源/更细配置），透传给 OpenLayers GeoTIFF
   */
  cog: CogSourceInput;
};

export type CreateCogLayerResult = {
  source: GeoTIFF;
  layer: WebGLTileLayer<GeoTIFF>;
};

function normalizeCogSources(
  cog: CogSourceInput,
): ConstructorParameters<typeof GeoTIFF>[0] {
  if ("sources" in cog) return { sources: cog.sources };
  return { sources: [{ url: cog.url }] };
}

/**
 * 创建一个基于 COG（Cloud Optimized GeoTIFF）的 WebGLTile 图层。
 *
 * 说明：
 * - `id` 用于业务侧标识（你可以在外部自行挂到 layer 上做管理）
 * - `visible`/`opacity` 提供合理默认值
 */
export function createCogLayer(options: CreateCogLayerOptions): CreateCogLayerResult {
  const { visible = true, opacity = 1, cog } = options;

  const source = new GeoTIFF(normalizeCogSources(cog));

  const layer = new WebGLTileLayer({
    source,
    opacity,
    visible,
  });

  // OpenLayers Layer 支持 set/get 自定义属性；这里写入 id/title 方便统一管理。
  // 不强耦合到特定 LayerOptions 体系（按需外部也可覆盖）。
  layer.set("id", options.id);
  if (options.title) layer.set("title", options.title);

  return { source, layer };
}

