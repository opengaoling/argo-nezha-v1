# Argo Nezha Dashboard V1

这是一个 Argo + Nezha V1 容器部署仓库。镜像通过 GitHub Actions 构建，并发布到 GitHub Packages / GHCR。

定制内容：
- Nezha 面板来源改为 `https://github.com/opengaoling/nezha-geoip-panel`
- 镜像发布到 `ghcr.io/opengaoling/argo-nezha-v1`
- 保留原项目的备份、恢复、Nginx、Cloudflare Tunnel 启动逻辑

备份和恢复脚本修改自 [fscarmen2/Argo-Nezha-Service-Container](https://github.com/fscarmen2/Argo-Nezha-Service-Container)。

## 镜像

```bash
ghcr.io/opengaoling/argo-nezha-v1:latest
```

GitHub Actions 会在 `main` 分支 push 或手动触发时构建多架构镜像：

```text
linux/amd64
linux/arm64
```

## 部署

1. 克隆仓库：

```bash
git clone https://github.com/opengaoling/argo-nezha-v1.git
cd argo-nezha-v1
```

2. 编辑 `.env`：

```bash
nano .env
```

需要填写：

```env
GH_PAT=<填写你的 GitHub PAT，用于备份仓库读写>
GH_BACKUP_USER=<填写你的 GitHub 用户名>
GH_REPO=<填写你用来备份的私有 GitHub 仓库名>
ARGO_AUTH=<填写你的 Cloudflare Tunnel token 或 JSON>
ARGO_DOMAIN=<填写你的面板域名>
```

3. 拉取镜像并启动：

```bash
docker compose pull
docker compose up -d
```

旧版 Docker Compose 也可以使用：

```bash
docker-compose pull
docker-compose up -d
```

## 构建

本仓库使用 `.github/workflows/build-docker-image.yml` 构建镜像。

构建流程：
- 从本仓库 checkout Dockerfile 和部署脚本
- 从 `opengaoling/nezha-geoip-panel` 拉取定制 Nezha 面板源码
- 编译 `/dashboard/app`
- 组装 Nginx、cloudflared、备份恢复脚本
- 推送到 GHCR

手动触发：

```text
GitHub repo -> Actions -> build-docker-image -> Run workflow
```

## 常用命令

```bash
docker compose ps
docker compose logs -f
docker compose pull && docker compose up -d
docker compose restart
docker compose down
```
