<script lang="ts">
import { computed, defineComponent, h, inject } from "vue";
import TiandituMapPanel from "@/panels/TiandituMapPanel.vue";
import EchartsPanel from "@/panels/EchartsPanel.vue";
import DockviewEmbedTablePanel from "@/panels/DockviewEmbedTablePanel.vue";
import DockviewStatsPanel from "@/panels/DockviewStatsPanel.vue";
import DockviewTimePanel from "@/panels/DockviewTimePanel.vue";
import DockviewMapControlsPanel from "@/panels/DockviewMapControlsPanel.vue";
import { isDockviewChartKind } from "@/charts/types";
import { PANEL_EDIT_INJECTION_KEY } from "@/panelEditInjection";
import {
  coercePanelImageObjectFit,
  coerceTimeDisplayMode,
  DEFAULT_PANEL_IMAGE_URL,
  getEffectivePanelContent
} from "@/panelContentMode";

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
      if (typeof t === "string" && t.trim()) return t.trim();
      return "";
    });

    const innerParams = computed(
      () =>
        ((shell.value.params as Record<string, unknown> | undefined) ??
          {}) as Record<string, unknown>
    );

    const effectiveContent = computed(() =>
      getEffectivePanelContent(innerParams.value, panelId.value)
    );

    const isEmptyPanel = computed(() => effectiveContent.value === "none");

    const chartKindResolved = computed(() => {
      const raw = String(innerParams.value.chartKind ?? "");
      return isDockviewChartKind(raw) ? raw : null;
    });

    const imageUrlResolved = computed(() => {
      const u = innerParams.value.imageUrl;
      if (typeof u === "string" && u.trim()) return u.trim();
      return DEFAULT_PANEL_IMAGE_URL;
    });

    const imageObjectFitResolved = computed(() =>
      coercePanelImageObjectFit(innerParams.value.imageObjectFit)
    );

    const timeDisplayModeResolved = computed(() =>
      coerceTimeDisplayMode(innerParams.value.timeDisplayMode)
    );

    function readMapLayersParam(): unknown[] | null {
      const raw = innerParams.value.mapLayers;
      return Array.isArray(raw) ? (raw as unknown[]) : null;
    }

    const openPanelEdit = inject(PANEL_EDIT_INJECTION_KEY, null);

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
      const root = (anchor.closest("section.gridPanel") as HTMLElement) ?? anchor;
      const api = shell.value.api;
      if (api) openPanelEdit(root, panelId.value, panelTitle.value, api, getBusinessParams);
    }

    function renderEmptyAddButton() {
      if (!openPanelEdit) {
        return h("div", { class: "gridPanel__emptyAdd gridPanel__emptyAdd--disabled" }, [
          h("span", { class: "gridPanel__emptyAddIcon", "aria-hidden": "true" }, "+")
        ]);
      }
      return h(
        "button",
        {
          type: "button",
          class: "gridPanel__emptyAdd",
          title: "点击添加内容",
          "aria-label": "添加面板内容",
          onClick: (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            triggerPanelEditDrawer(e.currentTarget as HTMLElement);
          }
        },
        [
          h("span", { class: "gridPanel__emptyAddIcon", "aria-hidden": "true" }, "+"),
          h("span", { class: "gridPanel__emptyAddLabel" }, "添加内容")
        ]
      );
    }

    function renderPanelBody() {
      if (effectiveContent.value === "map") {
        return h(TiandituMapPanel, {
          panelId: panelId.value,
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
        });
      }
      if (effectiveContent.value === "mapControls") {
        return h("div", { class: "gridPanel__mapWrap" }, [
          h(DockviewMapControlsPanel, { params: innerParams.value })
        ]);
      }
      if (effectiveContent.value === "chart") {
        return h(EchartsPanel, { chartKind: chartKindResolved.value ?? "bar" });
      }
      if (effectiveContent.value === "table") {
        return h(DockviewEmbedTablePanel, { params: innerParams.value });
      }
      if (effectiveContent.value === "stats") {
        return h(DockviewStatsPanel, { params: innerParams.value });
      }
      if (effectiveContent.value === "time") {
        return h(DockviewTimePanel, { displayMode: timeDisplayModeResolved.value });
      }
      if (effectiveContent.value === "image") {
        return h("div", { class: "gridPanel__imgWrap" }, [
          h("img", {
            class: "gridPanel__img",
            src: imageUrlResolved.value,
            alt: "",
            draggable: false,
            style: { objectFit: imageObjectFitResolved.value }
          })
        ]);
      }
      return renderEmptyAddButton();
    }

    return () =>
      h(
        "section",
        {
          class: ["gridPanel", isEmptyPanel.value ? "gridPanel--empty" : null]
        },
        [renderPanelBody()]
      );
  }
});
</script>
