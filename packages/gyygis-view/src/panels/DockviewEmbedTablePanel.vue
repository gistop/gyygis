<template>
  <div
    class="gridPanel__tableWrap"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <el-table
      class="dockEmbedTable"
      :data="rows"
      stripe
      border
      size="small"
      height="100%"
      table-layout="fixed"
    >
      <el-table-column prop="layerName" label="图层" min-width="100" show-overflow-tooltip />
      <el-table-column prop="featureCount" label="要素数" width="88" align="right" />
      <el-table-column prop="lastSync" label="最近同步" min-width="132" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="72" align="center">
        <template #default="{ row }">
          <span :class="['statusPill', statusClass(row.status)]">{{ row.status }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { SAMPLE_EMBED_TABLE_ROWS } from "@/tables/sampleEmbedTableRows";

const rows = SAMPLE_EMBED_TABLE_ROWS;

function statusClass(s: string) {
  if (s === "正常") return "statusPill--ok";
  if (s === "延迟") return "statusPill--warn";
  return "statusPill--off";
}

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}
</script>

<style scoped>
.gridPanel__tableWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.dockEmbedTable {
  flex: 1;
  min-height: 0;
}

.statusPill {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.5;
}

.statusPill--ok {
  background: rgba(52, 211, 153, 0.2);
  color: rgba(167, 243, 208, 0.95);
}

.statusPill--warn {
  background: rgba(251, 191, 36, 0.18);
  color: rgba(253, 224, 71, 0.95);
}

.statusPill--off {
  background: rgba(248, 113, 113, 0.16);
  color: rgba(254, 202, 202, 0.92);
}

/* 与 Dockview 深色组背景协调 */
:deep(.dockEmbedTable.el-table) {
  --el-table-border-color: rgba(255, 255, 255, 0.12);
  --el-table-header-bg-color: rgba(255, 255, 255, 0.06);
  --el-table-row-hover-bg-color: rgba(96, 165, 250, 0.12);
  --el-table-tr-bg-color: transparent;
  --el-table-expanded-cell-bg-color: rgba(0, 0, 0, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dockEmbedTable .el-table__header th) {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
}

:deep(.dockEmbedTable .el-table__body td) {
  color: rgba(255, 255, 255, 0.88);
}

:deep(.dockEmbedTable.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.04);
}
</style>
