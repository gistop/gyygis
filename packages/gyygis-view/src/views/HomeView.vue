<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { DockviewComponent } from "dockview-core";
import type { GroupPanelPartInitParameters } from "dockview-core";

defineOptions({ name: "HomeView" });

/**
 * 与 npm 说明一致：DockviewComponent + createComponent + addPanel；
 * npm 示例里的 `params.containerElement` 为旧 API，v5 为 `element` + `init(parameters)`。
 */
const dockRoot = useTemplateRef<HTMLDivElement>("dockviewRoot");

let dockview: DockviewComponent | null = null;
let stopResize: (() => void) | null = null;

onMounted(() => {
  const el = dockRoot.value;
  if (!el) return;

  dockview = new DockviewComponent(el, {
    createComponent: options => {
      const root = document.createElement("div");
      root.style.cssText =
        "height:100%;box-sizing:border-box;padding:8px;overflow:auto;";
      switch (options.name) {
        case "my-component":
          return {
            element: root,
            init: (parameters: GroupPanelPartInitParameters) => {
              const t = parameters.api.title ?? "Panel";
              root.textContent = `${t} · Hello World`;
            }
          };
        default:
          return {
            element: root,
            init: () => {
              root.textContent = options.name;
            }
          };
      }
    }
  });

  dockview.addPanel({
    id: "panel_1",
    component: "my-component",
    title: "Panel A"
  });
  dockview.addPanel({
    id: "panel_2",
    component: "my-component",
    title: "Panel B",
    position: { referencePanel: "panel_1", direction: "right" },
    inactive: true
  });
  dockview.addPanel({
    id: "panel_3",
    component: "my-component",
    title: "Panel C",
    position: { referencePanel: "panel_1", direction: "below" },
    inactive: true
  });
  dockview.addPanel({
    id: "panel_4",
    component: "my-component",
    title: "Tab in A",
    position: { referencePanel: "panel_1", direction: "within" },
    inactive: true
  });

  const onResize = () => {
    if (dockview) {
      dockview.layout(el.clientWidth, el.clientHeight);
    }
  };
  onResize();
  window.addEventListener("resize", onResize);
  stopResize = () => window.removeEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  stopResize?.();
  stopResize = null;
  dockview?.api.dispose();
  dockview = null;
});
</script>

<template>
  <main class="home">
    <header class="home-header">
      <h1 class="home-title">gyygis-view</h1>
      <p class="home-desc">
        布局由
        <a
          href="https://www.npmjs.com/package/dockview-core"
          target="_blank"
          rel="noopener noreferrer"
          >dockview-core</a
        >
        提供；完整示例见
        <a href="https://dockview.dev" target="_blank" rel="noopener noreferrer"
          >dockview.dev</a
        >。
      </p>
    </header>
    <!-- 文档：主题类挂在容器上，且容器需有确定高度 -->
    <div
      id="dockview-mount"
      ref="dockviewRoot"
      class="dockview-theme-dark dockview-mount"
    />
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0;
  font-family: system-ui, sans-serif;
}

.home-header {
  flex: none;
  padding: 0.75rem 1rem;
}

.home-title {
  margin: 0 0 0.25rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.home-desc {
  margin: 0;
  font-size: 0.875rem;
  color: #666;
}

.home-desc a {
  color: inherit;
}

.dockview-mount {
  flex: 1;
  min-height: 0;
  width: 100%;
}
</style>
