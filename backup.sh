#!/bin/bash

# 定义备份保留天数
DAYS=5

# 设置默认值
WORK_DIR=${WORK_DIR:-"/dashboard"}  # 默认 WORK_DIR 为 /dashboard

# 确保环境变量已设置
[ -z "$GH_PAT" ] && { echo -e "\033[31m\033[01m错误: GH_PAT 未设置\033[0m"; exit 1; }
[ -z "$GH_BACKUP_USER" ] && { echo -e "\033[31m\033[01m错误: GH_BACKUP_USER 未设置\033[0m"; exit 1; }
[ -z "$GH_REPO" ] && { echo -e "\033[31m\033[01m错误: GH_REPO 未设置\033[0m"; exit 1; }
[ -z "$GH_EMAIL" ] && GH_EMAIL="backup@example.com"  # 默认邮箱
[ -z "$WORK_DIR" ] && { echo -e "\033[31m\033[01m错误: WORK_DIR 未设置\033[0m"; exit 1; }
[ ! -d "$WORK_DIR/data" ] && { echo -e "\033[31m\033[01m错误: $WORK_DIR/data 目录不存在\033[0m"; exit 1; }

# 定义日志函数
info() { echo -e "\033[32m\033[01m[INFO] $*\033[0m"; }
error() { echo -e "\033[31m\033[01m[ERROR] $*\033[0m"; exit 1; }
hint() { echo -e "\033[33m\033[01m[HINT] $*\033[0m"; }

# 清理临时目录
cleanup() {
    [ -d "/tmp/$GH_REPO" ] && rm -rf "/tmp/$GH_REPO"
}
trap "cleanup; echo -e '\n'; exit" INT QUIT TERM EXIT

# 克隆现有备份库
cleanup
git clone "https://${GH_PAT}@github.com/${GH_BACKUP_USER}/${GH_REPO}.git" --depth 1 --quiet "/tmp/$GH_REPO"
[ $? -ne 0 ] && error "克隆 GitHub 仓库失败"

# 压缩备份数据，只备份 $WORK_DIR/data/ 目录下的 config.yaml 和 sqlite.db
if [ -d "/tmp/$GH_REPO" ]; then
    TIME=$(date "+%Y-%m-%d-%H:%M:%S")
    echo "↓↓↓↓↓↓↓↓↓↓ dashboard-$TIME.tar.gz list ↓↓↓↓↓↓↓↓↓↓"
    tar czvf "/tmp/$GH_REPO/dashboard-$TIME.tar.gz" \
        --exclude="data/tsdb" \
        --exclude="data/geoip.db" \
        --exclude="data/asn.mmdb" \
        --exclude="data/GeoLite2-ASN.mmdb" \
        -C "$WORK_DIR" data/
    echo -e "↑↑↑↑↑↑↑↑↑↑ dashboard-$TIME.tar.gz list ↑↑↑↑↑↑↑↑↑↑\n"

    # 更新备份 GitHub 库
    cd "/tmp/$GH_REPO" || error "无法进入 /tmp/$GH_REPO"
    [ -e ./.git/index.lock ] && rm -f ./.git/index.lock
    echo "dashboard-$TIME.tar.gz" > README.md
    
    # ------------------ 修改部分开始 ------------------
    # 删除超过 5 天的备份文件
    info "开始清理超过 ${DAYS} 天的旧备份文件..."
    
    # 获取当前日期
    current_date_seconds=$(date -d "$(date +%Y-%m-%d)" +%s)
    
    for file in $(find . -name 'dashboard-*.tar.gz' -type f); do
        # 从文件名中提取日期
        file_name=$(basename "$file")
        file_date_str=$(echo "$file_name" | cut -d'-' -f2-4)
        file_date_seconds=$(date -d "$file_date_str" +%s 2>/dev/null)
        
        # 确保日期解析成功
        if [ $? -eq 0 ]; then
            # 计算日期差值（以天为单位）
            diff_seconds=$((current_date_seconds - file_date_seconds))
            diff_days=$((diff_seconds / 86400)) # 86400秒 = 1天
            
            if [ "$diff_days" -ge "$DAYS" ]; then
                hint "删除旧备份文件: $file_name (已存在 ${diff_days} 天)"
                rm -f "$file"
            fi
        else
            hint "无法解析文件名中的日期: $file_name"
        fi
    done
    
    info "旧备份文件清理完成。"
    # ------------------ 修改部分结束 ------------------

    export GIT_AUTHOR_NAME="$GH_BACKUP_USER"
    export GIT_AUTHOR_EMAIL="$GH_EMAIL"
    export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
    export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
    git checkout main || git checkout -b main
    git add .
    git commit -m "Backup at $TIME" --quiet
    git push -u origin main --quiet
    IS_UPLOAD="$?"
    
    # 设置标志文件
    if [ "$IS_UPLOAD" = 0 ]; then
        echo "dashboard-$TIME.tar.gz" > "$WORK_DIR/dbfile"
        info "成功上传备份文件 dashboard-$TIME.tar.gz 到 GitHub"
    else
        error "上传备份文件 dashboard-$TIME.tar.gz 到 GitHub 失败"
    fi
    
    # 清理临时目录
    cd ..
    cleanup
else
    error "临时目录 /tmp/$GH_REPO 不存在"
fi
