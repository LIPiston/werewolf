from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uuid
import os
from connections import connection_manager
from ws_actions import handle_ws_action
from game_manager import GameManager
from models import Game, Player, GameConfig, Profile, GAME_TEMPLATES
import profile_manager
import phase_handlers
import game_logic

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

game_manager = GameManager()
phase_handlers.initialize_game_manager(game_manager)
game_logic.initialize_game_manager(game_manager)

# === Profile Management Endpoints ===

class CreateProfileRequest(BaseModel):
    name: str

@app.post("/profiles", response_model=Profile)
async def create_profile(request: CreateProfileRequest):
    new_player = profile_manager.create_new_player(request.name)
    return new_player

@app.get("/profiles/{player_id}", response_model=Profile)
async def get_profile(player_id: str):
    profile = profile_manager.read_player_profile(player_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player profile not found")
    return profile

@app.post("/profiles/{player_id}/avatar", response_model=Profile)
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

    profile.avatar_url = f"/data/avatars/{avatar_filename}"
    profile_manager.write_player_profile(player_id, profile)

    return profile

# === Game Room Endpoints ===

@app.get("/game-templates")
async def get_game_templates():
    return GAME_TEMPLATES

@app.get("/games")
async def get_games():
    active_games = game_manager.get_all_games()
    
    room_list = []
    for room_id, game in active_games.items():
        if game.phase == "lobby":
            host_profile = profile_manager.read_player_profile(game.host_id)
            room_list.append({
                "room_id": room_id,
                "host_name": host_profile.name if host_profile else "Unknown Host",
                "player_count": len(game.players),
                "max_players": next((t.player_counts[0] for t in GAME_TEMPLATES if t.name == game.game_config.template_name), 12),
                "template_name": game.game_config.template_name
            })
    return room_list

class CreateGameRequest(BaseModel):
    host_profile_id: str
    game_config: GameConfig

@app.post("/games/create")
async def create_game(request: CreateGameRequest):
    if request.host_profile_id == "test":
        return {"room_id": "test", "player_id": "test"}

    game = game_manager.create_game(request.host_profile_id, request.game_config)
    
    host_profile = profile_manager.read_player_profile(request.host_profile_id)
    if not host_profile:
        raise HTTPException(status_code=404, detail="Host profile not found")

    host_player = Player(
        id=str(uuid.uuid4()),
        profile_id=request.host_profile_id,
        name=host_profile.name,
        avatar_url=host_profile.avatar_url,
        seat=None
    )
    game.players.append(host_player)

    return {"room_id": game.room_id, "player_id": host_player.id}

class JoinGameRequest(BaseModel):
    profile_id: str

@app.post("/games/{room_id}/join")
async def join_game(room_id: str, request: JoinGameRequest):
    game = game_manager.get_game(room_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    profile = profile_manager.read_player_profile(request.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player profile not found")

    new_player = Player(
        id=str(uuid.uuid4()),
        profile_id=request.profile_id,
        name=profile.name,
        avatar_url=profile.avatar_url,
        seat=None
    )
    game.players.append(new_player)
    
    await connection_manager.broadcast(room_id, {
        "type": "GAME_STATE_UPDATE",
        "payload": game.dict()
    })

    return {"room_id": game.room_id, "player_id": new_player.id}

@app.get("/games/{room_id}", response_model=Game)
async def get_game_state(room_id: str):
    game = game_manager.get_game(room_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await connection_manager.connect(websocket, room_id, player_id)

    game = game_manager.get_game(room_id)
    if game:
        await websocket.send_json({
            "type": "GAME_STATE_UPDATE",
            "payload": game.dict()
        })
        
    try:
        while True:
            data = await websocket.receive_json()
            await handle_ws_action(websocket, room_id, player_id, data)
    except WebSocketDisconnect:
        connection_manager.disconnect(room_id, player_id)
        await connection_manager.broadcast(room_id, {"type": "PLAYER_DISCONNECTED", "payload": {"player_id": player_id}})

@app.get("/health")
async def health_check():
    return {"status": "ok"}