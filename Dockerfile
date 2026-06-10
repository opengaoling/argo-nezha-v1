# syntax=docker/dockerfile:1.7
# 第一阶段：从定制 Nezha 面板源码构建 dashboard 应用
FROM golang:1.26.4-bookworm AS app

ARG NEZHA_REPO=https://github.com/opengaoling/nezha-geoip-panel.git
ARG NEZHA_REF=master

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends git gcc libc6-dev ca-certificates

WORKDIR /src

RUN git init \
    && git remote add origin "$NEZHA_REPO" \
    && git fetch --depth 1 origin "$NEZHA_REF" \
    && git checkout --detach FETCH_HEAD
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go install github.com/swaggo/swag/cmd/swag@latest
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    swag init --pd -d cmd/dashboard -g main.go -o cmd/dashboard/docs
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 CGO_LDFLAGS="-static" \
    go build -buildvcs=false -trimpath \
    -ldflags "-linkmode external -extldflags -static -s -w" \
    -o /dashboard/app ./cmd/dashboard

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

# 拷贝证书
COPY --from=app /etc/ssl/certs /etc/ssl/certs

# 拷贝 Nginx 配置
COPY main.conf /etc/nginx/conf.d/main.conf

# 设置时区
ENV TZ=Asia/Shanghai

# 设置工作目录
WORKDIR /dashboard

# 准备数据和可再生成缓存目录及权限
RUN mkdir -p /dashboard/data /dashboard/geoip && chmod -R 777 /dashboard

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
