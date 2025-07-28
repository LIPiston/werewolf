werewolf-app文件夹是前端 

werewolf-server是后端 

werewolf是参考代码（不能修改里面的任何文件只能查看）

用参考代码来制作现代化的新版本狼人杀
使用 https://zh.m.wikiversity.org/zh-sg/%E7%8B%BC%E4%BA%BA%E6%AE%BA/%E6%9D%BF%E5%AD%90 的板子来配置狼人杀人数组合
思考流程使用中文，可以使用docker进行调试程序


| 层级   | 技术/组件        | 说明与配置                           |
|--------|------------------|--------------------------------------|
| 前端   | Next.js + tailwindcss   | 容器名：`frontend`，内部端口 3000   |
|        | Dockerfile       | 构建并暴露 3000，映射到宿主机 80     |
| 后端   | Python FastAPI   | 容器名：`backend`，内部端口 8000    |
|        | Dockerfile       | 构建并暴露 8000，仅内网访问          |
|数据库|SQLite|储存玩家信息|
| 通信   | HTTP/WebSocket   | 前端通过 `http://backend:8000` 调用 |
| 网络   | 端口映射         | 宿主 80 → 前端 3000（公网可访问）    |
| 启动   | docker-compose   | 一键 `docker compose up -d` 上线     |