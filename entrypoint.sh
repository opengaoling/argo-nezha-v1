#!/bin/bash

# 设置默认值
WORK_DIR=${WORK_DIR:-"/dashboard"}  # 默认 WORK_DIR 为 /dashboard

# 定义日志函数
info() { echo -e "\033[32m\033[01m[INFO] $*\033[0m"; }
error() { echo -e "\033[31m\033[01m[ERROR] $*\033[0m"; exit 1; }

# 检查备份和恢复脚本是否存在
[ ! -f "$WORK_DIR/backup.sh" ] && error "备份脚本 $WORK_DIR/backup.sh 不存在"
[ ! -f "$WORK_DIR/restore.sh" ] && error "恢复脚本 $WORK_DIR/restore.sh 不存在"

# 配置定时备份任务
info "配置定时备份任务..."
mkdir -p "$WORK_DIR/logs" || error "无法创建日志目录 /logs"
chmod 755 $WORK_DIR/logs || error "无法设置 /logs 目录权限"
echo "3 3 * * * $WORK_DIR/backup.sh > $WORK_DIR/logs/backup.log 2>&1 # NEZHA-V1-BACKUP" > /var/spool/cron/crontabs/root

# 首次启动或本地数据缺失时才恢复备份。容器重建时如果挂载数据已存在，
# 不应让远端旧备份覆盖用户刚在面板里保存的配置和数据库。
if [ ! -s "$WORK_DIR/data/sqlite.db" ] || [ ! -s "$WORK_DIR/data/config.yaml" ]; then
    info "本地数据缺失，尝试恢复备份..."
    $WORK_DIR/restore.sh || { info "恢复备份失败"; }
else
    info "检测到本地数据，跳过启动时恢复备份。"
fi

seed_frontend() {
    local name="$1"
    local target="$WORK_DIR/$name"
    local source="$WORK_DIR/default-frontend/$name"

    if [ -s "$target/index.html" ]; then
        return 0
    fi
    [ ! -d "$source" ] && error "默认前端资源 $source 不存在"
    info "初始化前端资源: $name"
    mkdir -p "$target" || error "无法创建前端目录 $target"
    cp -a "$source"/. "$target"/ || error "无法初始化前端资源 $name"
}

seed_frontend "admin-dist"
seed_frontend "user-dist"

# 启动 crond
info "启动 cron 定时任务服务..."
crond

# 启动 dashboard app
info "启动 dashboard app..."
$WORK_DIR/app &
sleep 3

# 检查并生成证书
if [ -n "$ARGO_DOMAIN" ]; then
    info "正在生成域名证书: $ARGO_DOMAIN"
    openssl genrsa -out "$WORK_DIR/nezha.key" 2048
    openssl req -new -subj "/CN=$ARGO_DOMAIN" -key "$WORK_DIR/nezha.key" -out "$WORK_DIR/nezha.csr"
    openssl x509 -req -days 36500 -in "$WORK_DIR/nezha.csr" -signkey "$WORK_DIR/nezha.key" -out "$WORK_DIR/nezha.pem"
else
    info "警告: 未设置 ARGO_DOMAIN, 跳过生成证书"
fi

# 启动 Nginx
info "启动 Nginx..."
nginx -g "daemon off;" &
sleep 3

# 启动 cloudflared
if [ -n "$ARGO_AUTH" ]; then
    info "启动 cloudflared..."
    cloudflared --no-autoupdate tunnel run --protocol http2 --token "$ARGO_AUTH" >/dev/null 2>&1 &
else
    info "警告: 未设置 ARGO_AUTH，正在跳过执行 cloudflared"
fi

# 等待所有后台进程
wait
