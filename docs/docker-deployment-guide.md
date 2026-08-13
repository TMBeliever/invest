# InvestScope Docker 部署指南与准备清单

本文档详细说明如何将 InvestScope（Next.js 16 前端 + Python FastAPI 后端 + SQLite 数据库）进行容器化打包与一键 Docker Compose 部署。

---

## 1. 部署架构与端口映射

InvestScope 采用标准的**多容器架构 (Multi-Container Architecture)**：

- **容器内部服务默认端口**：前端 `3000`，后端 `8000`（保持项目原生干净结构）。
- **宿主机重映射端口**：
  - 前端服务映射至宿主机 **`8006`** 端口 (`8006:3000`)
  - 后端 API 映射至宿主机 **`3006`** 端口 (`3006:8000`)

```
                             外部浏览器 / 用户访问
                                      │
                         ┌────────────┴────────────┐
                         │   宿主机暴露端口        │
                         │   Web: 8006 / API: 3006 │
                         └────────────┬────────────┘
                                      │
                     ┌────────────────┴──────────────┐
                     │     Docker Compose 虚拟网络   │
                     │                               │
                     │   ┌───────────────────────┐   │
                     │   │   web 容器 (Next.js)  │   │
                     │   │   Node.js 20-alpine   │   │
                     │   │   容器内端口: 3000    │   │
                     │   └───────────┬───────────┘   │
                     │               │               │
                     │               ▼               │
                     │   ┌───────────────────────┐   │
                     │   │ server 容器(FastAPI)  │   │
                     │   │ Python 3.11-slim      │   │
                     │   │ 容器内端口: 8000      │   │
                     │   └───────────┬───────────┘   │
                     └───────────────┼───────────────┘
                                     │ (Volume Mount)
                         ┌───────────▼───────────┐
                         │  宿主机 SQLite 挂载卷  │
                         │  ./docker-data/db/    │
                         └───────────────────────┘
```

---

## 2. 配置文件清单

| 文件路径 | 作用说明 | 端口说明 |
| :--- | :--- | :--- |
| **`docker-compose.yml`** | 根目录容器编排文件，宿主机端口映射 | 前端 `8006:3000`，后端 `3006:8000` |
| **`server/Dockerfile`** | FastAPI 后端镜像构建脚本 | 容器内暴露 `8000` |
| **`apps/web/Dockerfile`** | Next.js 前端 Multi-Stage 构建脚本 | 容器内暴露 `3000` |
| **`server/requirements.txt`** | Python 后端依赖包清单 | — |
| **`.dockerignore`** | 根目录构建过滤规则 | — |

---

## 3. 核心 `docker-compose.yml` 示例

```yaml
version: '3.8'

services:
  # 1. Python FastAPI 后端服务 (宿主机 3006 -> 容器 8000)
  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: investscope-server
    restart: always
    ports:
      - "3006:8000"
    volumes:
      - ./docker-data/db:/app/app/data
    environment:
      - PYTHONUNBUFFERED=1
      - TZ=Asia/Shanghai

  # 2. Next.js 前端服务 (宿主机 8006 -> 容器 3000)
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: investscope-web
    restart: always
    ports:
      - "8006:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3006
      - TZ=Asia/Shanghai
    depends_on:
      - server
```

---

## 4. 启动与访问

```bash
# 一键启动服务
docker compose up -d --build

# 访问服务：
# 前端页面：http://<服务器IP>:8006
# 后端 API：http://<服务器IP>:3006
```
