<template>
  <main ref="homeRoot" class="homeDockview" :class="dockThemeClassName" :style="layoutCssVars">
    <DockviewVue :theme="runtimeDockTheme" class="dockviewFill" @ready="onReady" />
    <div
      class="cornerHotspot"
      aria-label="corner-hotspot"
      role="button"
      tabindex="0"
      @click.stop="onCornerClick"
      @pointerdown.stop.prevent="onCornerPointerDown"
      @pointerup.stop="onCornerPointerUp"
      @pointercancel.stop="onCornerPointerCancel"
      @pointerleave.stop="onCornerPointerCancel"
      @contextmenu.prevent
    />
    <el-drawer
      v-model="cornerDrawerVisible"
      title="设置"
      direction="rtl"
      size="440px"
      append-to-body
      :modal="false"
      :lock-scroll="false"
      modal-penetrable
    >
      <p v-if="cornerDrawerMessage" class="cornerDrawerBody">{{ cornerDrawerMessage }}</p>
      <DockviewThemeSettings
        v-model:show-panel-title-bar="showPanelTitleBar"
        v-model:group-gap-px="groupGapPx"
        v-model:tab-bar-height-px="tabBarHeightPx"
        v-model:tab-spacing-px="tabSpacingPx"
        v-model:panel-padding-px="panelPaddingPx"
        v-model:border-radius-px="borderRadiusPx"
        v-model:frame-border-opacity-percent="frameBorderOpacityPercent"
        :presets="THEME_PRESETS"
        :dock-theme="dockTheme"
        :set-dock-theme="setDockTheme"
      />
    </el-drawer>
    <el-drawer
      v-model="panelEditDrawerVisible"
      :title="panelEditDrawerTitle"
      :direction="panelEditDrawerDirection"
      size="420px"
      append-to-body
      :modal="false"
      :lock-scroll="false"
      modal-penetrable
    >
      <p class="cornerDrawerBody">
        当前面板：<code>{{ panelEditPanelId }}</code>
      </p>
      <p class="muted panelEditHint">
        抽屉方向仍按面板在视口中的水平位置自动选择；下方修改后点击「应用到面板」写回 Dockview
        参数（与布局是否为 3×3 无关）。
      </p>
      <div class="panelEditForm">
        <div class="panelEditForm__label">显示内容</div>
        <el-radio-group v-model="editPanelMode" class="panelEditRadios">
          <el-radio-button value="map">地图</el-radio-button>
          <el-radio-button value="chart">统计图</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
          <el-radio-button value="image">图片</el-radio-button>
          <el-radio-button value="auto">占位（自动）</el-radio-button>
        </el-radio-group>
        <template v-if="editPanelMode === 'chart'">
          <div class="panelEditForm__label">图表类型</div>
          <el-select v-model="editChartKind" style="width: 100%">
            <el-option label="柱状图" value="bar" />
            <el-option label="饼图" value="pie" />
            <el-option label="折线图" value="line" />
          </el-select>
        </template>
        <template v-if="editPanelMode === 'image'">
          <div class="panelEditForm__label">图片地址（https）</div>
          <el-input v-model="editImageUrl" type="textarea" :rows="2" placeholder="留空则使用默认演示图" />
          <p class="muted panelEditHint">留空保存时使用内置占位图 URL。</p>
        </template>
        <div class="panelEditActions">
          <el-button
            type="primary"
            :disabled="!panelEditApi || !panelEditGetBusinessParams"
            @click="applyPanelContentFromDrawer"
          >
            应用到面板
          </el-button>
        </div>
      </div>
    </el-drawer>
  </main>
</template>

<script lang="ts">
import { DockviewVue } from "dockview-vue";
import GridPanel from "@/panels/DockviewGridPanel.vue";

export default {
  components: {
    DockviewVue,
    GridPanel
  }
};
</script>

<script setup lang="ts">
import {
  onBeforeUnmount as onBeforeUnmountSetup,
  provide,
  ref as refSetup,
  type Ref
} from "vue";
import type {
  DockviewApi,
  DockviewPanelApi,
  DockviewReadyEvent
} from "dockview-core";
import { useDockviewThemeSettings } from "@/composables/useDockviewThemeSettings";
import DockviewThemeSettings from "@/panels/DockviewThemeSettings.vue";
import { PANEL_EDIT_INJECTION_KEY } from "@/panelEditInjection";
import type { DockviewChartKind } from "@/charts/types";
import { isDockviewChartKind } from "@/charts/types";
import {
  getEffectivePanelContent,
  mergePanelContentParams,
  type PanelContentRadio
} from "@/panelContentMode";

const dockviewApi: Ref<DockviewApi | null> = refSetup(null);
const homeRoot = refSetup<HTMLElement | null>(null);

const {
  THEME_PRESETS,
  dockTheme,
  dockThemeClassName,
  layoutCssVars,
  runtimeDockTheme,
  groupGapPx,
  tabBarHeightPx,
  tabSpacingPx,
  panelPaddingPx,
  borderRadiusPx,
  frameBorderOpacityPercent,
  showPanelTitleBar,
  setDockTheme
} = useDockviewThemeSettings(dockviewApi, homeRoot);

