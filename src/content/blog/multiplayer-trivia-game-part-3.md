---
author: Will Redington
pubDatetime: 2024-09-10T15:22:00Z
title: Multiplayer Trivia Game - Part 3 - Events & Tasks
postSlug: multiplayer-trivia-game-with-ai-part-3
featured: true
draft: false
tags:
  - ai
  - chatgpt
  - python
  - kubernetes
  - nextjs
  - react
  - node
ogImage: "astropaper-og.jpg"
description: Creating events and tasks
---

## Table of contents

[foo]("assets/dev.svg")

## Introduction

In the previous part, we built the core services for our online multiplayer trivia game. Now, we’re going to extend the functionality to handle what happens once a game room is in progress. This part focuses on managing events throughout the game lifecycle, ensuring everything runs smoothly from game start to finish.

## Design

At a high level, we’re working with an event-driven system. Here’s a recap of what we have so far:

1. A user creates a game room.
2. The main API creates the game room and triggers a `CREATED_GAME_ROOM` event.
3. The event handler service listens for this event and starts the trivia generation service.
4. The trivia generation service does its job and emits a completion event to the event bus (using Redis).
5. The event handler service detects this event and notifies the main API that the trivia generation has finished, along with the generated questions.

At this point, we have a game room with a set of trivia questions. But what comes next?

## Next Steps

We need to implement several features for when the game is in progress:

- **Players**: Players need to join the game room.
- **Question cycling**: A background process should cycle through questions every N seconds.
- **Real-time updates**: Events should be emitted via WebSockets to notify clients when the game room updates.
- **Countdown sync**: A countdown timer should synchronize between the server and clients, so players know when the next question will appear.

## The Process

Let’s break this down:

1. A player joins the game room.
2. The player starts the game.
3. The main API changes the game room status to `IN_PROGRESS` and emits a `GAME_ROOM_UPDATED` event.
4. The event handler service listens for this event and starts the background process to cycle through the questions.
5. An RQ worker runs every 10 seconds, calling a webhook to increment the question index, while updating the clients with the correct countdown every 2 seconds for synchronization.

## Building the Components

### API Layer

In the game room layer, we need to do two things:

1. Emit an event whenever the game room model is updated.
2. Add a function to cycle through the questions until the end.

Here’s the code for updating a game room and cycling through the questions:

```python
async def update_game_room(redis_client, game_room_code: str, game_room_partial):
    game_room = await get_game_room_by_code(redis_client, game_room_code)

    if game_room is None:
        raise ValueError("Game room does not exist")

    game_room_key = make_game_room_key(game_room_code)
    updated_game_room = game_room.model_copy(update=game_room_partial)

    await redis_client.set(game_room_key, updated_game_room.model_dump_json(), ex=_GAME_ROOM_TTL)
    await emit_game_room_event(redis_client, GameRoomUpdatedEvent(game_room=updated_game_room))
    return updated_game_room

async def cycle_game_room(redis_client, game_room_code: str) -> bool:
    """
    Cycle to the next question if possible. Return True if the game room is finished, False otherwise.
    """
    game_room = await get_game_room_by_code(redis_client, game_room_code)

    if game_room is None:
        raise exception_model.GameRoomNotFoundException("Game room does not exist")

    if game_room.status != GameStatus.IN_PROGRESS:
        raise exception_model.GameRoomStatusException("Game room is not in progress")

    current_question_index = next(
        (i for i, question in enumerate(game_room.questions) if question.id == game_room.current_question_id),
        None,
    )

    if current_question_index is None:
        raise exception_model.QuestionNotFoundException("Current question not found")

    next_question_index = current_question_index + 1

    if next_question_index >= len(game_room.questions):
        await update_game_room(redis_client, game_room_code, {"status": GameStatus.COMPLETED})
        return True
    else:
        next_question = game_room.questions[next_question_index]
        await update_game_room(redis_client, game_room_code, {"current_question_id": next_question.id})

    return False
```

In this code, we emit an event whenever the game room updates, and the cycling function manages the transition to the next question. Both operations trigger the event handler.

### Event Handler

Next, we’ll implement the event handler, which is also used by the RQ worker. The handler listens for events and enqueues tasks for the worker.

