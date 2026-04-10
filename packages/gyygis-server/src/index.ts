import "./env.js";
import { createApp } from "./app.js";
import { config } from "./config/index.js";

if (!config.tiandituKey) {
  console.error(
    "错误: 未设置 TIANDITU_KEY 环境变量，请在 .env 文件中配置或通过环境变量设置"
  );
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`gyygis-server listening on http://localhost:${config.port}`);
});