const CORNER_MULTI_TAP_WINDOW_MS = 2000;
const CORNER_MULTI_TAP_COUNT = 5;
const CORNER_LONG_PRESS_MS = 1500;

const cornerTapTs = refSetup<number[]>([]);
const cornerLongPressTimer = refSetup<number | null>(null);
const cornerLongPressFired = refSetup(false);
const cornerDrawerVisible = refSetup(false);
const cornerDrawerMessage = refSetup("");

const panelEditDrawerVisible = refSetup(false);
const panelEditDrawerTitle = refSetup("");
const panelEditPanelId = refSetup("");
const panelEditDrawerDirection = refSetup<"ltr" | "rtl">("rtl");
const panelEditApi = refSetup<DockviewPanelApi | null>(null);
const panelEditGetBusinessParams = refSetup<(() => Record<string, unknown>) | null>(null);

const editPanelMode = refSetup<PanelContentRadio>("auto");
const editChartKind = refSetup<DockviewChartKind>("bar");
const editImageUrl = refSetup("");

function syncPanelEditFormFromApi(getBusinessParams: () => Record<string, unknown>, panelId: string) {
  const p = getBusinessParams();
  const pc = p.panelContent;
  if (pc === "map" || pc === "chart" || pc === "table" || pc === "image") {
    editPanelMode.value = pc;
  } else {
    const eff = getEffectivePanelContent(p, panelId);
    editPanelMode.value = eff === "none" ? "auto" : (eff as PanelContentRadio);
  }
  const rawCk = p.chartKind;
  editChartKind.value = isDockviewChartKind(String(rawCk ?? ""))
    ? (rawCk as DockviewChartKind)
    : "bar";
  editImageUrl.value = typeof p.imageUrl === "string" ? p.imageUrl : "";
}

function applyPanelContentFromDrawer() {
  const api = panelEditApi.value;
  const getP = panelEditGetBusinessParams.value;
  if (!api || !getP) return;
  const base = { ...getP() };
  const next = mergePanelContentParams(base, editPanelMode.value, {
    chartKind: editChartKind.value,
    imageUrl: editImageUrl.value
  });
  api.updateParameters(next);
}

function openPanelEditDrawer(
  panelRootEl: HTMLElement,
  panelId: string,
  title: string,
  panelApi: DockviewPanelApi,
  getBusinessParams: () => Record<string, unknown>
) {
  const rect = panelRootEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  panelEditDrawerDirection.value = cx < window.innerWidth / 2 ? "rtl" : "ltr";
  panelEditPanelId.value = panelId;
  panelEditDrawerTitle.value = title ? `编辑：${title}` : "编辑面板";
  panelEditApi.value = panelApi;
  panelEditGetBusinessParams.value = getBusinessParams;
  syncPanelEditFormFromApi(getBusinessParams, panelId);
  panelEditDrawerVisible.value = true;
}

provide(PANEL_EDIT_INJECTION_KEY, openPanelEditDrawer);

function triggerCornerAlert(reason: "multi-tap" | "long-press") {
  cornerTapTs.value = [];
  if (cornerLongPressTimer.value != null) {
    window.clearTimeout(cornerLongPressTimer.value);
    cornerLongPressTimer.value = null;
  }
  cornerLongPressFired.value = true;
  cornerDrawerMessage.value =
    reason === "multi-tap" ? "已触发：2秒内连点5次" : "已触发：长按1.5秒";
  cornerDrawerVisible.value = true;

  // 避免长按触发后紧跟着的 click 再触发一次
  window.setTimeout(() => {
    cornerLongPressFired.value = false;
  }, 0);
}

function onCornerClick() {
  if (cornerLongPressFired.value) return;

  const now = Date.now();
  const keepAfter = now - CORNER_MULTI_TAP_WINDOW_MS;
  cornerTapTs.value = cornerTapTs.value.filter((t: number) => t >= keepAfter);
  cornerTapTs.value.push(now);

  if (cornerTapTs.value.length >= CORNER_MULTI_TAP_COUNT) {
    triggerCornerAlert("multi-tap");
  }
}

function clearCornerLongPressTimer() {
  if (cornerLongPressTimer.value != null) {
    window.clearTimeout(cornerLongPressTimer.value);
    cornerLongPressTimer.value = null;
  }
}

function onCornerPointerDown() {
  cornerLongPressFired.value = false;
  clearCornerLongPressTimer();
  cornerLongPressTimer.value = window.setTimeout(() => {
    triggerCornerAlert("long-press");
  }, CORNER_LONG_PRESS_MS);
}

function onCornerPointerUp() {
  clearCornerLongPressTimer();
}

function onCornerPointerCancel() {
  clearCornerLongPressTimer();
}

