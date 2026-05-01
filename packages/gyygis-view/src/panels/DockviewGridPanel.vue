<script lang="ts">
import { computed, defineComponent, h, inject, ref } from "vue";
import TiandituMapPanel from "@/panels/TiandituMapPanel.vue";
import EchartsPanel from "@/panels/EchartsPanel.vue";
import DockviewEmbedTablePanel from "@/panels/DockviewEmbedTablePanel.vue";
import { isDockviewChartKind } from "@/charts/types";
import { PANEL_EDIT_INJECTION_KEY } from "@/panelEditInjection";
import { DEFAULT_PANEL_IMAGE_URL, getEffectivePanelContent } from "@/panelContentMode";

const EDIT_HOTSPOT_MULTI_TAP_WINDOW_MS = 2000;
const EDIT_HOTSPOT_MULTI_TAP_COUNT = 5;
const EDIT_HOTSPOT_LONG_PRESS_MS = 1500;

/** Dockview 面板 api：双击左下角热区切换分组最大化（版本差异用 duck typing） */
function togglePanelMaximizeFromApi(api: unknown): void {
  if (!api || typeof api !== "object") return;
  const a = api as Record<string, unknown>;
  try {
    const isMax =
      typeof a.isMaximized === "function" ? (a.isMaximized as () => boolean)() : false;
    if (isMax && typeof a.exitMaximized === "function") {
      (a.exitMaximized as () => void)();
      return;
    }
    if (typeof a.maximize === "function") {
      (a.maximize as () => void)();
    }
  } catch (e) {
    console.warn("[GridPanel] maximize toggle failed", e);
  }
}

type DockviewVuePanelProps = {
  params?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  containerApi?: any;
  tabLocation?: unknown;
};

