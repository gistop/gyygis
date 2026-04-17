<template>
  <RouterView />
</template>

<script setup lang="ts"></script>

<style>
/* 全屏壳层：避免 dockview 带 gap 的主题在视口高度上多出 1～2px 导致整页出现滚动条（参见 dockview #934） */
html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    sans-serif;
}
</style>
