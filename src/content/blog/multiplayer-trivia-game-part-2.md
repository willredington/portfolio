---
author: Will Redington
pubDatetime: 2024-09-03T15:22:00Z
title: Multiplayer Trivia Game - Part 2 - Services
postSlug: multiplayer-trivia-game-with-ai-part-2
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
description: Building out the services
---

## Table of contents

[foo]("assets/dev.svg")

Here's the formatted version in Markdown, with some minor adjustments for clarity and flow:

## Introduction

In the last update, we discussed the design for our trivia project, which includes the following key features:

- Perform normal CRUD operations on the game room.
- Support WebSocket connections for receiving updates about changes to the game room.
- Generate trivia questions using OpenAI.
- Cycle the game room through questions and calculate scores once it starts.
- Implement event sourcing to notify other services of updates, such as alerting WebSocket clients of new changes.
- Provide a web portal for clients to interact with the game room.

This time, we’re going to start putting the pieces together. Let’s begin by fleshing out the data model.

## Data Model

Our primary data model will revolve around the game room:

```python
class GameStatus(str, Enum):
    IDLE = "idle"
    BUILDING = "building"
    READY = "ready"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    FAILED = "failed"

class GameRoomImage(BaseModel):
    url: HttpUrl
    author_url: HttpUrl

class GameRoom(BaseModel):
    code: str
    title: Optional[str] = None
    topic: str
    owner_id: str
    max_player_count: int
    image: Optional[GameRoomImage] = None
    status: GameStatus
    players: List[Player]
    questions: List[MultipleChoiceQuestion]
    failure_reason: Optional[str] = None
    current_question_id: Optional[str] = None
```

Key Components:

- **GameStatus**: Enum that tracks the game room’s state, from being idle to completed or failed.
- **GameRoomImage**: Represents the image associated with the game room, including the URL and the author’s URL (sourced from Unsplash, so author acknowledgment is required).
- **GameRoom**: The main data model containing all relevant information about the game room, including its code, topic, owner, players, and questions.

We’re using Python type annotations and Pydantic models, which provide built-in validation and serialization. Most game room operations will be handled via this model.

## CRUD API

We’re using **FastAPI** to build out the CRUD operations for the game room model. Let's add some basic routes:

```python
game_room_router = APIRouter()

@game_room_router.post("/create")
async def create_game_room(body: CreateGameRoomRequest):
    print("Creating game room", body)
    return await service.create_game_room(redis_client, body)

@game_room_router.get("/code/{game_room_code}")
async def get_game_room_by_code(game_room_code: str):
    game_room = await service.get_game_room_by_code(redis_client, game_room_code)
    if not game_room:
        return Response(status_code=404)
    return game_room
```

Game Room Creation Considerations:

1. **Authenticated User**: The user creating the game room should be authenticated. We’re currently using a placeholder for the owner ID.
2. **Barebones Game Room**: Initially, the game room will have no questions or players.
3. **Start Question Generation**: After creating the game room, initiate trivia question generation.

Here’s the implementation:

```python
async def create_game_room(redis_client, request: CreateGameRoomRequest):
    code = await make_unique_game_room_code(redis_client)
    game_room_key = make_game_room_key(code)

    game_room = GameRoom(
        code=code,
        title=request.title,
        topic=request.topic,
        owner_id="user1",  # TODO: placeholder, will fix later
        max_player_count=_GAME_ROOM_MAX_PLAYER_COUNT,
        status=GameStatus.IDLE,
        questions=[],
        players=[],
        failure_reason=None,
        current_question_id=None,
    )

    thumbnail = await get_thumbnail(request.topic)

    if thumbnail:
        image = GameRoomImage(
            url=thumbnail.urls.thumb,
            author_url=thumbnail.user.links.html,
        )
        game_room.image = image

    await redis_client.set(
        game_room_key, game_room.model_dump_json(), ex=_GAME_ROOM_TTL
    )

    await emit_game_room_event(
        redis_client,
        GameRoomCreatedEvent(
            game_room=game_room, questions_length=request.questions_length
        ),
    )

    await update_game_room(redis_client, code, {"status": GameStatus.BUILDING})

    return game_room
```

This creates a basic game room, emits an event to Redis that a new game room has been created, and sets the status to “BUILDING” to indicate the process has started. Pydantic models are used to handle validation and serialization.

