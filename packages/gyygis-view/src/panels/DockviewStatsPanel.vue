<template>
  <div
    class="gridPanel__statsWrap"
    @pointerdown.stop="onBlockDockDrag"
    @mousedown.stop="onBlockDockDrag"
    @touchstart.stop="onBlockDockDrag"
  >
    <div v-if="mode === 'empty'" class="statsEmpty">
      <div class="statsEmpty__title">未配置统计值</div>
      <div class="muted statsEmpty__hint">
        请在右下角编辑抽屉选择「统计值」、已发布图层与数值字段，然后「应用到面板」。仅对数值型列计算平均值、最小值、最大值。
      </div>
    </div>

    <div v-else class="statsRemote">
      <div class="statsRemote__meta muted">
        <span>图层：<code>{{ layerName }}</code></span>
        <span v-if="rows.length">字段数：{{ rows.length }}</span>
      </div>
      <el-table
        class="dockStatsTable"
        :data="rows"
        stripe
        border
        size="small"
        height="100%"
        table-layout="fixed"
        v-loading="loading"
      >
        <el-table-column prop="field" label="字段" min-width="100" show-overflow-tooltip />
        <el-table-column prop="avg" label="平均值" min-width="110" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ formatStat(row.avg) }}</template>
        </el-table-column>
        <el-table-column prop="min" label="最小值" min-width="110" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ formatStat(row.min) }}</template>
        </el-table-column>
        <el-table-column prop="max" label="最大值" min-width="110" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ formatStat(row.max) }}</template>
        </el-table-column>
      </el-table>
      <div v-if="errorMessage" class="muted statsRemote__error">{{ errorMessage }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchLayerStats, type MapLayerFieldStat } from "@/api/maps";

const props = defineProps<{
  params?: Record<string, unknown>;
}>();

const layerName = computed(() => String(props.params?.statsLayerName ?? "").trim());
const fields = computed(() => {
  const raw = props.params?.statsFields;
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x).trim()).filter(Boolean);
});

const mode = computed<"empty" | "remote">(() => {
  return layerName.value && fields.value.length ? "remote" : "empty";
});

const loading = ref(false);
const errorMessage = ref("");
const rows = ref<MapLayerFieldStat[]>([]);

function formatStat(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function onBlockDockDrag(e: Event) {
  e.stopPropagation();
}

async function loadRemote() {
  if (mode.value !== "remote") {
    rows.value = [];
    errorMessage.value = "";
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    rows.value = await fetchLayerStats({
      layerName: layerName.value,
      fields: fields.value
    });
  } catch (e) {
    rows.value = [];
    errorMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch([layerName, fields], () => void loadRemote(), { immediate: true });
</script>

<style scoped>
.gridPanel__statsWrap {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  border-radius: var(--gyygis-panel-content-border-radius, 10px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.dockStatsTable {
  flex: 1;
  min-height: 0;
}

.statsEmpty,
.statsRemote {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.statsEmpty__title {
  padding: 10px 12px 0;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.statsEmpty__hint {
  padding: 2px 12px 10px;
}

.statsRemote__meta {
  padding: 10px 12px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.statsRemote__error {
  padding: 8px 12px 10px;
}

::deep(.dockStatsTable.el-table) {
  --el-table-border-color: rgba(255, 255, 255, 0.12);
  --el-table-header-bg-color: rgba(255, 255, 255, 0.06);
  --el-table-row-hover-bg-color: rgba(96, 165, 250, 0.12);
  --el-table-tr-bg-color: transparent;
  --el-table-expanded-cell-bg-color: rgba(0, 0, 0, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
}

::deep(.dockStatsTable .el-table__header th) {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
}

::deep(.dockStatsTable .el-table__body td) {
  color: rgba(255, 255, 255, 0.88);
}

::deep(.dockStatsTable.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.04);
}
</style>
