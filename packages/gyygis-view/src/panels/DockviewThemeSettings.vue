<template>
  <div class="dockviewThemeSettings">
    <header class="theme-toolbar">
      <span class="theme-toolbar-label">Dockview 主题</span>
      <div class="theme-toolbar-buttons">
        <button
          v-for="p in presets"
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

    <div class="titlebar-switch-row">
      <span class="titlebar-switch-label">显示标题栏</span>
      <el-switch
        v-model="showPanelTitleBar"
        inline-prompt
        active-text="开"
        inactive-text="关"
      />
    </div>

    <details class="layout-sliders" open>
      <summary class="layout-sliders-summary">间距与尺寸（拖动滑块实时调整）</summary>
      <div class="layout-sliders-grid">
        <label class="slider-row">
          <span class="slider-label">组间距 gap</span>
          <input v-model.number="groupGapPx" type="range" min="0" max="24" step="1" />
          <span class="slider-value">{{ groupGapPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">标签栏高度</span>
          <input v-model.number="tabBarHeightPx" type="range" min="26" max="48" step="1" />
          <span class="slider-value">{{ tabBarHeightPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">标签间距 margin</span>
          <input v-model.number="tabSpacingPx" type="range" min="0" max="12" step="1" />
          <span class="slider-value">{{ tabSpacingPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">面板内容 padding</span>
          <input v-model.number="panelPaddingPx" type="range" min="4" max="32" step="1" />
          <span class="slider-value">{{ panelPaddingPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">内容区圆角（地图/表格/图表）</span>
          <input v-model.number="borderRadiusPx" type="range" min="0" max="16" step="1" />
          <span class="slider-value">{{ borderRadiusPx }}px</span>
        </label>
        <label class="slider-row">
          <span class="slider-label">边框/分隔线透明度</span>
          <input
            v-model.number="frameBorderOpacityPercent"
            type="range"
            min="0"
            max="100"
            step="1"
          />
          <span class="slider-value">{{ frameBorderOpacityPercent }}%</span>
        </label>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { DockviewTheme } from "dockview-core";

defineProps<{
  presets: { label: string; theme: DockviewTheme }[];
  dockTheme: DockviewTheme;
  setDockTheme: (t: DockviewTheme) => void;
}>();

const showPanelTitleBar = defineModel<boolean>("showPanelTitleBar", { required: true });

const groupGapPx = defineModel<number>("groupGapPx", { required: true });
const tabBarHeightPx = defineModel<number>("tabBarHeightPx", { required: true });
const tabSpacingPx = defineModel<number>("tabSpacingPx", { required: true });
const panelPaddingPx = defineModel<number>("panelPaddingPx", { required: true });
const borderRadiusPx = defineModel<number>("borderRadiusPx", { required: true });
const frameBorderOpacityPercent = defineModel<number>("frameBorderOpacityPercent", {
  required: true
});
</script>

<style scoped>
.dockviewThemeSettings {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.theme-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 0 0 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.25);
}

.theme-toolbar-label {
  font-size: 13px;
  font-weight: 600;
  margin-right: 4px;
  width: 100%;
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
  border: 1px solid var(--el-border-color, #ccc);
  background: var(--el-bg-color, #fff);
  color: var(--el-text-color-primary, #333);
}

.theme-preset-btn:hover {
  filter: brightness(1.06);
}

.theme-preset-btn--active {
  outline: 2px solid dodgerblue;
  outline-offset: 1px;
}

.titlebar-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.25);
}

.titlebar-switch-label {
  font-size: 13px;
  font-weight: 600;
}

.layout-sliders {
  flex-shrink: 0;
  margin-top: 12px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  background: var(--el-fill-color-light, #f6f6f6);
  color: var(--el-text-color-primary, #222);
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
}

.slider-row {
  display: grid;
  grid-template-columns: 1fr minmax(100px, 2fr) 48px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.slider-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>