## Event Sourcing Service

This service coordinates complex workflows in our system. The primary use case is handling what happens when a new game room is created. There’s no need for this to be an API, as all incoming entities will be events from Redis channels.

Here’s the process:

1. **New Game Room Event**: Listen for the event indicating a new game room has been created.
2. **Trigger Question Generation**: Start generating trivia questions based on the game room’s topic.
3. **Fail Game Room on Timeout**: If trivia generation doesn’t complete within the timeout period, mark the game room as failed.

```python
async def _handle_game_room_created_event(event: model.GameRoomCreatedEvent):
    task_queue.enqueue_in(
        timedelta(minutes=5),
        task.game_room_failed_with_timeout,
        args=(event.game_room.code,),
        result_ttl=0,
    )

    await service.emit_generate_trivia_questions_request(
        redis_client,
        model.GenerateTriviaQuestionsRequestEvent(
            topic=event.game_room.topic,
            game_room_code=event.game_room.code,
            questions_length=event.questions_length,
        ),
    )
```

We use RQ to schedule a timeout task and initiate trivia question generation. Once the questions are retrieved, we’ll call the CRUD API using webhooks rather than saving it directly in the event service.

```python
async def handle_generate_trivia_questions_response_message(message):
    game_room_code = None
    failure_reason = None

    try:
        json_data = json.loads(message["data"])
        generate_trivia_questions_response = model.GenerateTriviaQuestionsResponseEvent(**json_data)

        game_room_code = generate_trivia_questions_response.game_room_code
        await send_generate_trivia_questions_response_webhook(json_data)

    except json.JSONDecodeError:
        failure_reason = "Received invalid JSON data"
    except ValidationError as e:
        failure_reason = str(e)
    except Exception as e:
        failure_reason = str(e)

    if game_room_code and failure_reason:
        await send_game_room_failed_webhook(
            GameRoomFailed(game_room_code=game_room_code, failure_reason=failure_reason)
        )
```

This handles the response event emitted from the trivia question service and updates the game room accordingly.

## Trivia Questions Service

This service generates trivia questions based on a given topic. It listens for events on Redis and emits results when finished.

```python
async def generate_trivia_questions(topic: str, questions_length: int):
    openai_client = AsyncOpenAI()

    completion = await openai_client.beta.chat.completions.parse(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": human_prompt.format(topic=topic, questions_length=str(questions_length))},
        ],
        response_format=TriviaQuestionsResponse,
    )

    message = completion.choices[0].message
    if message.parsed:
        return message.parsed

    raise ValueError("Could not generate trivia questions", message.refusal)
```

We use the OpenAI SDK, which now supports Pydantic models for validation. The async client is crucial for scaling this event-driven service.

### Prompts

```python
system_prompt = """
You are a trivia master. Your sole purpose is to generate a list of trivia questions. You will be given a topic that should pertain to the questions you will generate. You will also be given a number for the amount of questions you should generate. The questions must be in multiple choice format. The questions should be hard, nothing easy. Do NOT produce repeat questions. I will give you a list of questions that have already been generated. If it's just an empty JSON array, that means nothing has been produced yet.

You must respond in JSON format.

Here is what a multiple choice question will look like:

{
  "question": "What is the capital of China?",
  "choices": ["Beijing", "Chicago", "New York", "Tokyo"],
  "answer": "Beijing"
}

And here is the format of what you must respond with when given a topic.

Here is an example response for the topic of "China" with a questionsLength of 2:

{
  "questions": [
    {
      "question": "What is the capital of China?",
      "choices": ["Beijing", "Chicago", "New York", "Tokyo"],
      "answer": "Beijing"
    },
    {
      "question": "What is the most widely spoken language in China?",
      "choices": ["Mandarin", "Cantonese", "Jin", "Min"],
      "answer": "Mandarin"
    }
  ]
}

Only respond in the JSON format described above.
"""

human_prompt = """
Here is the topic for the trivia questions: {topic}

You should generate {questions_length} questions

Here are the questions already produced previously: {previous_questions}
"""
```

Our prompts provide precise instructions and examples to guide the AI in generating high-quality trivia questions.

## Conclusion

Now that our services are in place for game room creation, our next step is handling active game rooms. This includes managing player interactions, scoring, and real-time updates. Stay tuned for the next installment!