export default defineComponent({
  name: "GridPanel",
  props: {
    params: { type: Object, required: true }
  },
  setup(props: { params: unknown }) {
    /** Dockview 每次 update 会换新的 props.params 对象，绝不能缓存首帧引用 */
    const shell = computed(() => props.params as DockviewVuePanelProps);

    const panelId = computed(() => {
      const dv = shell.value;
      const apiId = (dv.api as { id?: string } | undefined)?.id;
      if (apiId) return apiId;
      const pId = (dv.params as { id?: string } | undefined)?.id;
      return pId ?? "";
    });
    const panelTitle = computed(() => {
      const t = (shell.value.params as { title?: string } | undefined)?.title;
      return t ?? panelId.value ?? "Panel";
    });
    const kind = computed(() => {
      return ((shell.value.params as { kind?: string } | undefined)?.kind ?? "") as string;
    });

    const innerParams = computed(
      () =>
        ((shell.value.params as Record<string, unknown> | undefined) ??
          {}) as Record<string, unknown>
    );

    const effectiveContent = computed(() =>
      getEffectivePanelContent(innerParams.value, panelId.value)
    );

    const chartKindResolved = computed(() => {
      const raw = String(innerParams.value.chartKind ?? "");
      return isDockviewChartKind(raw) ? raw : null;
    });

    const embedKind = computed(() => String(innerParams.value.embedKind ?? ""));

    const imageUrlResolved = computed(() => {
      const u = innerParams.value.imageUrl;
      if (typeof u === "string" && u.trim()) return u.trim();
      return DEFAULT_PANEL_IMAGE_URL;
    });

    function readMapLayersParam(): unknown[] | null {
      const raw = innerParams.value.mapLayers;
      return Array.isArray(raw) ? (raw as unknown[]) : null;
    }

    const metaSuffix = computed(() => {
      const parts: string[] = [];
      if (kind.value) parts.push(kind.value);
      if (chartKindResolved.value) parts.push(`chart:${chartKindResolved.value}`);
      if (embedKind.value) parts.push(`embed:${embedKind.value}`);
      if (effectiveContent.value === "image") parts.push("image");
      if (effectiveContent.value === "map" && readMapLayersParam()?.length) parts.push("layers");
      return parts.length ? ` · ${parts.join(" · ")}` : "";
    });

    const openPanelEdit = inject(PANEL_EDIT_INJECTION_KEY, null);
    const editTapTs = ref<number[]>([]);
    const editLongPressTimer = ref<number | null>(null);
    const editLongPressFired = ref(false);

    function clearEditHotspotLongPress() {
      if (editLongPressTimer.value != null) {
        window.clearTimeout(editLongPressTimer.value);
        editLongPressTimer.value = null;
      }
    }

    /** 与 Dockview 内部状态一致；勿用 `api.getParameters()` 作唯一数据源（未 update 前常为空对象） */
    function getBusinessParams(): Record<string, unknown> {
      const wrap = props.params as DockviewVuePanelProps;
      const inner = wrap.params;
      if (inner && typeof inner === "object") {
        return { ...(inner as Record<string, unknown>) };
      }
      return {};
    }

    function triggerPanelEditDrawer(anchor: HTMLElement) {
      if (!openPanelEdit) return;
      editTapTs.value = [];
      clearEditHotspotLongPress();
      editLongPressFired.value = true;
      const root = (anchor.closest("section.gridPanel") as HTMLElement) ?? anchor;
      const api = shell.value.api;
      if (api) openPanelEdit(root, panelId.value, panelTitle.value, api, getBusinessParams);
      window.setTimeout(() => {
        editLongPressFired.value = false;
      }, 0);
    }

    function onEditHotspotClick(e: MouseEvent) {
      if (!openPanelEdit) return;
      if (editLongPressFired.value) return;
      const now = Date.now();
      const keepAfter = now - EDIT_HOTSPOT_MULTI_TAP_WINDOW_MS;
      editTapTs.value = editTapTs.value.filter((t: number) => t >= keepAfter);
      editTapTs.value.push(now);
      if (editTapTs.value.length >= EDIT_HOTSPOT_MULTI_TAP_COUNT) {
        triggerPanelEditDrawer(e.currentTarget as HTMLElement);
      }
    }

    function onEditHotspotPointerDown(e: PointerEvent) {
      if (!openPanelEdit) return;
      editLongPressFired.value = false;
      clearEditHotspotLongPress();
      editLongPressTimer.value = window.setTimeout(() => {
        triggerPanelEditDrawer(e.currentTarget as HTMLElement);
      }, EDIT_HOTSPOT_LONG_PRESS_MS);
    }

    function onEditHotspotPointerUp() {
      clearEditHotspotLongPress();
    }

    function onEditHotspotPointerCancel() {
      clearEditHotspotLongPress();
    }

    return () =>
      h("section", { class: "gridPanel" }, [
        h("header", { class: "gridPanel__header" }, [
          h("div", { class: "gridPanel__title" }, panelTitle.value),
          h(
            "div",
            { class: "gridPanel__meta" },
            panelId.value ? `id: ${panelId.value}${metaSuffix.value}` : ""
          )
        ]),
        effectiveContent.value === "map"
          ? h(TiandituMapPanel, {
              mapLayers: readMapLayersParam(),
              mapCatalogId:
                typeof innerParams.value.mapCatalogId === "number"
                  ? (innerParams.value.mapCatalogId as number)
                  : innerParams.value.mapCatalogId == null
                    ? null
                    : Number.isFinite(Number(innerParams.value.mapCatalogId))
                      ? Number(innerParams.value.mapCatalogId)
                      : null,
              mapCatalogIds: Array.isArray(innerParams.value.mapCatalogIds)
                ? (innerParams.value.mapCatalogIds as unknown[])
                    .map(x => Number(x))
                    .filter(n => Number.isFinite(n) && n > 0)
                : null
            })
          : effectiveContent.value === "chart"
            ? h(EchartsPanel, { chartKind: chartKindResolved.value ?? "bar" })
            : effectiveContent.value === "table"
              ? h(DockviewEmbedTablePanel, { params: innerParams.value })
              : effectiveContent.value === "image"
                ? h("div", { class: "gridPanel__imgWrap" }, [
                    h("img", {
                      class: "gridPanel__img",
                      src: imageUrlResolved.value,
                      alt: "",
                      draggable: false
                    })
                  ])
                : h("div", { class: "gridPanel__body" }, [
                    h(
                      "div",
                      { class: "gridPanel__hint" },
                      "Dockview 网格占位（可在右下角编辑中选择内容类型）"
                    )
                  ]),
        openPanelEdit
          ? h("div", {
              class: "panelEditHotspot",
              title: "2秒内连点5次或长按1.5秒：打开本面板编辑抽屉",
              ariaHidden: "true",
              onClick: (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                onEditHotspotClick(e);
              },
              onPointerdown: (e: PointerEvent) => {
                e.preventDefault();
                e.stopPropagation();
                onEditHotspotPointerDown(e);
              },
              onPointerup: (e: PointerEvent) => {
                e.stopPropagation();
                onEditHotspotPointerUp();
              },
              onPointercancel: (e: PointerEvent) => {
                e.stopPropagation();
                onEditHotspotPointerCancel();
              },
              onPointerleave: (e: PointerEvent) => {
                e.stopPropagation();
                onEditHotspotPointerCancel();
              },
              onContextmenu: (e: Event) => e.preventDefault()
            })
          : null,
        h("div", {
          class: "panelMaximizeHotspot",
          title: "双击：最大化 / 再双击恢复",
          ariaHidden: "true",
          onDblclick: (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            togglePanelMaximizeFromApi(shell.value.api);
          }
        })
      ]);
  }
});
</script>
