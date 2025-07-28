# 当前状态、计划和已知 Bug

## 未完成的功能：
- **游戏角色配置：** 根据 `https://zh.m.wikiversity.org/zh-sg/%E7%8B%BC%E4%BA%BA%E6%AE%BA/%E6%9D%BF%E5%AD%90` 中提供的板子，实现狼人杀游戏的角色组合。这将涉及修改 `werewolf-server` 中的后端逻辑。
- **数据库交互：** 验证并确保使用 SQLite 正确存储和检索玩家信息。（后端：`werewolf-server/database.py`，`werewolf-server/profile_manager.py`）

## 已知 Bug：
- **前端缓存问题：** 尽管代码已更新为 `ws://localhost:8000`，前端仍然尝试连接 `ws://backend:8000` 进行 WebSocket 连接，导致 `net::ERR_NAME_NOT_RESOLVED` 错误。这表明客户端存在持久的浏览器缓存问题。
  - **所需操作：** 用户需要清除浏览器缓存并执行硬刷新（Ctrl+F5 或 Cmd+Shift+R）。

## 计划：
1. **解决前端缓存问题：** 继续引导用户清除浏览器缓存，以确保加载最新的前端代码。
2. **实现游戏逻辑：** 根据用户要求，开始在 `werewolf-server` 中实现游戏角色配置。
3. **验证数据库：** 确认 SQLite 数据库正在正确处理玩家数据。