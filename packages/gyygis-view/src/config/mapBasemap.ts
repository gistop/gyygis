export type MapOnlinePolicy = "off" | "auto" | "on";

function parsePolicy(raw: string | undefined): MapOnlinePolicy {
  const v = (raw ?? "auto").trim().toLowerCase();
  if (v === "off" || v === "on") return v;
  return "auto";
}

/** 离线缺失时是否尝试在线底图（可被 fetchMapBasemapConfigFromServer 覆盖） */
export let mapOnlinePolicy: MapOnlinePolicy = parsePolicy(import.meta.env.VITE_MAP_ONLINE_POLICY);

export function setMapOnlinePolicy(policy: MapOnlinePolicy): void {
  mapOnlinePolicy = policy;
}

export function buildOfflineTileUrl(z: number, x: number, y: number): string {
  return `/api/offline-tiles/${z}/${x}/${y}.png`;
}
