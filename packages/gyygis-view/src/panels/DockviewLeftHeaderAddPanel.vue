<template>
  <div class="dvHeaderAddShell">
    <button
      type="button"
      class="dvHeaderAddBtn"
      title="添加面板"
      aria-label="添加面板"
      @pointerdown.stop.prevent
      @click.stop.prevent="onAdd"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import type { IDockviewHeaderActionsProps } from "dockview-core";

const props = defineProps<{
  params: IDockviewHeaderActionsProps;
}>();

function onAdd() {
  const { containerApi, group } = props.params;
  if (!containerApi || !group) return;

  const id = `panel_${Date.now()}`;
  containerApi.addPanel({
    id,
    component: "GridPanel",
    title: "新面板",
    params: { id, title: "新面板" },
    position: { referenceGroup: group }
  });
}
</script>

<style scoped>
.dvHeaderAddShell {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: var(--dv-tabs-and-actions-container-height, 35px);
}

.dvHeaderAddBtn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0 4px 0 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--dv-activegroup-visiblepanel-tab-color, rgba(255, 255, 255, 0.88));
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
}

.dvHeaderAddBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(120, 200, 255, 0.45);
}
</style>
