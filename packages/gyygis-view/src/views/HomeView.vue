<template>
  <main ref="homeRoot" class="homeDockview" :class="dockThemeClassName" :style="layoutCssVars">
    <DockviewVue
      :theme="runtimeDockTheme"
      class="dockviewFill"
      left-header-actions-component="DockviewLeftHeaderAddPanel"
      @ready="onReady"
    />
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
      <div class="cornerDrawerActions">
        <el-button type="primary" @click="goToAdminLogin">登录</el-button>
      </div>
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
      <div class="userLayoutSection">
        <div class="userLayoutSection__title">布局</div>
        <p class="muted userLayoutSection__hint">
          「保存为默认布局」写入名称「默认」并标为当前默认；亦可用下方自定义名称保存多套布局，在下拉中切换恢复。删除默认布局时，将把您<strong>最近更新</strong>的另一条自动设为默认。
        </p>
        <div class="userLayoutRow">
          <el-button
            type="primary"
            :loading="userLayoutSaving"
            :disabled="!dockviewApi"
            @click="onSaveDefaultLayout"
          >
            保存为默认布局
          </el-button>
        </div>
        <div class="userLayoutRow userLayoutNamedSave">
          <el-input
            v-model="layoutSaveName"
            clearable
            maxlength="64"
            show-word-limit
            placeholder="布局名称（1～64 字）"
            :disabled="!dockviewApi"
          />
          <el-checkbox v-model="layoutSaveAsDefault" :disabled="!dockviewApi">设为默认</el-checkbox>
          <el-button
            :loading="userLayoutNamedSaving"
            :disabled="!dockviewApi || !layoutSaveNameTrimmed"
            @click="onSaveNamedLayout"
          >
            保存为命名布局
          </el-button>
        </div>
        <div class="userLayoutRow">
          <el-select
            v-model="restoreLayoutId"
            placeholder="选择已保存布局"
            clearable
            filterable
            style="width: 100%"
            :loading="userLayoutListLoading"
          >
            <el-option
              v-for="it in userLayoutList"
              :key="it.id"
              :label="formatLayoutOptionLabel(it)"
              :value="it.id"
            >
              <div class="userLayoutOptionRow">
                <span v-if="it.isDefault" class="userLayoutOptionStar" aria-hidden="true">★</span>
                <span class="userLayoutOptionMain">
                  <span class="userLayoutOptionName">{{ it.name }}</span>
                  <el-tag v-if="it.isDefault" type="success" size="small" effect="plain" class="userLayoutOptionTag">
                    默认
                  </el-tag>
                </span>
                <span class="muted userLayoutOptionTime">{{ formatLayoutUpdatedAt(it) }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div class="userLayoutRow userLayoutRow--actions">
          <el-button
            :disabled="restoreLayoutId == null || !dockviewApi"
            :loading="userLayoutRestoring"
            @click="onRestoreLayout"
          >
            恢复所选布局
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="restoreLayoutId == null"
            :loading="userLayoutDeleting"
            @click="onDeleteSelectedLayout"
          >
            删除所选布局
          </el-button>
        </div>
      </div>
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
        <template v-if="editPanelMode === 'map'">
          <div class="panelEditForm__label">图层（可多选、可排序、可调透明度）</div>
          <p class="muted panelEditHint">
            包含：用户发布图层（WMS）与第三方 XYZ（经服务端代理，用户 key 不下发浏览器）。拖拽调整叠加顺序（上面的会盖住下面的）。
          </p>

          <div class="panelLayerList">
            <div
              v-for="(it, idx) in editMapLayers"
              :key="it.key"
              class="panelLayerRow"
              draggable="true"
              @dragstart="(e: DragEvent) => onLayerDragStart(e, idx)"
              @dragover="(e: DragEvent) => onLayerDragOver(e)"
              @drop="(e: DragEvent) => onLayerDrop(e, idx)"
            >
              <div class="panelLayerRow__head">
                <span class="panelLayerRow__drag" title="拖拽排序">⋮⋮</span>
                <el-checkbox v-model="it.enabled" class="panelLayerRow__check" />
                <div class="panelLayerRow__title">
                  <div class="panelLayerRow__name">
                    {{ it.title }}
                    <el-tag size="small" effect="plain" class="panelLayerRow__tag">
                      {{ it.kind === "wms" ? "用户发布(WMS)" : "第三方(XYZ)" }}
                    </el-tag>
                  </div>
                  <div class="panelLayerRow__sub muted">
                    {{ it.kind === "wms" ? `图层：${it.layerName}` : `catalogId：${it.catalogId}` }}
                  </div>
                </div>
              </div>
              <div class="panelLayerRow__controls">
                <span class="muted panelLayerRow__opacityLabel">透明度</span>
                <el-slider v-model="it.opacityPercent" :min="0" :max="100" :step="1" :show-tooltip="true" />
              </div>
            </div>

            <div v-if="mapLayerOptionsLoading" class="muted panelEditHint">加载图层列表中…</div>
            <div v-else-if="editMapLayers.length === 0" class="muted panelEditHint">暂无可用图层（请先发布图层或配置第三方服务并启用）。</div>
          </div>
        </template>
        <template v-if="editPanelMode === 'table'">
          <div class="panelEditForm__label">地图服务图层</div>
          <el-select
            v-model="editTableLayerName"
            style="width: 100%"
            filterable
            clearable
            placeholder="选择已发布图层"
            :loading="tableLayersLoading"
            :disabled="tableLayersLoading"
          >
            <el-option
              v-for="it in tableLayers"
              :key="it.name"
              :label="it.enabled === false ? `${it.name}（已停用）` : it.name"
              :value="it.name"
              :disabled="it.enabled === false"
            />
          </el-select>
          <p class="muted panelEditHint">来源：当前登录用户已发布的 GeoServer 图层（/api/maps/layers）。</p>

          <div class="panelEditForm__label">显示字段</div>
          <el-select
            v-model="editTableFields"
            style="width: 100%"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择要显示的字段（可多选）"
            :loading="tableFieldsLoading"
            :disabled="!editTableLayerName || tableFieldsLoading"
          >
            <el-option v-for="f in tableFields" :key="f.name" :label="f.name" :value="f.name" />
          </el-select>
          <p class="muted panelEditHint">提示：字段来自 PostGIS 表结构（默认不含几何字段）。</p>
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
import DockviewLeftHeaderAddPanel from "@/panels/DockviewLeftHeaderAddPanel.vue";

export default {
  components: {
    DockviewVue,
    GridPanel,
    DockviewLeftHeaderAddPanel
  }
};
</script>

<script setup lang="ts">
import {
  computed as computedSetup,
  nextTick as nextTickSetup,
  onBeforeUnmount as onBeforeUnmountSetup,
  provide,
  ref as refSetup,
  watch as watchSetup,
  type Ref
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type {
  DockviewApi,
  DockviewPanelApi,
  DockviewReadyEvent,
  SerializedDockview
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
import { fetchWebMapServices, type WebMapServiceRow } from "@/api/webMapServices";
import {
  deleteUserLayout,
  fetchUserLayoutById,
  fetchUserLayouts,
  saveDefaultUserLayout,
  saveUserLayoutByName,
  type UserLayoutListItem
} from "@/api/userLayouts";
import {
  fetchLayerFields,
  fetchUserMapLayers,
  type MapLayerField,
  type MapLayerInfo
} from "@/api/maps";

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

const userLayoutList = refSetup<UserLayoutListItem[]>([]);
const userLayoutListLoading = refSetup(false);
const userLayoutSaving = refSetup(false);
const userLayoutNamedSaving = refSetup(false);
const userLayoutRestoring = refSetup(false);
const userLayoutDeleting = refSetup(false);
const restoreLayoutId = refSetup<number | undefined>(undefined);
const layoutSaveName = refSetup("");
const layoutSaveAsDefault = refSetup(false);

const layoutSaveNameTrimmed = computedSetup(() => layoutSaveName.value.trim());

const LAST_RESTORED_LAYOUT_ID_KEY = "gyygis-view:last-restored-layout-id";

function readLastRestoredLayoutId(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_RESTORED_LAYOUT_ID_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastRestoredLayoutId(id: number | null) {
  try {
    if (id == null) {
      window.localStorage.removeItem(LAST_RESTORED_LAYOUT_ID_KEY);
      return;
    }
    window.localStorage.setItem(LAST_RESTORED_LAYOUT_ID_KEY, String(id));
  } catch {
    // ignore (private mode / disabled storage)
  }
}

function formatLayoutUpdatedAt(it: UserLayoutListItem): string {
  try {
    return it.updatedAt ? new Date(it.updatedAt).toLocaleString() : "";
  } catch {
    return "";
  }
}

function formatLayoutOptionLabel(it: UserLayoutListItem): string {
  const suffix = it.isDefault ? " · 默认" : "";
  const time = formatLayoutUpdatedAt(it);
  return time ? `${it.name}${suffix}（${time}）` : `${it.name}${suffix}`;
}

async function refreshUserLayoutList() {
  userLayoutListLoading.value = true;
  try {
    userLayoutList.value = await fetchUserLayouts();
  } catch (e) {
    userLayoutList.value = [];
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.warning(msg);
  } finally {
    userLayoutListLoading.value = false;
  }
}

watchSetup(cornerDrawerVisible, v => {
  if (v) {
    if (restoreLayoutId.value == null) {
      const last = readLastRestoredLayoutId();
      if (last != null) restoreLayoutId.value = last;
    }
    void refreshUserLayoutList();
  }
});

async function onSaveDefaultLayout() {
  const api = dockviewApi.value;
  if (!api) return;
  userLayoutSaving.value = true;
  try {
    await saveDefaultUserLayout(api.toJSON() as object);
    ElMessage.success("已保存为默认布局");
    await refreshUserLayoutList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  } finally {
    userLayoutSaving.value = false;
  }
}

async function onSaveNamedLayout() {
  const api = dockviewApi.value;
  const name = layoutSaveNameTrimmed.value;
  if (!api || !name) return;
  userLayoutNamedSaving.value = true;
  try {
    await saveUserLayoutByName(name, api.toJSON() as object, layoutSaveAsDefault.value);
    ElMessage.success(layoutSaveAsDefault.value ? "已保存并设为默认" : "已保存命名布局");
    await refreshUserLayoutList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  } finally {
    userLayoutNamedSaving.value = false;
  }
}

async function onDeleteSelectedLayout() {
  const id = restoreLayoutId.value;
  if (id == null) return;
  const it = userLayoutList.value.find(x => x.id === id);
  const title = it?.name ?? String(id);
  try {
    await ElMessageBox.confirm(
      `确定删除布局「${title}」吗？此操作不可恢复。若删除的是当前默认布局，将把您最近更新的一条其余布局自动设为默认。`,
      "删除布局",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  userLayoutDeleting.value = true;
  try {
    await deleteUserLayout(id);
    ElMessage.success("已删除");
    const last = readLastRestoredLayoutId();
    if (last === id) writeLastRestoredLayoutId(null);
    restoreLayoutId.value = undefined;
    await refreshUserLayoutList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  } finally {
    userLayoutDeleting.value = false;
  }
}

function relayoutDockview() {
  const api = dockviewApi.value;
  const el = homeRoot.value;
  if (api && el) {
    api.layout(el.clientWidth, el.clientHeight, true);
  }
}

async function onRestoreLayout() {
  const api = dockviewApi.value;
  const id = restoreLayoutId.value;
  if (!api || id == null) return;
  userLayoutRestoring.value = true;
  try {
    const layout = (await fetchUserLayoutById(id)) as SerializedDockview;
    api.clear();
    api.fromJSON(layout);
    await nextTickSetup();
    relayoutDockview();
    ElMessage.success("布局已恢复");
    writeLastRestoredLayoutId(id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  } finally {
    userLayoutRestoring.value = false;
  }
}

async function tryAutoRestoreLayout(api: DockviewApi): Promise<boolean> {
  // 1) 优先恢复“上次恢复”的布局（满足：登录态有效、且该布局仍存在）
  const last = readLastRestoredLayoutId();
  if (last != null) {
    try {
      const layout = (await fetchUserLayoutById(last)) as SerializedDockview;
      api.clear();
      api.fromJSON(layout);
      await nextTickSetup();
      relayoutDockview();
      restoreLayoutId.value = last;
      return true;
    } catch {
      // last 可能已被删除/无权限/登录过期；回退到默认逻辑
    }
  }

  // 2) 其次尝试恢复“默认布局”（满足：已登录且存在默认项）
  try {
    const list = await fetchUserLayouts();
    const def = list.find(x => x.isDefault);
    if (!def) return false;
    const layout = (await fetchUserLayoutById(def.id)) as SerializedDockview;
    api.clear();
    api.fromJSON(layout);
    await nextTickSetup();
    relayoutDockview();
    restoreLayoutId.value = def.id;
    writeLastRestoredLayoutId(def.id);
    return true;
  } catch {
    return false;
  }
}

function goToAdminLogin() {
  const redirect = encodeURIComponent(window.location.href);
  window.location.assign(`/admin/login?redirect=${redirect}`);
}

const panelEditDrawerVisible = refSetup(false);
const panelEditDrawerTitle = refSetup("");
const panelEditPanelId = refSetup("");
const panelEditDrawerDirection = refSetup<"ltr" | "rtl">("rtl");
const panelEditApi = refSetup<DockviewPanelApi | null>(null);
const panelEditGetBusinessParams = refSetup<(() => Record<string, unknown>) | null>(null);

const editPanelMode = refSetup<PanelContentRadio>("auto");
const editChartKind = refSetup<DockviewChartKind>("bar");
const editImageUrl = refSetup("");
const editTableLayerName = refSetup("");
const editTableFields = refSetup<string[]>([]);

const tableLayers = refSetup<MapLayerInfo[]>([]);
const tableLayersLoading = refSetup(false);
const tableFields = refSetup<MapLayerField[]>([]);
const tableFieldsLoading = refSetup(false);

const webMapServicesLoading = refSetup(false);
const webMapServices = refSetup<WebMapServiceRow[]>([]);

type EditMapLayerRow =
  | {
      key: string;
      kind: "xyz";
      title: string;
      catalogId: number;
      enabled: boolean;
      opacityPercent: number; // 0..100
    }
  | {
      key: string;
      kind: "wms";
      title: string;
      layerName: string;
      enabled: boolean;
      opacityPercent: number; // 0..100
    };

const mapLayerOptionsLoading = refSetup(false);
const userPublishedLayers = refSetup<MapLayerInfo[]>([]);
const editMapLayers = refSetup<EditMapLayerRow[]>([]);
const dragFromIndex = refSetup<number | null>(null);

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

  editTableLayerName.value = typeof p.tableLayerName === "string" ? p.tableLayerName : "";
  editTableFields.value = Array.isArray(p.tableFields)
    ? (p.tableFields as unknown[]).map(x => String(x)).filter(Boolean)
    : [];

  // mapLayers（新版）优先；否则兼容旧的 mapCatalogId/mapCatalogIds
  const rawLayers = Array.isArray(p.mapLayers) ? (p.mapLayers as unknown[]) : null;
  if (rawLayers && rawLayers.length) {
    const next: EditMapLayerRow[] = [];
    for (const it of rawLayers) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const kind = String(o.kind ?? "");
      const enabled = o.enabled !== false;
      const opacity = Math.round(Math.max(0, Math.min(1, Number(o.opacity ?? 1))) * 100);
      const title = typeof o.title === "string" ? o.title : "";
      if (kind === "xyz") {
        const catalogId = Number(o.catalogId);
        if (Number.isFinite(catalogId) && catalogId > 0) {
          next.push({
            key: `xyz:${catalogId}`,
            kind: "xyz",
            title: title || `第三方服务 ${catalogId}`,
            catalogId,
            enabled,
            opacityPercent: opacity
          });
        }
      }
      if (kind === "wms") {
        const layerName = typeof o.layerName === "string" ? o.layerName.trim() : "";
        if (layerName) {
          next.push({
            key: `wms:${layerName}`,
            kind: "wms",
            title: title || `用户图层 ${layerName}`,
            layerName,
            enabled,
            opacityPercent: opacity
          });
        }
      }
    }
    editMapLayers.value = next;
    return;
  }

  const idsRaw = p.mapCatalogIds;
  const ids = Array.isArray(idsRaw)
    ? (idsRaw as unknown[]).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0)
    : [];
  const one = Number(p.mapCatalogId);
  const uniq: number[] = [];
  if (Number.isFinite(one) && one > 0) uniq.push(one);
  for (const n of ids) if (!uniq.includes(n)) uniq.push(n);
  editMapLayers.value = uniq.map(cid => ({
    key: `xyz:${cid}`,
    kind: "xyz",
    title: webMapServices.value.find(s => s.catalogId === cid)?.name ?? `第三方服务 ${cid}`,
    catalogId: cid,
    enabled: true,
    opacityPercent: 100
  }));
}

function applyPanelContentFromDrawer() {
  const api = panelEditApi.value;
  const getP = panelEditGetBusinessParams.value;
  if (!api || !getP) return;
  const base = { ...getP() };
  const next = mergePanelContentParams(base, editPanelMode.value, {
    chartKind: editChartKind.value,
    imageUrl: editImageUrl.value,
    tableLayerName: editTableLayerName.value,
    tableFields: editTableFields.value
  });

  if (editPanelMode.value === "map") {
    (next as Record<string, unknown>).mapLayers = editMapLayers.value.map(it => {
      if (it.kind === "xyz") {
        return {
          kind: "xyz",
          title: it.title,
          catalogId: it.catalogId,
          enabled: it.enabled,
          opacity: Math.max(0, Math.min(1, it.opacityPercent / 100))
        };
      }
      return {
        kind: "wms",
        title: it.title,
        layerName: it.layerName,
        enabled: it.enabled,
        opacity: Math.max(0, Math.min(1, it.opacityPercent / 100))
      };
    });
    // 迁移到新版参数后清理旧字段，避免渲染端歧义
    delete (next as Record<string, unknown>).mapCatalogIds;
    delete (next as Record<string, unknown>).mapCatalogId;
  } else {
    delete (next as Record<string, unknown>).mapLayers;
    delete (next as Record<string, unknown>).mapCatalogIds;
    delete (next as Record<string, unknown>).mapCatalogId;
  }
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

async function ensureTableLayersLoaded() {
  if (tableLayersLoading.value) return;
  tableLayersLoading.value = true;
  try {
    tableLayers.value = await fetchUserMapLayers();
  } catch (e) {
    tableLayers.value = [];
    ElMessage.warning(e instanceof Error ? e.message : String(e));
  } finally {
    tableLayersLoading.value = false;
  }
}

function isWebMapServiceAvailableForUser(it: WebMapServiceRow): boolean {
  if (!it.catalogEnabled) return false;
  if (!it.userEnabled) return false;
  if (it.requiresUserKey && !it.hasUserKey) return false;
  return true;
}

async function ensureWebMapServicesLoaded() {
  if (webMapServicesLoading.value) return;
  webMapServicesLoading.value = true;
  try {
    const list = await fetchWebMapServices();
    webMapServices.value = list.filter(isWebMapServiceAvailableForUser);
  } catch (e) {
    webMapServices.value = [];
    ElMessage.warning(e instanceof Error ? e.message : String(e));
  } finally {
    webMapServicesLoading.value = false;
  }
}

async function ensureUserPublishedLayersLoaded() {
  if (mapLayerOptionsLoading.value) return;
  mapLayerOptionsLoading.value = true;
  try {
    const list = await fetchUserMapLayers();
    userPublishedLayers.value = list.filter(x => x.enabled !== false);
  } catch (e) {
    userPublishedLayers.value = [];
    ElMessage.warning(e instanceof Error ? e.message : String(e));
  } finally {
    mapLayerOptionsLoading.value = false;
  }
}

function mergeLayerOptionsIntoEditList() {
  const cur = new Map(editMapLayers.value.map(x => [x.key, x]));
  const next: EditMapLayerRow[] = [];

  // 1) 保留已有顺序
  for (const it of editMapLayers.value) next.push(it);

  // 2) 补齐“用户发布图层”
  for (const l of userPublishedLayers.value) {
    const key = `wms:${l.name}`;
    if (cur.has(key)) continue;
    next.push({
      key,
      kind: "wms",
      title: l.name,
      layerName: l.name,
      enabled: false,
      opacityPercent: 100
    });
  }

  // 3) 补齐“第三方服务”
  for (const s of webMapServices.value) {
    const key = `xyz:${s.catalogId}`;
    if (cur.has(key)) continue;
    next.push({
      key,
      kind: "xyz",
      title: s.name,
      catalogId: s.catalogId,
      enabled: false,
      opacityPercent: 100
    });
  }

  editMapLayers.value = next;
}

function onLayerDragStart(e: DragEvent, idx: number) {
  dragFromIndex.value = idx;
  try {
    e.dataTransfer?.setData("text/plain", String(idx));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  } catch {
    // ignore
  }
}

function onLayerDragOver(e: DragEvent) {
  e.preventDefault();
  try {
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  } catch {
    // ignore
  }
}

function onLayerDrop(e: DragEvent, to: number) {
  e.preventDefault();
  const from = dragFromIndex.value;
  dragFromIndex.value = null;
  if (from == null || from === to) return;
  const arr = editMapLayers.value.slice();
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  editMapLayers.value = arr;
}

watchSetup(
  () => editPanelMode.value,
  v => {
    if (v === "map") {
      void ensureWebMapServicesLoaded();
      void ensureUserPublishedLayersLoaded();
    }
  }
);

watchSetup(
  () => [webMapServices.value.length, userPublishedLayers.value.length] as const,
  () => {
    if (editPanelMode.value !== "map") return;
    mergeLayerOptionsIntoEditList();
  }
);

async function refreshTableFieldsForLayer(layerName: string) {
  if (!layerName) {
    tableFields.value = [];
    editTableFields.value = [];
    return;
  }
  tableFieldsLoading.value = true;
  try {
    tableFields.value = await fetchLayerFields(layerName);
    const allowed = new Set(tableFields.value.map(x => x.name));
    editTableFields.value = editTableFields.value.filter(f => allowed.has(f));
  } catch (e) {
    tableFields.value = [];
    editTableFields.value = [];
    ElMessage.warning(e instanceof Error ? e.message : String(e));
  } finally {
    tableFieldsLoading.value = false;
  }
}

watchSetup(
  () => [panelEditDrawerVisible.value, editPanelMode.value] as const,
  ([visible, mode]) => {
    if (visible && mode === "table") void ensureTableLayersLoaded();
  }
);

watchSetup(editTableLayerName, layer => {
  void refreshTableFieldsForLayer(layer);
});

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

/** 用 addPanel + position(referencePanel, direction) 构造 3 行 × 3 列（共 9 个 Panel）。 */
function buildInitialDockviewGrid(api: DockviewApi) {
  const p11 = "r1c1";
  const p12 = "r1c2";
  const p13 = "r1c3";
  const p21 = "r2c1";
  const p22 = "r2c2";
  const p23 = "r2c3";
  const p31 = "r3c1";
  const p32 = "r3c2";
  const p33 = "r3c3";

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

function onReady(event: DockviewReadyEvent) {
  const { api } = event;
  dockviewApi.value = api;
  void (async () => {
    const restored = await tryAutoRestoreLayout(api);
    if (!restored) buildInitialDockviewGrid(api);
  })();
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

.cornerDrawerActions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 12px;
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

.panelLayerList {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.panelLayerRow {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 10px 8px;
  background: rgba(255, 255, 255, 0.02);
}

.panelLayerRow__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.panelLayerRow__drag {
  width: 18px;
  flex-shrink: 0;
  user-select: none;
  opacity: 0.7;
  cursor: grab;
}

.panelLayerRow__check {
  flex-shrink: 0;
  margin-top: 1px;
}

.panelLayerRow__title {
  min-width: 0;
  flex: 1;
}

.panelLayerRow__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  line-height: 1.25;
}

.panelLayerRow__tag {
  flex-shrink: 0;
}

.panelLayerRow__sub {
  margin-top: 2px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panelLayerRow__controls {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.panelLayerRow__opacityLabel {
  flex-shrink: 0;
  font-size: 12px;
  width: 46px;
}

.userLayoutSection {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.userLayoutSection__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.userLayoutSection__hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
}

.userLayoutRow {
  margin-bottom: 10px;
}

.userLayoutRow:last-child {
  margin-bottom: 0;
}

.userLayoutNamedSave {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.userLayoutRow--actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.userLayoutRow--actions .el-button {
  flex: 1;
  min-width: 120px;
}
</style>

<style>
/* Dockview 左侧头操作区：与标签栏同一行内垂直居中（.dv-vue-part 默认块级会顶对齐） */
.homeDockview .dv-left-actions-container {
  display: flex;
  align-items: center;
  align-self: stretch;
}

.homeDockview .dv-left-actions-container .dv-vue-part {
  display: flex;
  align-items: center;
  height: 100%;
  min-height: var(--dv-tabs-and-actions-container-height, 35px);
}

.gridPanel {
  box-sizing: border-box;
  height: 100%;
  padding: var(--gyygis-panel-padding, 8px);
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
  border-radius: var(--gyygis-panel-content-border-radius, 10px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  pointer-events: auto;
}

.gridPanel__imgWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: var(--gyygis-panel-content-border-radius, 10px);
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

/* el-select 选项渲染在弹出层，需非 scoped 才能命中 */
.userLayoutOptionRow {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  line-height: 1.35;
}

.userLayoutOptionStar {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-color-warning);
}

.userLayoutOptionMain {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.userLayoutOptionName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.userLayoutOptionTag {
  flex-shrink: 0;
}

.userLayoutOptionTime {
  flex-shrink: 0;
  max-width: 44%;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.75;
}
</style>
