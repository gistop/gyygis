# 部署说明（开发机只写文件，阿里云上构建运行）

## 在 Cursor / 开发机上要做的事

1. **维护业务代码**（`packages/*`）与 **`deploy/`** 下的 Compose、Dockerfile、`.env.example`。
2. **不要**在本机安装 Docker Desktop（除非你本地也想跑容器）。
3. 将**整个仓库**同步到阿里云（任选其一）：
   - `git push` 后在服务器 `git clone` / `git pull`；
   - 或用 `scp` / `rsync` 上传项目目录（需包含 `pnpm-lock.yaml`）。
4. 提交前确认：敏感信息只放在 **`.env`**（已忽略提交），不要写进镜像或脚本。

## 在阿里云 Linux 上要做的事

1. 安装 **Docker Engine** 与 **Compose 插件**（`docker compose`）。
2. 进入本目录的**父目录**（即仓库根）或在本目录执行时带上路径，保证 `docker-compose.yml` 里 `context: ..` 能指向仓库根：

   ```bash
   cd /path/to/gyygis/deploy
   cp .env.example .env
   # 编辑 .env，至少填写 TIANDITU_KEY
   docker compose build
   docker compose up -d
   ```

3. **安全组 / 防火墙**放行 `API_PORT`、`ADMIN_PORT`、`VIEW_PORT`（默认 3000、8081、8082）。
4. 查看状态：`docker compose ps`；日志：`docker compose logs -f api`。

## 访问地址（默认端口）

| 服务 | URL |
|------|-----|
| API | `http://<服务器IP>:3000` |
| 管理端 | `http://<服务器IP>:8081` |
| 用户端 | `http://<服务器IP>:8082` |
| Core / 地图演示（`packages/gyygis-core`） | `http://<服务器IP>:8083` |

生产环境建议在前面加 **Nginx/Caddy** 做 HTTPS 与统一域名，本 Compose 仅作最小可运行示例。
