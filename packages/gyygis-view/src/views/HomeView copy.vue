<template>
  <main
    ref="homeRoot"
    class="home-dockview"
    :class="dockTheme.className"
    :style="layoutCssVars"
  >
    <header class="theme-toolbar">
      <span class="theme-toolbar-label">Dockview 主题</span>
      <div class="theme-toolbar-buttons">
        <button
          v-for="p in THEME_PRESETS"
          :key="p.theme.name"
          type="button"
          class="theme-preset-btn"
          :class="{ 'theme-preset-btn--active': dockTheme.name === p.theme.name }"
          @click="setDockTheme(p.theme)"
        >
          {{ p.label }}
        </button>
      </div>
    </header>

    <details class="layout-sliders" open>
      <summary class="layout-sliders-summary">间距与尺寸（拖动滑块实时调整）</summary>
      <div class="layout-sliders-grid">
        <label class="slider-row">
          <span class="slider-label">组间距 gap</span>
          <input
            v-model.number="groupGapPx"
            type="range"
            min="0"
            max="24"
            step="1"
          />
          <span class="slider-value">{{ groupGapPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">标签栏高度</span>
          <input
            v-model.number="tabBarHeightPx"
            type="range"
            min="26"
            max="48"
            step="1"
          />
          <span class="slider-value">{{ tabBarHeightPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">标签间距 margin</span>
          <input
            v-model.number="tabSpacingPx"
            type="range"
            min="0"
            max="12"
            step="1"
          />
          <span class="slider-value">{{ tabSpacingPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">面板内容 padding</span>
          <input
            v-model.number="panelPaddingPx"
            type="range"
            min="4"
            max="32"
            step="1"
          />
          <span class="slider-value">{{ panelPaddingPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">圆角 border-radius</span>
          <input
            v-model.number="borderRadiusPx"
            type="range"
            min="0"
            max="16"
            step="1"
          />
          <span class="slider-value">{{ borderRadiusPx }}px</span>
        </label>
      </div>
    </details>

    <div class="dockview-wrap">
      <DockviewVue :theme="runtimeDockTheme" class="dockview-fill" @ready="onReady" />
    </div>
  </main>
</template>

<script lang="ts">
import { defineComponent, h } from "vue";
import { DockviewVue } from "dockview-vue";

const MyPanel = defineComponent({
  name: "myComponent",
  props: {
    params: { type: Object, required: true }
  },
  setup() {
    return () =>
      h("div", { class: "dockview-panel-placeholder" }, [
        h("p", { class: "dockview-panel-hint" }, "Hello World"),
        h(
          "p",
          { class: "dockview-panel-tip" },
          "顶部可切换主题；展开「间距与尺寸」用滑块调整 gap / 标签栏 / 内边距等。"
        )
      ]);
  }
});

export default {
  components: {
    myComponent: MyPanel,
    DockviewVue
  }
};
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import {
  themeAbyss,
  themeAbyssSpaced,
  themeDark,
  themeDracula,
  themeLight,
  themeLightSpaced,
  themeReplit,
  themeVisualStudio,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme
} from "dockview-core";
import {
  applyDockviewThemeToDomSubtree,
  syncDockThemeShell
} from "@/dockviewThemeDom";

const THEME_PRESETS: { label: string; theme: DockviewTheme }[] = [
  { label: "浅色", theme: themeLight },
  { label: "深色", theme: themeDark },
  { label: "Visual Studio", theme: themeVisualStudio },
  { label: "Abyss", theme: themeAbyss },
  { label: "Dracula", theme: themeDracula },
  { label: "Replit", theme: themeReplit },
  { label: "浅色·间距", theme: themeLightSpaced },
  { label: "Abyss·间距", theme: themeAbyssSpaced }
];

const dockTheme = ref<DockviewTheme>(themeLight);
const dockviewApi = ref<DockviewApi | null>(null);
const homeRoot = useTemplateRef<HTMLElement>("homeRoot");

const groupGapPx = ref(6);
const tabBarHeightPx = ref(35);
const tabSpacingPx = ref(0);
const panelPaddingPx = ref(8);
const borderRadiusPx = ref(0);

const layoutCssVars = computed(() => ({
  "--dv-tabs-and-actions-container-height": `${tabBarHeightPx.value}px`,
  "--dv-tab-margin": `${tabSpacingPx.value}px`,
  "--gyygis-panel-padding": `${panelPaddingPx.value}px`,
  "--dv-border-radius": `${borderRadiusPx.value}px`
}));

/** 在预设主题上叠加 gap（与 dockview-core 中 theme.gap → 组 margin 一致） */
const runtimeDockTheme = computed<DockviewTheme>(() => ({
  name: dockTheme.value.name,
  className: dockTheme.value.className,
  gap: groupGapPx.value,
  dndOverlayMounting: dockTheme.value.dndOverlayMounting,
  dndPanelOverlay: dockTheme.value.dndPanelOverlay
}));

function setDockTheme(t: DockviewTheme) {
  dockTheme.value = t;
}

function applyShellOnly(t: DockviewTheme) {
  syncDockThemeShell(t);
}

async function applyDockviewChromeTheme(theme: DockviewTheme) {
  dockviewApi.value?.updateOptions({ theme });
  await nextTick();
  applyDockviewThemeToDomSubtree(homeRoot.value ?? null, dockTheme.value);
  const api = dockviewApi.value;
  if (api) {
    api.layout(api.width, api.height);
  }
}

async function applyThemeAndLayout() {
  applyShellOnly(dockTheme.value);
  await applyDockviewChromeTheme(runtimeDockTheme.value);
}

onMounted(() => {
  void applyThemeAndLayout();
});

watch(
  [dockTheme, groupGapPx, tabBarHeightPx, tabSpacingPx, panelPaddingPx, borderRadiusPx],
  () => {
    void applyThemeAndLayout();
  },
  { flush: "post" }
);

onBeforeUnmount(() => {
  dockviewApi.value = null;
  for (const el of [document.body, document.getElementById("app")].filter(
    Boolean
  ) as HTMLElement[]) {
    for (const c of [...el.classList]) {
      if (c.startsWith("dockview-theme-")) {
        el.classList.remove(c);
      }
    }
  }
});

function onReady(event: DockviewReadyEvent) {
  const { api } = event;
  dockviewApi.value = api;

  api.addPanel({
    id: "panel_1",
    component: "myComponent",
    title: "Panel 1"
  });

  api.addPanel({
    id: "panel_2",
    component: "myComponent",
    title: "Panel 2",
    position: { referencePanel: "panel_1", direction: "right" },
    inactive: true
  });

  api.addPanel({
    id: "panel_3",
    component: "myComponent",
    title: "Floating",
    floating: {
      width: 420,
      height: 280,
      position: { bottom: 24, left: 24 }
    }
  });

  void applyThemeAndLayout();
}
</script>

<style scoped>
.home-dockview {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 400px;
  box-sizing: border-box;
}

.theme-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.25);
  background: var(--dv-tabs-and-actions-container-background-color, #f3f3f3);
  color: var(--dv-activegroup-visiblepanel-tab-color, #333);
}

.theme-toolbar-label {
  font-size: 13px;
  font-weight: 600;
  margin-right: 4px;
}

.theme-toolbar-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.theme-preset-btn {
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--dv-separator-border, #ccc);
  background: var(--dv-group-view-background-color, #fff);
  color: var(--dv-activegroup-visiblepanel-tab-color, #333);
}

.theme-preset-btn:hover {
  filter: brightness(1.06);
}

.theme-preset-btn--active {
  outline: 2px solid dodgerblue;
  outline-offset: 1px;
}

.layout-sliders {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  background: var(--dv-tabs-and-actions-container-background-color, #f6f6f6);
  color: var(--dv-activegroup-visiblepanel-tab-color, #222);
}

.layout-sliders-summary {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  user-select: none;
}

.layout-sliders-summary:hover {
  filter: brightness(0.98);
}

.layout-sliders-grid {
  display: grid;
  gap: 10px 16px;
  padding: 0 12px 12px;
  max-width: 720px;
}

.slider-row {
  display: grid;
  grid-template-columns: 1fr minmax(120px, 2fr) 52px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.slider-label {
  white-space: nowrap;
}

.slider-row input[type="range"] {
  width: 100%;
  min-width: 0;
}

.slider-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
}

.dockview-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dockview-fill {
  flex: 1;
  min-height: 0;
}
</style>

<style>
.home-dockview .dockview-panel-placeholder {
  box-sizing: border-box;
  min-height: 48px;
  padding: var(--gyygis-panel-padding, 8px);
  border-radius: 6px;
  color: var(--dv-activegroup-visiblepanel-tab-color, inherit);
  background: var(--dv-group-view-background-color, transparent);
  border: 1px solid var(--dv-separator-border, transparent);
}

.home-dockview .dockview-panel-hint {
  margin: 0 0 6px;
}

.home-dockview .dockview-panel-tip {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
  color: var(--dv-inactivegroup-visiblepanel-tab-color, inherit);
}
</style>