```python
async def _handle_game_room_started_event(event: model.GameRoomStartedEvent):
    # Enqueue RQ task for cycling through questions
    task_queue.enqueue(task.cycle_game_room, args=(event.game_room_code,), job_timeout="1h", result_ttl=0)

async def handle_game_room_message(message):
    try:
        json_data = json.loads(message["data"])
        print("Handling game room message:", json_data)

        if "type" in json_data:
            event_type = json_data["type"]
            if event_type == model.GameRoomEventType.GAME_ROOM_CREATED:
                await _handle_game_room_created_event(model.GameRoomCreatedEvent(**json_data))
            elif event_type == model.GameRoomEventType.GAME_ROOM_UPDATED:
                await _handle_game_room_updated_event(model.GameRoomUpdatedEvent(**json_data))
            elif event_type == model.GameRoomEventType.GAME_ROOM_STARTED:
                await _handle_game_room_started_event(model.GameRoomStartedEvent(**json_data))
            elif event_type == model.GameRoomEventType.GAME_ROOM_FAILED:
                await _handle_game_room_failed_event(model.GameRoomFailedEvent(**json_data))

    except json.JSONDecodeError:
        print("Received invalid JSON data")
    except ValidationError as e:
        print(f"Received invalid event data: {e}")
    except Exception as e:
        print("Error handling message:", e)
```

This code listens for the `GAME_ROOM_STARTED` event and enqueues an RQ task to manage question cycling.

### The Worker Task

The task that cycles through the game room operates on a loop, emitting events to notify clients and triggering the next question cycle:

```python
def cycle_game_room(game_room_code: str):
    print("Starting cycle for game room:", game_room_code)

    cycle_duration = 10
    countdown_interval = 2

    while True:
        for remaining_time in range(cycle_duration, 0, -countdown_interval):
            emit_notify_clients_event_sync(
                redis_client,
                model.GameRoomCountdownEvent(
                    game_room_code=game_room_code,
                    time_remaining_in_seconds=remaining_time,
                ),
            )
            print(f"Countdown update: {remaining_time} seconds remaining")
            time.sleep(countdown_interval)

        print("Cycling to the next question")
        is_game_room_finished = send_cycle_game_room_webhook(game_room_code)

        if is_game_room_finished:
            print("Game room finished")
            return

        print("Game room not finished yet, starting new cycle")
```

Every 2 seconds, the worker emits a countdown event that the WebSocket API picks up to notify clients. Every 10 seconds, it triggers the main API to cycle to the next question.

### WebSocket Management

To manage WebSocket connections, we need to handle incoming connections, broadcast events to clients, and manage individual player states:

```python
class GameRoomWebsocketConnectionManager:
    def __init__(self, game_room_code: str):
        self.game_room_code = game_room_code
        self.connections_map: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, player_token: str):
        if player_token in self.connections_map:
            print("Player already connected")
            await websocket.close(reason="Player already connected")
        else:
            self.connections_map[player_token] = websocket
            print(f"WebSocket connection established for player {player_token} in game room {self.game_room_code}")

    async def close_websocket(self, player_token: str):
        if player_token is in self.connections_map:
            del self.connections_map[player_token]
            print(f"WebSocket connection closed for player {player_token}")

    async def broadcast_one(self, player_token: str, event):
        websocket = self.connections_map.get(player_token)

        if not websocket:
            print(f"WebSocket not found for player {player_token}")
            return

        await websocket.send_json(event.model_dump())

    async def broadcast_all(self, event):
        if not self.connections_map:
            print("No connections to broadcast to")
            return

        for player_token in self.connections_map.keys():
            await self.broadcast_one(player_token, event)
```

This class manages individual player connections, broadcasting events to each player and ensuring that only relevant data is shared.

### Player-Specific Game Room Model

Since the full game room model contains sensitive information (such as other player tokens and question answers), we need to send a stripped-down version of the game room to each player:

```python
class GameRoomForPlayer(BaseModel):
    current_question: Optional[MultipleChoiceQuestion] = None
    current_player: Player
    other_players: List[Player]

def make_game_room_for_player(player_token: str, game_room: GameRoom) -> GameRoomForPlayer:
    player = next((p for p in game_room.players if p.token == player_token), None)

    if not player:
        raise ValueError(f"Player {player_token} not found in game room {game_room.code}")

    other_players = [
        {"name": p.name, "avatar": p.avatar, "score": p.score}
        for p in game_room.players if p.token != player
```
