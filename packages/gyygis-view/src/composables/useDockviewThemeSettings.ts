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
  const borderRadiusPx = ref(0);
  /** 是否显示各分组的标签栏（标题栏）；对应 Dockview `group.header.hidden` */
  const showPanelTitleBar = ref(true);

  const dockThemeClassName = computed(() => dockTheme.value.className);

  const layoutCssVars = computed(() => ({
    "--dv-tabs-and-actions-container-height": `${tabBarHeightPx.value}px`,
    "--dv-tab-margin": `${tabSpacingPx.value}px`,
    "--gyygis-panel-padding": `${panelPaddingPx.value}px`,
    "--dv-border-radius": `${borderRadiusPx.value}px`
  }));

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
    showPanelTitleBar,
    setDockTheme
  };
}
