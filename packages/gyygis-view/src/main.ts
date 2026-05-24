import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "dockview-core/dist/styles/dockview.css";
import "@/styles/dockview-theme-gyygis-bigscreen-blue.css";
import App from "./App.vue";
import router from "./router";
import GridPanel from "@/panels/DockviewGridPanel.vue";
import DockviewPanelTab from "@/panels/DockviewPanelTab.vue";
import {
  GYYGIS_GRID_PANEL_COMPONENT,
  GYYGIS_PANEL_TAB_COMPONENT
} from "@/dockviewPanelDefaults";

const app = createApp(App);
app.component(GYYGIS_GRID_PANEL_COMPONENT, GridPanel);
app.component(GYYGIS_PANEL_TAB_COMPONENT, DockviewPanelTab);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.mount("#app");
