import asyncio
import json
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict

from models import (
    GameState, GameConfig, RoomCreateRequest, RoomCreateResponse, 
    RoomJoinRequest, RoomJoinResponse, ReadyPayload, ActionPayload, 
    VotePayload, SpeechDonePayload, ConnectedPayload, GAME_TEMPLATES
)
from game_manager import game_manager
from connections import connection_manager

app = FastAPI()

origins = [
    "http://localhost:6500",
    "http://127.0.0.1:6500",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "a_very_secret_key"

def create_player_token(player_id: str, room_id: str) -> str:
    return f"{player_id}:{room_id}"

def verify_player_token(token: str) -> Dict[str, str]:
    try:
        player_id, room_id = token.split(":")
        return {"player_id": player_id, "room_id": room_id}
    except (ValueError, AttributeError):
        return None

@app.get("/api/game-templates")
async def get_game_templates():
    return GAME_TEMPLATES

@app.post("/api/room", response_model=RoomCreateResponse)
async def create_room(request: RoomCreateRequest):
    game = await game_manager.create_game(request.host_name, request.config)
    token = create_player_token(game.host_id, game.room_id)
    return RoomCreateResponse(
        room_id=game.room_id,
        host_player_id=game.host_id,
        token=token
    )

@app.post("/api/room/{room_id}/join", response_model=RoomJoinResponse)
async def join_room(room_id: str, request: RoomJoinRequest):
    game = game_manager.get_game(room_id)
    if not game:
        raise HTTPException(status_code=404, detail="Room not found")
    
    player = await game_manager.join_game(room_id, request.player_name)
    if not player:
        raise HTTPException(status_code=400, detail="Room is full or game has started")
        
    token = create_player_token(player.id, room_id)
    return RoomJoinResponse(player_id=player.id, token=token)

@app.get("/api/room/{room_id}/state", response_model=GameState)
async def get_room_state(room_id: str):
    game = game_manager.get_game(room_id)
    if not game:
        raise HTTPException(status_code=404, detail="Room not found")
    return game

async def parse_ws_message(ws: WebSocket, data: Any) -> Dict[str, Any]:
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            await ws.send_text("Invalid JSON format.")
            return None
    
    if not isinstance(data, dict) or "type" not in data or "payload" not in data:
        await ws.send_text("Invalid message structure.")
        return None
    return data

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    token_data = verify_player_token(token)
    if not token_data:
        await websocket.close(code=1008, reason="Invalid token")
        return

    player_id = token_data["player_id"]
    room_id = token_data["room_id"]
    
    game = game_manager.get_game(room_id)
    if not game or not any(p.id == player_id for p in game.players):
        await websocket.close(code=1008, reason="Player or Room not found")
        return

    await connection_manager.connect(websocket, room_id, player_id)
    
    connected_payload = ConnectedPayload(player_id=player_id, room_id=room_id)
    await websocket.send_json({"type": "CONNECTED", "payload": connected_payload.dict()})
    
    await game_manager.broadcast_stage_change(room_id, game.timer)

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = await parse_ws_message(websocket, raw_data)
            if not data: continue

            msg_type = data.get("type")
            payload = data.get("payload")

            if msg_type == "READY":
                await game_manager.set_player_ready(room_id, player_id, payload.get("ready", False))
            elif msg_type == "ACTION":
                await game_manager.record_player_action(room_id, player_id, payload.get("action"), payload.get("target"))
            elif msg_type == "VOTE":
                await game_manager.record_player_vote(room_id, player_id, payload.get("target"))

    except WebSocketDisconnect:
        connection_manager.disconnect(room_id, player_id)

@app.get("/health")
async def health_check():
    return {"status": "ok"}