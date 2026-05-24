<template>
  <div class="gyygisPanelTab">
    <button
      type="button"
      class="gyygisPanelTab__title"
      :title="hasContent ? '点击编辑面板内容' : '点击添加内容'"
      @click="onTitleClick"
    >
      {{ displayTitle }}
    </button>
    <div class="gyygisPanelTab__actions">
      <button
        v-if="hasContent"
        type="button"
        class="gyygisPanelTab__btn"
        title="在新窗口打开"
        aria-label="在新窗口打开"
        @pointerdown.stop.prevent
        @click.stop.prevent="onPopout"
      >
        ↗
      </button>
      <button
        type="button"
        class="gyygisPanelTab__btn"
        :title="isMaximized ? '还原布局' : '铺满布局'"
        :aria-label="isMaximized ? '还原布局' : '铺满布局'"
        @pointerdown.stop.prevent
        @click.stop.prevent="onToggleMaximize"
      >
        {{ isMaximized ? "⤢" : "⛶" }}
      </button>
      <button
        v-if="hasContent"
        type="button"
        class="gyygisPanelTab__btn gyygisPanelTab__btn--danger"
        title="清空面板内容"
        aria-label="清空面板内容"
        @pointerdown.stop.prevent
        @click.stop.prevent="onClear"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DockviewApi, DockviewPanelApi } from "dockview-core";
import { getEffectivePanelContent, getPanelTabDisplayTitle } from "@/panelContentMode";
import {
  confirmAndClearPanelContent,
  popoutPanelInNewWindow,
  togglePanelMaximize
} from "@/panelTabActions";
import { PANEL_EDIT_INJECTION_KEY } from "@/panelEditInjection";
import { DOCKVIEW_ACTIVE_THEME_KEY } from "@/panelTabThemeInjection";

defineOptions({ name: "DockviewPanelTab" });

type TabShellProps = {
  params: Record<string, unknown>;
  api: DockviewPanelApi;
  containerApi: DockviewApi;
  tabLocation?: "header" | "headerOverflow";
};

const props = defineProps<{
  params: TabShellProps;
}>();

const openPanelEdit = inject(PANEL_EDIT_INJECTION_KEY, null);
const activeDockTheme = inject(DOCKVIEW_ACTIVE_THEME_KEY, null);

const dockTitle = ref("");
const isMaximized = ref(false);
const businessParams = ref<Record<string, unknown>>({});

const panelApi = computed(() => props.params.api);
const containerApi = computed(() => props.params.containerApi);
const panelId = computed(() => panelApi.value?.id ?? "");

const effectiveContent = computed(() =>
  getEffectivePanelContent(businessParams.value, panelId.value)
);
const hasContent = computed(() => effectiveContent.value !== "none");

const displayTitle = computed(() =>
  getPanelTabDisplayTitle(businessParams.value, panelId.value, dockTitle.value)
);

function syncParamsFromApi() {
  const api = panelApi.value;
  if (!api) {
    businessParams.value = { ...((props.params.params ?? {}) as Record<string, unknown>) };
    return;
  }
  try {
    businessParams.value = { ...(api.getParameters() as Record<string, unknown>) };
  } catch {
    businessParams.value = { ...((props.params.params ?? {}) as Record<string, unknown>) };
  }
}

function syncMaximizedState() {
  try {
    isMaximized.value = panelApi.value?.isMaximized() ?? false;
  } catch {
    isMaximized.value = false;
  }
}

function getBusinessParams(): Record<string, unknown> {
  syncParamsFromApi();
  return { ...businessParams.value };
}

function resolveAnchorEl(): HTMLElement {
  const groupEl = panelApi.value?.group?.element;
  if (groupEl instanceof HTMLElement) return groupEl;
  return document.body;
}

function onTitleClick() {
  if (!openPanelEdit || !panelApi.value) return;
  openPanelEdit(
    resolveAnchorEl(),
    panelId.value,
    displayTitle.value,
    panelApi.value,
    getBusinessParams
  );
}

function onToggleMaximize() {
  if (!panelApi.value) return;
  togglePanelMaximize(panelApi.value);
  syncMaximizedState();
}

async function onClear() {
  if (!panelApi.value) return;
  await confirmAndClearPanelContent(panelApi.value, getBusinessParams());
  syncParamsFromApi();
}

async function onPopout() {
  if (!panelApi.value || !containerApi.value) return;
  await popoutPanelInNewWindow(
    panelApi.value,
    containerApi.value,
    activeDockTheme?.value ?? null
  );
}

watch(
  () => props.params.params,
  () => syncParamsFromApi(),
  { deep: true }
);

let disposeTitle: { dispose(): void } | undefined;
let disposeMaximized: { dispose(): void } | undefined;
let disposeParams: { dispose(): void } | undefined;

onMounted(() => {
  dockTitle.value = panelApi.value?.title ?? "";
  syncParamsFromApi();
  syncMaximizedState();

  if (panelApi.value) {
    disposeTitle = panelApi.value.onDidTitleChange(e => {
      dockTitle.value = e.title;
    });
    disposeParams = panelApi.value.onDidParametersChange(p => {
      businessParams.value = { ...(p as Record<string, unknown>) };
    });
  }
  if (containerApi.value) {
    disposeMaximized = containerApi.value.onDidMaximizedGroupChange(() => {
      syncMaximizedState();
    });
  }
});

onBeforeUnmount(() => {
  disposeTitle?.dispose();
  disposeMaximized?.dispose();
  disposeParams?.dispose();
});
</script>

<style scoped>
.gyygisPanelTab {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0 4px 0 6px;
}

.gyygisPanelTab__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.gyygisPanelTab__title:hover {
  opacity: 0.92;
}

.gyygisPanelTab__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  margin-left: auto;
}

.gyygisPanelTab__btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.85;
  flex-shrink: 0;
}

.gyygisPanelTab__btn:hover {
  opacity: 1;
  background: var(--dv-icon-hover-background-color, rgba(128, 128, 128, 0.18));
}

.gyygisPanelTab__btn--danger:hover {
  background: rgba(245, 108, 108, 0.22);
  color: #f56c6c;
}
</style>
