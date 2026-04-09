<template>
  <div class="root">
    <div class="topbar">
      <button class="tab" type="button" :data-active="demo === 'cog'" @click="demo = 'cog'">
        COG Demo
      </button>
      <button class="tab" type="button" :data-active="demo === 'gpq'" @click="demo = 'gpq'">
        GeoParquet Demo
      </button>
      <div class="spacer"></div>
      <div class="hint">gyygis-core playground</div>
    </div>

    <div class="stage">
      <CogLayerDemo v-if="demo === 'cog'" />
      <GpqLayerDemo v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import CogLayerDemo from "./CogLayerDemo.vue";
import GpqLayerDemo from "./GpqLayerDemo.vue";

const demo = ref<"cog" | "gpq">("cog");
</script>

<style scoped>
.root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.topbar {
  position: absolute;
  left: 46px;
  bottom: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(20, 20, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #fff;
  backdrop-filter: blur(6px);
}

.tab {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}

.tab[data-active="true"] {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.35);
}

.spacer {
  width: 10px;
}

.hint {
  font-size: 12px;
  opacity: 0.9;
}

.stage {
  width: 100%;
  height: 100%;
}
</style>

