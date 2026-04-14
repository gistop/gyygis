import type { DockviewTheme } from "dockview-core";

function stripDockviewThemeClasses(el: Element) {
  const html = el as HTMLElement;
  for (const c of [...html.classList]) {
    if (c.startsWith("dockview-theme-")) {
      html.classList.remove(c);
    }
  }
}

function addThemeClasses(el: Element, theme: DockviewTheme) {
  const html = el as HTMLElement;
  for (const c of theme.className.split(/\s+/)) {
    if (c.trim()) {
      html.classList.add(c);
    }
  }
}

/**
 * 在部分环境下仅 updateOptions({ theme }) 不足以让所有带 dockview-theme-* 的节点更新（含浮动层），
 * 与 React demo 中对 dv 根节点做 DOM 处理思路一致。
 */
export function applyDockviewThemeToDomSubtree(
  root: HTMLElement | null | undefined,
  theme: DockviewTheme
) {
  if (!root) {
    return;
  }
  if (root.matches("[class*='dockview-theme']")) {
    stripDockviewThemeClasses(root);
    addThemeClasses(root, theme);
  }
  root.querySelectorAll<HTMLElement>("[class*='dockview-theme']").forEach(el => {
    stripDockviewThemeClasses(el);
    addThemeClasses(el, theme);
  });
}

export function syncDockThemeShell(theme: DockviewTheme) {
  for (const el of [document.body, document.getElementById("app")].filter(
    Boolean
  ) as HTMLElement[]) {
    stripDockviewThemeClasses(el);
    addThemeClasses(el, theme);
  }
}
