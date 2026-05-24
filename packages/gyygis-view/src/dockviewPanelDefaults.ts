/** GridPanel 与自定义 Tab 在 Dockview 中注册的组件名 */
export const GYYGIS_GRID_PANEL_COMPONENT = "GridPanel";
export const GYYGIS_PANEL_TAB_COMPONENT = "DockviewPanelTab";

export function emptyGridPanelParams(id: string): { id: string; title: string } {
  return { id, title: "" };
}

/** 新建/初始 Grid 面板的 addPanel 公共字段（含 tabComponent，否则不会挂载自定义 Tab） */
export function baseGridPanelAddOptions(
  id: string,
  extra?: Record<string, unknown>
): {
  id: string;
  component: string;
  tabComponent: string;
  title: string;
  params: { id: string; title: string };
} {
  return {
    id,
    component: GYYGIS_GRID_PANEL_COMPONENT,
    tabComponent: GYYGIS_PANEL_TAB_COMPONENT,
    title: "",
    params: emptyGridPanelParams(id),
    ...extra
  };
}

/** 恢复旧布局 JSON 时补全 tabComponent，使自定义 Tab（含操作按钮）生效 */
export function patchSerializedLayoutTabComponents<T extends { panels?: Record<string, { tabComponent?: string }> }>(
  layout: T
): T {
  if (!layout.panels) return layout;
  const panels = { ...layout.panels };
  let patched = false;
  for (const [id, panel] of Object.entries(panels)) {
    if (!panel?.tabComponent) {
      panels[id] = {
        ...panel,
        tabComponent: GYYGIS_PANEL_TAB_COMPONENT
      };
      patched = true;
    }
  }
  if (!patched) return layout;
  return { ...layout, panels };
}
