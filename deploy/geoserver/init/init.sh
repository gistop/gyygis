#!/bin/bash
set -e
set -x

# 后台执行，不阻塞 GeoServer 主进程（与 kartoza/geoserver 参考部署一致）
(
  sleep 30

  echo "=== 等待 GeoServer Web UI 启动..."
  until curl -s -f "http://localhost:8080/geoserver/web/" > /dev/null; do
    echo "等待 GeoServer Web UI 启动中..."
    sleep 3
  done
  echo "=== GeoServer Web UI 已启动"

  GS_URL="http://localhost:8080/geoserver"
  GS_USER="${GEOSERVER_ADMIN_USER:-admin}"
  GS_PASS="${GEOSERVER_ADMIN_PASSWORD:-geoserver}"

  echo "=== 等待 GeoServer REST API 就绪..."
  until curl -s -f -u "$GS_USER:$GS_PASS" "http://localhost:8080/geoserver/rest/workspaces.json" > /dev/null; do
    echo "等待 GeoServer REST API 就绪..."
    sleep 2
  done
  echo "=== GeoServer REST API 已就绪"

  

  WORKSPACE="geoworkspace"
  STORE="postgis_store"
  LAYER="gyy_points"

  DB_HOST="${INIT_POSTGRES_HOST:-postgis}"
  DB_PORT="${INIT_POSTGRES_PORT:-5432}"
  DB_NAME="${INIT_POSTGRES_DB:-geodb}"
  DB_USER="${INIT_POSTGRES_USER:-postgres}"
  DB_PASS="${INIT_POSTGRES_PASSWORD:-postgres}"

  echo "==> 创建工作区"
  if ! curl -s -f -u "$GS_USER:$GS_PASS" "$GS_URL/rest/workspaces/$WORKSPACE.json" > /dev/null; then
    curl -s -u "$GS_USER:$GS_PASS" -X POST \
      -H "Content-Type: application/xml" \
      -d "<workspace><name>$WORKSPACE</name></workspace>" \
      "$GS_URL/rest/workspaces"
  fi

  echo "==> 创建数据存储"
  if ! curl -s -f -u "$GS_USER:$GS_PASS" "$GS_URL/rest/workspaces/$WORKSPACE/datastores/$STORE.json" > /dev/null; then
    curl -s -u "$GS_USER:$GS_PASS" -X POST \
      -H "Content-Type: application/xml" \
      -d "<dataStore>
  <name>$STORE</name>
  <connectionParameters>
    <host>$DB_HOST</host>
    <port>$DB_PORT</port>
    <database>$DB_NAME</database>
    <user>$DB_USER</user>
    <passwd>$DB_PASS</passwd>
    <dbtype>postgis</dbtype>
  </connectionParameters>
</dataStore>" \
      "$GS_URL/rest/workspaces/$WORKSPACE/datastores"
  fi

  echo "==> 发布图层"
  if ! curl -s -f -u "$GS_USER:$GS_PASS" "$GS_URL/rest/workspaces/$WORKSPACE/datastores/$STORE/featuretypes/$LAYER.json" > /dev/null; then
    curl -s -u "$GS_USER:$GS_PASS" -X POST \
      -H "Content-Type: application/xml" \
      -d "<featureType>
  <name>$LAYER</name>
  <nativeName>$LAYER</nativeName>
  <srs>EPSG:4326</srs>
  <nativeCRS>EPSG:4326</nativeCRS>
  <projectionPolicy>REPROJECT_TO_DECLARED</projectionPolicy>
</featureType>" \
      "$GS_URL/rest/workspaces/$WORKSPACE/datastores/$STORE/featuretypes"
  fi

  echo "=== GeoServer PostGIS 图层初始化完成"
) &
