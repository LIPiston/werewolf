from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import uuid
import random
import os
import database
from connections import connection_manager
from ws_actions import handle_ws_action
from game_manager import game_manager
from models import Game, Player, GameConfig
import profile_manager

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

profile_manager.ensure_data_dirs()

app.mount("/data/avatars", StaticFiles(directory=profile_manager.AVATARS_DIR), name="avatars")

@app.on_event("startup")
async def startup_event():
    database.create_tables()

# === Profile Management Endpoints ===

class CreateProfileRequest(BaseModel):
    name: str

@app.post("/profiles")
async def create_profile(request: CreateProfileRequest):
    new_player = profile_manager.create_new_player(request.name)
    return new_player

@app.get("/profiles/{player_id}")
async def get_profile(player_id: str):
    profile = profile_manager.read_player_profile(player_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player profile not found")
    return profile

@app.post("/profiles/{player_id}/avatar")
async def upload_avatar(player_id: str, file: UploadFile = File(...)):
    profile = profile_manager.read_player_profile(player_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player profile not found")

    if file.size > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds 8MB limit")

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type, must be an image")

    file_extension = os.path.splitext(file.filename)[1]
    avatar_filename = f"{player_id}{file_extension}"
    avatar_path = os.path.join(profile_manager.AVATARS_DIR, avatar_filename)

    with open(avatar_path, "wb") as buffer:
        buffer.write(await file.read())

    profile['avatar_url'] = f"/data/avatars/{avatar_filename}"
    profile_manager.write_player_profile(player_id, profile)

    return {"avatar_url": profile['avatar_url']}

# === Game Room Endpoints ===

ROLES_CONFIGS = {
    6: {"村民": 2, "狼人": 2, "预言家": 1, "女巫": 1},
    # ... other configs
}

class CreateRoomRequest(BaseModel):
    max_players: int = Field(..., ge=6, le=12)
    host_profile_id: str

@app.post("/room/create")
async def create_room(request: CreateRoomRequest):
    room_id = str(random.randint(100000, 999999))
    while database.get_room(room_id):
        room_id = str(random.randint(100000, 999999))

    roles_config = ROLES_CONFIGS.get(request.max_players, {})
    if not roles_config:
        raise HTTPException(status_code=400, detail="Invalid number of players for role configuration")

    new_room_data = {
        "id": room_id,
        "max_players": request.max_players,
        "status": "waiting",
        "current_day": 0,
        "game_log": [],
        "roles_config": roles_config
    }
    database.insert_room(new_room_data)

    player_id = str(uuid.uuid4())
    new_player_data = {
        "id": player_id,
        "room_id": room_id,
        "profile_id": request.host_profile_id,
        "is_host": True,
        "role": None,
        "is_alive": True
    }
    database.insert_player(new_player_data)

    return {"room_id": room_id, "player_id": player_id, "is_host": True}

class JoinRoomRequest(BaseModel):
    room_id: str
    player_profile_id: str

@app.post("/room/join")
async def join_room(request: JoinRoomRequest):
    room_data = database.get_room(request.room_id)
    if not room_data:
        raise HTTPException(status_code=404, detail="Room not found")

    players_in_room = database.get_players_in_room(request.room_id)
    if len(players_in_room) >= room_data['max_players']:
        raise HTTPException(status_code=400, detail="Room is full")

    player_id = str(uuid.uuid4())
    new_player_data = {
        "id": player_id,
        "room_id": request.room_id,
        "profile_id": request.player_profile_id,
        "is_host": False,
        "role": None,
        "is_alive": True
    }
    database.insert_player(new_player_data)

    return {"room_id": request.room_id, "player_id": player_id, "is_host": False}

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await connection_manager.connect(websocket, room_id, player_id)
    try:
        while True:
            data = await websocket.receive_json()
            await handle_ws_action(websocket, room_id, player_id, data)
    except WebSocketDisconnect:
        connection_manager.disconnect(room_id, player_id)
        await connection_manager.broadcast(room_id, {"type": "PLAYER_DISCONNECTED", "payload": {"player_id": player_id}})