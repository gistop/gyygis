# 部署说明（开发机只写文件，阿里云上构建运行）

## 在 Cursor / 开发机上要做的事

1. **维护业务代码**（`packages/*`）与 **`deploy/`** 下的 Compose、Dockerfile、`.env.example`、PostGIS/GeoServer/pgAdmin 初始化与 **Nginx** 配置。
2. **不要**在本机安装 Docker Desktop（除非你本地也想跑容器）。
3. 将**整个仓库**同步到阿里云（任选其一）：
   - `git push` 后在服务器 `git clone` / `git pull`；
   - 或用 `scp` / `rsync` 上传项目目录（需包含 `pnpm-lock.yaml`）。
4. 提交前确认：敏感信息只放在 **`.env`**（已忽略提交），不要写进镜像或脚本。

## 在阿里云 Linux 上要做的事

1. 安装 **Docker Engine** 与 **Compose 插件**（`docker compose`）。若离线环境只有独立二进制，可将 `docker-compose-linux-x86_64` 放到服务器并 `chmod +x` 后使用（与参考部署包相同做法）。
2. **（可选）离线镜像**：把 `docker save` 得到的 tar 放到 `deploy/images/`，在 `deploy` 目录执行：

   ```bash
   chmod +x load-images.sh geoserver/init/init.sh
   ./load-images.sh
   ```

3. 进入 **`deploy`** 目录（`context: ..` 会指向仓库根）：

   ```bash
   cd /path/to/gyygis/deploy
   cp .env.example .env
   # 编辑 .env，至少填写 TIANDITU_KEY
   docker compose build
   docker compose up -d
   ```

4. **安全组 / 防火墙**：放行 `NGINX_HTTP_PORT`（默认 80）、`API_PORT`、`POSTGIS_PORT`（按需；若不直连容器 API 可不放行 `API_PORT`）。
5. 查看状态：`docker compose ps`；日志示例：`docker compose logs -f api`、`docker compose logs -f geoserver`。

## 访问地址（默认端口）

| 服务 | 说明 |
|------|------|
| **Nginx 网关** | `http://<IP>/` 导航页；`http://<IP>/api/` → gyygis-server；`http://<IP>/geoserver/` → GeoServer |
| API（直连容器） | `http://<IP>:3000` |
| 管理端 | `http://<IP>/admin/` |
| 用户端 | `http://<IP>/view/` |
| Core / 地图演示 | `http://<IP>/core/` |
| pgAdmin | `http://<IP>/pgadmin/`（账号见 `.env` 中 `PGADMIN_DEFAULT_*`） |
| PostGIS | 宿主机 `POSTGIS_PORT`（默认 5432），库名 `geodb`；容器内主机名 `postgis` |

**GeoServer** 默认：`admin` / `geoserver`，由 `.env` 中 `GEOSERVER_ADMIN_*` 注入容器，初始化脚本会读取同名环境变量。

若修改 **Postgres 密码**（`POSTGRES_PASSWORD`），请同步更新 `deploy/pgadmin/servers.json` 中的 `Password` 字段，或在 pgAdmin 里重新保存连接。

**前端经统一域名子路径部署**（例如 `/admin/`）需要为各包配置 Vite `base` / `VITE_PUBLIC_PATH` 并调整 Nginx，本仓库 Compose 已按此方式收敛到网关子路径访问。

生产环境建议在网关前再使用 **HTTPS**（证书终止在负载均衡或 Nginx）。

## PostGIS 增量迁移（已有数据卷）

若数据库在 `migrate-add-web-map-services.sql` 之后未更新，请在 PostGIS 上执行 `deploy/postgis/migrate-web-map-tile-key-mode.sql`（或重新执行已追加该段落的 `migrate-add-web-map-services.sql`），否则 `tile_key_mode` 列缺失会导致 `/api/web-map-services` 报错。
