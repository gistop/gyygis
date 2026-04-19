import type { InjectionKey } from "vue";
import type { DockviewPanelApi } from "dockview-core";

/**
 * 由右下角热区触发。
 * `getBusinessParams` 须从 Vue 侧读取当前业务 params：Dockview 的 `panelApi.getParameters()`
 * 在首次 update 前常为 `{}`，不能单独作为合并基准。
 */
export type OpenPanelEditFn = (
  panelRootEl: HTMLElement,
  panelId: string,
  title: string,
  panelApi: DockviewPanelApi,
  getBusinessParams: () => Record<string, unknown>
) => void;

export const PANEL_EDIT_INJECTION_KEY: InjectionKey<OpenPanelEditFn> =
  Symbol("gyygis.panelEditDrawer");
