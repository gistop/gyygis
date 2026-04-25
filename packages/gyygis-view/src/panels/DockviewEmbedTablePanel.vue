<template>
  <div
    class="gridPanel__tableWrap"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <div v-if="mode === 'empty'" class="tableEmpty">
      <div class="tableEmpty__title">未配置数据源</div>
      <div class="muted tableEmpty__hint">请在右下角编辑抽屉选择图层与字段，然后“应用到面板”。</div>
      <el-table class="dockEmbedTable" :data="sampleRows" stripe border size="small" height="100%" table-layout="fixed">
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

    <div v-else class="tableRemote">
      <div class="tableRemote__meta muted">
        <span>图层：<code>{{ layerName }}</code></span>
        <span v-if="fields.length">字段：{{ fields.join(", ") }}</span>
        <span v-if="total != null">总数：{{ total }}</span>
      </div>
      <el-table
        class="dockEmbedTable"
        :data="remoteRows"
        stripe
        border
        size="small"
        height="100%"
        table-layout="fixed"
        v-loading="loading"
        :row-key="rowKey"
      >
        <el-table-column
          v-for="f in remoteFields"
          :key="f"
          :prop="f"
          :label="f"
          min-width="120"
          show-overflow-tooltip
        />
      </el-table>
      <div v-if="errorMessage" class="muted tableRemote__error">{{ errorMessage }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { SAMPLE_EMBED_TABLE_ROWS } from "@/tables/sampleEmbedTableRows";
import { fetchLayerRows } from "@/api/maps";

const props = defineProps<{
  params?: Record<string, unknown>;
}>();

const sampleRows = SAMPLE_EMBED_TABLE_ROWS;

const layerName = computed(() => String(props.params?.tableLayerName ?? "").trim());
const fields = computed(() => {
  const raw = props.params?.tableFields;
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x).trim()).filter(Boolean);
});

const mode = computed<"empty" | "remote">(() => {
  return layerName.value && fields.value.length ? "remote" : "empty";
});

const loading = ref(false);
const errorMessage = ref("");
const remoteRows = ref<Record<string, unknown>[]>([]);
const remoteFields = ref<string[]>([]);
const total = ref<number | null>(null);

const rowKey = (row: Record<string, unknown>) => {
  const id = row.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : JSON.stringify(row);
};

function statusClass(s: string) {
  if (s === "正常") return "statusPill--ok";
  if (s === "延迟") return "statusPill--warn";
  return "statusPill--off";
}

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}

async function loadRemote() {
  if (mode.value !== "remote") {
    remoteRows.value = [];
    remoteFields.value = [];
    total.value = null;
    errorMessage.value = "";
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await fetchLayerRows({
      layerName: layerName.value,
      fields: fields.value,
      page: 1,
      pageSize: 50
    });
    remoteRows.value = res.rows as Record<string, unknown>[];
    remoteFields.value = res.fields;
    total.value = res.total;
  } catch (e) {
    remoteRows.value = [];
    remoteFields.value = [];
    total.value = null;
    errorMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch([layerName, fields], () => void loadRemote(), { immediate: true });
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

.tableEmpty,
.tableRemote {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.tableEmpty__title {
  padding: 10px 12px 0;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.tableEmpty__hint {
  padding: 2px 12px 10px;
}

.tableRemote__meta {
  padding: 10px 12px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tableRemote__error {
  padding: 8px 12px 10px;
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
::deep(.dockEmbedTable.el-table) {
  --el-table-border-color: rgba(255, 255, 255, 0.12);
  --el-table-header-bg-color: rgba(255, 255, 255, 0.06);
  --el-table-row-hover-bg-color: rgba(96, 165, 250, 0.12);
  --el-table-tr-bg-color: transparent;
  --el-table-expanded-cell-bg-color: rgba(0, 0, 0, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
}

::deep(.dockEmbedTable .el-table__header th) {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
}

::deep(.dockEmbedTable .el-table__body td) {
  color: rgba(255, 255, 255, 0.88);
}

::deep(.dockEmbedTable.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.04);
}
</style>

