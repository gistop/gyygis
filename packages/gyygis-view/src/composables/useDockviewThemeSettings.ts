import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref
} from "vue";
import {
  themeAbyss,
  themeAbyssSpaced,
  themeDark,
  themeDracula,
  themeLight,
  themeLightSpaced,
  themeVisualStudio,
  type DockviewApi,
  type DockviewTheme
} from "dockview-core";
import {
  applyDockviewThemeToDomSubtree,
  syncDockThemeShell
} from "@/dockviewThemeDom";
import { themeGyygisBigScreenBlue } from "@/themes/gyygisDockviewThemes";
import { applyDockviewChromeBorderVarsToElement } from "@/dockviewChromeBorderVars";

export const THEME_PRESETS: { label: string; theme: DockviewTheme }[] = [
  { label: "浅色", theme: themeLight },
  { label: "深色", theme: themeDark },
  { label: "Visual Studio", theme: themeVisualStudio },
  { label: "Abyss", theme: themeAbyss },
  { label: "Dracula", theme: themeDracula },
  { label: "浅色·间距", theme: themeLightSpaced },
  { label: "Abyss·间距", theme: themeAbyssSpaced },
  { label: "大屏·蓝", theme: themeGyygisBigScreenBlue }
];

export function useDockviewThemeSettings(
  dockviewApi: Ref<DockviewApi | null>,
  homeRoot: Ref<HTMLElement | null>
) {
  const dockTheme = ref<DockviewTheme>(themeLight);

  const groupGapPx = ref(6);
  const tabBarHeightPx = ref(35);
  const tabSpacingPx = ref(0);
  const panelPaddingPx = ref(8);
  /** 内容区圆角（地图/表格/图表）；同步写入 --gyygis-panel-content-border-radius 与 Dockview --dv-border-radius */
  const borderRadiusPx = ref(10);
  /** 0 = 边框/分隔线接近全透明，100 = 与主题默认强度一致（相对系数） */
  const frameBorderOpacityPercent = ref(100);
  /** 是否显示各分组的标签栏（标题栏）；对应 Dockview `group.header.hidden` */
  const showPanelTitleBar = ref(true);

  const dockThemeClassName = computed(() => dockTheme.value.className);

  const layoutCssVars = computed(() => ({
    "--dv-tabs-and-actions-container-height": `${tabBarHeightPx.value}px`,
    "--dv-tab-margin": `${tabSpacingPx.value}px`,
    "--gyygis-panel-padding": `${panelPaddingPx.value}px`,
    "--gyygis-panel-content-border-radius": `${borderRadiusPx.value}px`,
    "--dv-border-radius": `${borderRadiusPx.value}px`
  }));

  /** Dockview 在子根上设置 theme 变量，会盖过 main 上的同名自定义属性，故需在该根节点上写回（边框透明度、标签栏高度等 layout 变量同理） */
  function resolveDockviewChromeHostEl(): HTMLElement | null {
    const root = homeRoot.value;
    if (!root) return null;
    const fill = root.querySelector(".dockviewFill");
    const first = fill?.firstElementChild;
    return first instanceof HTMLElement ? first : null;
  }

  function applyLayoutCssVarsToDockviewHost(): void {
    const host = resolveDockviewChromeHostEl();
    if (!host) return;
    const vars = layoutCssVars.value;
    for (const [k, v] of Object.entries(vars)) {
      host.style.setProperty(k, v);
    }
  }

  function applyFrameBorderVarsToDockviewHost(): void {
    const host = resolveDockviewChromeHostEl();
    if (!host) return;
    applyDockviewChromeBorderVarsToElement(
      host,
      frameBorderOpacityPercent.value,
      dockTheme.value.className
    );
  }

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
    await nextTick();
    applyFrameBorderVarsToDockviewHost();
    applyLayoutCssVarsToDockviewHost();
  }

  async function applyThemeAndLayout() {
    applyShellOnly(dockTheme.value);
    await applyDockviewChromeTheme(runtimeDockTheme.value);
  }

  function applyPanelTitleBarVisibility() {
    const api = dockviewApi.value;
    if (!api) return;
    const show = showPanelTitleBar.value;
    for (const group of api.groups) {
      group.header.hidden = !show;
    }
    api.layout(api.width, api.height);
  }

  let disposeOnAddGroup: { dispose(): void } | undefined;

  onMounted(() => {
    void applyThemeAndLayout();
  });

  watch(
    [
      dockTheme,
      groupGapPx,
      tabBarHeightPx,
      tabSpacingPx,
      panelPaddingPx,
      borderRadiusPx,
      dockviewApi,
      homeRoot
    ],
    () => {
      void applyThemeAndLayout();
    },
    { flush: "post" }
  );

  watch(
    [showPanelTitleBar, dockviewApi],
    () => {
      applyPanelTitleBarVisibility();
    },
    { flush: "post" }
  );

  watch([frameBorderOpacityPercent, dockTheme], () => {
    void nextTick(() => {
      applyFrameBorderVarsToDockviewHost();
      applyLayoutCssVarsToDockviewHost();
    });
  });

  watch(
    dockviewApi,
    api => {
      disposeOnAddGroup?.dispose();
      disposeOnAddGroup = undefined;
      if (!api) return;
      disposeOnAddGroup = api.onDidAddGroup(() => {
        applyPanelTitleBarVisibility();
      });
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    disposeOnAddGroup?.dispose();
    disposeOnAddGroup = undefined;
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

  return {
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
  };
}
