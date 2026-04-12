import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || 5176;
  const apiTarget = env.GYYGIS_SERVER_URL || "http://localhost:3000";

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      port,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    }
  };
});
