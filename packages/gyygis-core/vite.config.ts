import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gyygisServer = env.GYYGIS_SERVER_URL || "http://localhost:3000";
  const base = env.VITE_PUBLIC_PATH || "/core/";

  return {
    base,
    plugins: [vue()],
    server: {
      port: 5175,
      proxy: {
        "/api": {
          target: gyygisServer,
          changeOrigin: true,
        },
      },
    },
  };
});
