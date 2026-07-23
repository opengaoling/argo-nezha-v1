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
# 可选：直接挂载独立前端仓库，修改文件后实时生效
ADMIN_FRONTEND_DIR=/absolute/path/to/nezha-geoip-frontend/admin-dist
USER_FRONTEND_DIR=/absolute/path/to/nezha-geoip-frontend/user-dist
```

前端与后端运行时分离：Compose 将后台和前台资源分别挂载到
`/dashboard/admin-dist`、`/dashboard/user-dist`。如果不设置上述两个变量，默认使用
`./dashboard/admin-dist` 和 `./dashboard/user-dist`，首次启动时会从镜像内置资源自动初始化。
设置为独立前端仓库的绝对路径后，修改 `index.html`、JS、CSS 或图片都会由面板和
Nginx 在后续请求中直接读取，不需要重建镜像或重启容器；浏览器仍可能需要强制刷新。

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
- 引用 `opengaoling/nezha-geoip-panel` 已发布的面板应用镜像
- 从面板应用镜像复制 `/dashboard/app`
- 组装 Nginx、cloudflared、备份恢复脚本
- 推送到 GHCR

面板仓库需先构建并发布：

```text
opengaoling/nezha-geoip-panel -> Actions -> build-dashboard-app-image
```

本仓库会按面板仓库 `master` 最新 commit 短 SHA 引用：

```text
ghcr.io/opengaoling/nezha-geoip-panel:<sha>
```

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

## 前端实时更新

确认当前挂载来源：

```bash
docker inspect argo-nezha-v1 --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

修改独立前端仓库后直接刷新页面即可。`index.html` 和静态资源都使用禁用缓存响应；如果前面
还有 Cloudflare 缓存规则，应对 `/assets/*`、`/dashboard/assets/*` 和 HTML 页面禁用缓存。

如需临时回到镜像默认前端，删除 `.env` 中的 `ADMIN_FRONTEND_DIR`、
`USER_FRONTEND_DIR`，然后重建容器。默认目录会在首次启动时由镜像自动填充。
