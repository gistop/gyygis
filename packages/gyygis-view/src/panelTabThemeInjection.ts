import type { InjectionKey, Ref } from "vue";
import type { DockviewTheme } from "dockview-core";

export const DOCKVIEW_ACTIVE_THEME_KEY: InjectionKey<Ref<DockviewTheme>> = Symbol(
  "gyygis.dockviewActiveTheme"
);

export { GYYGIS_PANEL_TAB_COMPONENT } from "@/dockviewPanelDefaults";
