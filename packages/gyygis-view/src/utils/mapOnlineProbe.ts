import { mapOnlinePolicy, setMapOnlinePolicy, type MapOnlinePolicy } from "@/config/mapBasemap";

let onlineAvailable: boolean | null = null;
let probePromise: Promise<boolean> | null = null;

export function shouldTryOnlineFallback(): boolean {
  if (mapOnlinePolicy === "off") return false;
  if (mapOnlinePolicy === "on") return true;
  if (onlineAvailable === false) return false;
  return true;
}

export async function fetchMapBasemapConfigFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/map-basemap/config", { headers: { Accept: "application/json" } });
    if (!res.ok) return;
    const body = (await res.json()) as { mapOnlinePolicy?: string };
    const p = body.mapOnlinePolicy;
    if (p === "off" || p === "auto" || p === "on") {
      setMapOnlinePolicy(p);
    }
  } catch {
    // 使用 VITE 默认策略
  }
}

export function probeMapOnlineOnce(): Promise<boolean> {
  if (mapOnlinePolicy === "off") {
    onlineAvailable = false;
    return Promise.resolve(false);
  }
  if (mapOnlinePolicy === "on") {
    onlineAvailable = true;
    return Promise.resolve(true);
  }
  if (onlineAvailable !== null) return Promise.resolve(onlineAvailable);
  if (probePromise) return probePromise;

  probePromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch("/api/tianditu/img?x=0&y=0&l=1", {
        method: "GET",
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const ct = res.headers.get("content-type") ?? "";
      onlineAvailable = res.ok && ct.includes("image");
    } catch {
      onlineAvailable = false;
    }
    return onlineAvailable;
  })();

  return probePromise;
}

export function resetMapOnlineProbeForTests(): void {
  onlineAvailable = null;
  probePromise = null;
}

export function getMapOnlineProbeState(): { policy: MapOnlinePolicy; onlineAvailable: boolean | null } {
  return { policy: mapOnlinePolicy, onlineAvailable };
}
