import type OlMap from "ol/Map";

const panelIdToMap = new Map<string, OlMap>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.warn("[mapPanelRegistry] listener error", e);
    }
  }
}

/** 订阅注册表变化（地图挂载/卸载时触发） */
export function subscribeOlMapPanelRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function registerOlMapForPanel(panelId: string, map: OlMap): void {
  if (!panelId) return;
  panelIdToMap.set(panelId, map);
  emit();
}

export function unregisterOlMapForPanel(panelId: string): void {
  if (!panelId) return;
  if (panelIdToMap.has(panelId)) {
    panelIdToMap.delete(panelId);
    emit();
  }
}

export function getOlMapForPanel(panelId: string): OlMap | undefined {
  if (!panelId) return undefined;
  return panelIdToMap.get(panelId);
}