function onReady(event: DockviewReadyEvent) {
  const { api } = event;
  dockviewApi.value = api;

  // 用 addPanel + position(referencePanel, direction) 构造 3 行 × 3 列（共 9 个 Panel）。
  // 关键点：每一列单独向下 split 出三行，避免出现“只在左侧列分割、右侧没跟着分割”的情况。
  // “中间更大”：通过给中行/中列的 split 提供更大的 size 提示（不同版本可能忽略该字段）。
  const p11 = "r1c1";
  const p12 = "r1c2";
  const p13 = "r1c3";
  const p21 = "r2c1";
  const p22 = "r2c2";
  const p23 = "r2c3";
  const p31 = "r3c1";
  const p32 = "r3c2";
  const p33 = "r3c3";

  // 第 1 行：先生成 3 列
  api.addPanel({ id: p11, component: "GridPanel", title: "1-1", params: { id: p11, title: "1-1" } });
  api.addPanel({
    id: p12,
    component: "GridPanel",
    title: "1-2（中列）",
    params: { id: p12, title: "1-2（中列）" },
    position: { referencePanel: p11, direction: "right", size: 520 } as any
  });
  api.addPanel({
    id: p13,
    component: "GridPanel",
    title: "1-3",
    params: { id: p13, title: "1-3" },
    position: { referencePanel: p12, direction: "right" } as any
  });

  // 第 2 行：每一列都向下 split 一次（中行更大）
  api.addPanel({
    id: p21,
    component: "GridPanel",
    title: "2-1（中行）",
    params: { id: p21, title: "2-1（中行）" },
    position: { referencePanel: p11, direction: "below", size: 420 } as any
  });
  api.addPanel({
    id: p22,
    component: "GridPanel",
    title: "2-2（中心更大）",
    params: { id: p22, title: "2-2（中心更大）", kind: "tianditu" },
    position: { referencePanel: p12, direction: "below", size: 420 } as any
  });
  api.addPanel({
    id: p23,
    component: "GridPanel",
    title: "2-3（柱状图）",
    params: { id: p23, title: "2-3（柱状图）", chartKind: "bar" },
    position: { referencePanel: p13, direction: "below", size: 420 } as any
  });

  // 第 3 行：再对第 2 行各列继续向下 split 一次
  api.addPanel({
    id: p31,
    component: "GridPanel",
    title: "3-1",
    params: { id: p31, title: "3-1" },
    position: { referencePanel: p21, direction: "below" } as any
  });
  api.addPanel({
    id: p32,
    component: "GridPanel",
    title: "3-2（中列）",
    params: { id: p32, title: "3-2（中列）" },
    position: { referencePanel: p22, direction: "below" } as any
  });
  api.addPanel({
    id: p33,
    component: "GridPanel",
    title: "3-3（表格）",
    params: { id: p33, title: "3-3（表格）", embedKind: "table" },
    position: { referencePanel: p23, direction: "below" } as any
  });
}

onBeforeUnmountSetup(() => {
  dockviewApi.value = null;
  panelEditApi.value = null;
  panelEditGetBusinessParams.value = null;
  cornerTapTs.value = [];
  clearCornerLongPressTimer();
});
</script>

<style scoped>
.homeDockview {
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  min-height: 0;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.dockviewFill {
  height: 100%;
  width: 100%;
  min-height: 0;
  min-width: 0;
}

.cornerHotspot {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  z-index: 50;
  background: transparent;
  cursor: default;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.2;
}

.btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--primary {
  border-color: rgba(64, 140, 255, 0.45);
  background: rgba(64, 140, 255, 0.18);
}

.muted {
  opacity: 0.75;
  font-size: 12px;
}

.cornerDrawerBody {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
}

.panelEditHint {
  margin: 0 0 14px;
}

.panelEditForm__label {
  font-size: 13px;
  font-weight: 600;
  margin: 12px 0 8px;
}

.panelEditRadios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.panelEditActions {
  margin-top: 18px;
}
</style>

<style>
.gridPanel {
  box-sizing: border-box;
  height: 100%;
  padding: 12px;
  color: var(--dv-activegroup-visiblepanel-tab-color, rgba(255, 255, 255, 0.92));
  background: var(--dv-group-view-background-color, rgba(11, 16, 32, 0.65));
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

/* 左下角隐形热区：大屏保持干净，双击切换 Dockview 分组最大化 */
.panelMaximizeHotspot {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 56px;
  height: 56px;
  z-index: 30;
  background: transparent;
  cursor: default;
  pointer-events: auto;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* 右下角隐形热区：连点或长按打开本面板编辑抽屉（不依赖固定网格布局） */
.panelEditHotspot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 56px;
  height: 56px;
  z-index: 30;
  background: transparent;
  cursor: default;
  pointer-events: auto;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.gridPanel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}

.gridPanel__title {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.gridPanel__meta {
  font-size: 12px;
  opacity: 0.75;
}

.gridPanel__body {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.85;
}

.gridPanel__mapWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  pointer-events: auto;
}

.gridPanel__imgWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gridPanel__img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
}

.tdtMap {
  height: 100%;
  width: 100%;
  min-height: 0;
  pointer-events: auto;
  touch-action: none;
}


.gridPanel__mapWrap .ol-viewport,
.gridPanel__mapWrap .ol-layers,
.gridPanel__mapWrap canvas {
  width: 100%;
  height: 100%;
}

.tdtError {
  padding: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
}
</style>
