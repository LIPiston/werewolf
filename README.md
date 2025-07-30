# 狼人杀游戏项目

这是一个现代化的狼人杀游戏项目，旨在提供一个功能完善、用户友好的在线游戏体验。该项目由 AI 协助开发。

## 项目概览

本项目分为前端和后端两个主要部分，并使用 Docker 进行容器化部署，以便于开发和部署。

### 技术栈

- **前端：** Next.js + Tailwind CSS
- **后端：** Python FastAPI
- **通信：** HTTP / WebSocket
- **容器化：** Docker / Docker Compose

### 游戏规则

本游戏的角色组合和规则将参考 [维基学院：狼人杀/板子](https://zh.m.wikiversity.org/zh-sg/%E7%8B%BC%E4%BA%BA%E6%AE%BA/%E6%9D%BF%E5%AD%90)。

## 快速开始

1. **克隆仓库：**
   ```bash
   git clone <仓库地址>
   cd werewolf
   ```

2. **启动项目：**
   使用 Docker Compose 可以一键启动整个项目：
   ```bash
   docker compose up -d
   ```

   - 前端将在 `http://localhost:6500` 上可用。
   - 后端将在 Docker 内部网络中运行，并通过前端代理访问。

## 项目结构

- `werewolf-app/`：前端应用 (Next.js)
- `werewolf-server/`：后端 API (Python FastAPI)
- `docker-compose.yml`：Docker Compose 配置文件
- `bug.md`：项目当前状态、计划和已知 Bug 列表

## AI 协助开发

本项目在开发过程中得到了 AI 的协助，包括但不限于代码生成、问题诊断和解决方案提供。AI 的参与旨在提高开发效率和代码质量。


## thanks
参考了xiong35/[werewolf](https://github.com/xiong35/werewolf)  
 merakiui