# syntax=docker/dockerfile:1.7
# 第一阶段：引用定制 Nezha 面板仓库已构建好的 dashboard 应用
ARG PANEL_IMAGE=ghcr.io/opengaoling/nezha-geoip-panel:latest
FROM ${PANEL_IMAGE} AS app

# 第二阶段：构建最终运行环境
FROM nginx:stable-alpine

LABEL org.opencontainers.image.source="https://github.com/opengaoling/argo-nezha-v1" \
      org.opencontainers.image.description="Argo Nezha V1 with customized GeoIP dashboard"

# 安装必要软件
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache \
        tar \
        gzip \
        tzdata \
        openssl \
        sqlite \
        sqlite-dev \
        dcron \
        coreutils \
        openrc \
        git \
        bash \
        wget && \
    rc-update add dcron

# 拷贝 cloudflared 二进制文件
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/local/bin/cloudflared

# 拷贝 Nezha 应用
COPY --from=app /dashboard/app /dashboard/app
COPY --from=app /dashboard/admin-dist /dashboard/default-frontend/admin-dist
COPY --from=app /dashboard/user-dist /dashboard/default-frontend/user-dist

# 拷贝证书
COPY --from=app /etc/ssl/certs /etc/ssl/certs

# 拷贝 Nginx 配置
COPY main.conf /etc/nginx/conf.d/main.conf

# 设置时区
ENV TZ=Asia/Shanghai

# 设置工作目录
WORKDIR /dashboard

# 准备数据、前端静态资源和可再生成缓存目录
RUN mkdir -p /dashboard/data /dashboard/geoip /dashboard/admin-dist /dashboard/user-dist

# 拷贝本仓库定制前端。前端不编译进 app 二进制，但会随镜像发布，并由 nginx 直接读取。
COPY dashboard/admin-dist /dashboard/default-frontend/admin-dist
COPY dashboard/user-dist /dashboard/default-frontend/user-dist
COPY dashboard/admin-dist /dashboard/admin-dist
COPY dashboard/user-dist /dashboard/user-dist

RUN chmod -R 777 /dashboard

# 拷贝配置和脚本文件
COPY dashboard/data/config.yaml /dashboard/data
COPY backup.sh /dashboard/backup.sh
COPY restore.sh /dashboard/restore.sh
COPY entrypoint.sh /dashboard/entrypoint.sh

# 设置执行权限
RUN chmod +x /dashboard/backup.sh \
    && chmod +x /dashboard/restore.sh \
    && chmod +x /dashboard/entrypoint.sh

# 启动入口
CMD ["/dashboard/entrypoint.sh"]
