#!/usr/bin/env bash
# 离线环境：将 deploy/images 下的 tar 导入本机 Docker（文件不存在则跳过）
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d ./images ]]; then
  echo "未找到 ./images 目录，跳过镜像导入。"
  exit 0
fi
shopt -s nullglob
for f in ./images/*.tar ./images/*.tar.gz; do
  echo "导入镜像: $f"
  docker load -i "$f"
done
echo "镜像导入流程结束。"
