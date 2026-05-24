import { ElMessage, ElMessageBox } from "element-plus";
import type { DockviewApi, DockviewPanelApi } from "dockview-core";
import { mergePanelContentParams } from "@/panelContentMode";
import type { DockviewTheme } from "dockview-core";

export function togglePanelMaximize(panelApi: DockviewPanelApi): void {
  try {
    if (panelApi.isMaximized()) {
      panelApi.exitMaximized();
      return;
    }
    panelApi.maximize();
  } catch (e) {
    console.warn("[panelTab] maximize failed", e);
    ElMessage.warning("最大化操作失败");
  }
}

export async function confirmAndClearPanelContent(
  panelApi: DockviewPanelApi,
  businessParams: Record<string, unknown>
): Promise<void> {
  try {
    await ElMessageBox.confirm("清空后此面板将恢复为空槽位，是否继续？", "清空面板", {
      confirmButtonText: "清空",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }

  const id = typeof businessParams.id === "string" ? businessParams.id : panelApi.id;
  const next = mergePanelContentParams({ ...businessParams, id, title: "" }, "auto");
  panelApi.setTitle("");
  panelApi.updateParameters(next);
  ElMessage.success("已清空面板内容");
}

function copyDockviewThemeClassesToWindow(targetWindow: Window): void {
  const classes = new Set<string>();
  for (const el of [document.body, document.getElementById("app")].filter(Boolean) as HTMLElement[]) {
    for (const c of el.classList) {
      if (c.startsWith("dockview-theme-")) classes.add(c);
    }
  }
  for (const c of classes) {
    targetWindow.document.documentElement.classList.add(c);
    targetWindow.document.body.classList.add(c);
  }
}

function applyThemeToPopoutWindow(targetWindow: Window, theme: DockviewTheme | null | undefined): void {
  copyDockviewThemeClassesToWindow(targetWindow);
  if (!theme?.className) return;
  for (const c of theme.className.split(/\s+/)) {
    if (c.trim()) {
      targetWindow.document.documentElement.classList.add(c);
      targetWindow.document.body.classList.add(c);
    }
  }
}

export async function popoutPanelInNewWindow(
  panelApi: DockviewPanelApi,
  containerApi: DockviewApi,
  activeDockTheme?: DockviewTheme | null
): Promise<void> {
  const panel = containerApi.getPanel(panelApi.id);
  if (!panel) {
    ElMessage.warning("未找到要弹出的面板");
    return;
  }

  try {
    const ok = await containerApi.addPopoutGroup(panel, {
      popoutUrl: window.location.href,
      onDidOpen: ({ window: popWin }) => {
        applyThemeToPopoutWindow(popWin, activeDockTheme);
      }
    });
    if (!ok) {
      ElMessage.warning("无法打开新窗口（可能被浏览器拦截）");
    }
  } catch (e) {
    console.warn("[panelTab] popout failed", e);
    ElMessage.warning(e instanceof Error ? e.message : "新窗口打开失败");
  }
}
