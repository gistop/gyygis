/** 将边框变量写到含 `dockview-theme-*` 的 Dockview 根节点（该节点上的主题会覆盖从 main 继承的变量） */
export function applyDockviewChromeBorderVarsToElement(
  el: HTMLElement,
  opacityPercent: number,
  themeClassName: string
): void {
  const vars = dockviewChromeBorderStyleVars(opacityPercent, themeClassName);
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
}

/**
 * 生成 Dockview 边框/分隔相关 CSS 变量取值（大屏·蓝用青色系，其它主题用中性灰）。
 */
export function dockviewChromeBorderStyleVars(
  opacityPercent: number,
  themeClassName: string
): Record<string, string> {
  const k = Math.max(0, Math.min(1, opacityPercent / 100));
  const big = themeClassName.includes("gyygis-bigscreen-blue");

  if (big) {
    return {
      "--dv-separator-border": `rgba(0, 180, 220, ${(0.35 * k).toFixed(3)})`,
      "--dv-paneview-header-border-color": `rgba(0, 212, 255, ${(0.22 * k).toFixed(3)})`,
      "--dv-tab-divider-color": `rgba(19, 47, 76, ${Math.min(1, 0.92 * k).toFixed(3)})`,
      "--dv-sash-color": `rgba(0, 212, 255, ${(0.12 * k).toFixed(3)})`,
      "--dv-active-sash-color": `rgba(0, 212, 255, ${(0.55 * k).toFixed(3)})`,
      "--dv-drag-over-border-color": `rgba(0, 212, 255, ${(0.45 * k).toFixed(3)})`,
      "--dv-paneview-active-outline-color": `rgba(0, 212, 255, ${(0.55 * k).toFixed(3)})`
    };
  }

  return {
    "--dv-separator-border": `rgba(120, 120, 120, ${(0.28 * k).toFixed(3)})`,
    "--dv-paneview-header-border-color": `rgba(120, 120, 120, ${(0.2 * k).toFixed(3)})`,
    "--dv-tab-divider-color": `rgba(120, 120, 120, ${(0.22 * k).toFixed(3)})`,
    "--dv-sash-color": `rgba(120, 120, 120, ${(0.14 * k).toFixed(3)})`,
    "--dv-active-sash-color": `rgba(80, 150, 255, ${(0.42 * k).toFixed(3)})`,
    "--dv-drag-over-border-color": `rgba(80, 150, 255, ${(0.32 * k).toFixed(3)})`,
    "--dv-paneview-active-outline-color": `rgba(100, 149, 237, ${(0.35 * k).toFixed(3)})`
  };
}
