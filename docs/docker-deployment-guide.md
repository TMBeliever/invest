# InvestScope Docker 部署指南与准备清单

本文档详细说明如何将 InvestScope（Next.js 16 前端 + Python FastAPI 后端 + SQLite 数据库）进行容器化打包与一键 Docker Compose 部署。

---

## 1. 部署架构与端口映射

InvestScope 采用标准的**多容器架构 (Multi-Container Architecture)**：

- **容器内部服务默认端口**：前端 `3000`，后端 `8000`（保持项目原生结构）。
- **宿主机重映射端口**：
  - 前端服务映射至宿主机 **`3006`** 端口 (`3006:3000`)
  - 后端 API 映射至宿主机 **`8006`** 端口 (`8006:8000`)
- **同源代理转发**： Next.js 通过 `rewrites()` 将 `/api/*` 请求在 Docker 容器网络内部安全代理至 `http://server:8000`。
- **数据库隔离挂载**：挂载宿主机 `./docker-data/db` 至容器内 `/app/docker-db`，通过 `DB_PATH` 环境变量指向独立的 SQLite 数据库文件。

---

## 2. 服务器更新拉起步骤

在服务器上更新并拉起服务：

```bash
# 1. 拉取最新修改
git pull

# 2. 重新构建并启动前端与后端镜像
docker compose up -d --build
```
