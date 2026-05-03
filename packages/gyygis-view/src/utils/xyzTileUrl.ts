export function xyzTemplateNeedsKey(template: string): boolean {
  return template.includes("{tk}") || template.includes("{key}");
}

/**
 * 将 {tk}/{key} 与子域占位替换后，保留 {x}{y}{z} 交给 OpenLayers XYZ 内置替换，
 * 避免手写 tileCoord→y 与 OL 版本不一致（曾导致 y 为负、天地图无影像）。
 */
export function prepareXyzUrlTemplateForOpenLayers(template: string, apiKey: string): string {
  const k = encodeURIComponent(apiKey);
  let u = String(template);
  if (u.includes("{0-7}")) {
    u = u.replaceAll("{0-7}", String(Math.floor(Math.random() * 8)));
  }
  if (u.includes("{s}")) {
    u = u.replaceAll("{s}", String(Math.floor(Math.random() * 8)));
  }
  return u.replaceAll("{key}", k).replaceAll("{tk}", k);
}

export function pickRandomSubDomain(u: string): string {
  if (u.includes("{0-7}")) {
    const n = Math.floor(Math.random() * 8);
    return u.replaceAll("{0-7}", String(n));
  }
  if (u.includes("{s}")) {
    const n = Math.floor(Math.random() * 8);
    return u.replaceAll("{s}", String(n));
  }
  return u;
}

/** 与 gyygis-server applyXyzTemplate 一致；y 为 XYZ 瓦片行号（非 TMS） */
export function buildXyzTileUrl(
  template: string,
  z: number,
  x: number,
  y: number,
  key: string
): string {
  const withSub = pickRandomSubDomain(template);
  const zs = String(z);
  const xs = String(x);
  const ys = String(y);
  return withSub
    .replaceAll("{x}", xs)
    .replaceAll("{y}", ys)
    .replaceAll("{z}", zs)
    .replaceAll("{key}", encodeURIComponent(key))
    .replaceAll("{tk}", encodeURIComponent(key));
}

/** OpenLayers 默认 WebMercator XYZ 的 tileCoord → z/x/y */
export function olTileCoordToXyzZxy(tileCoord: readonly number[]): { z: number; x: number; y: number } {
  const z = tileCoord[0];
  const x = tileCoord[1];
  const y = -tileCoord[2] - 1;
  return { z, x, y };
}
