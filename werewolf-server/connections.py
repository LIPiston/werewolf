from fastapi import WebSocket
from typing import Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, player_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][player_id] = websocket

    def disconnect(self, room_id: str, player_id: str):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            del self.active_connections[room_id][player_id]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id].values():
                await connection.send_json(message)

    async def send_to_player(self, room_id: str, player_id: str, message: dict):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            await self.active_connections[room_id][player_id].send_json(message)

connection_manager = ConnectionManager()
