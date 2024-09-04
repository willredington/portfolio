---
author: Will Redington
pubDatetime: 2024-09-03T15:22:00Z
title: Multiplayer Trivia Game - Part 1 - Design
postSlug: multiplayer-trivia-game-with-ai-part-1
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
description: Designing the trivia game
---

## Table of contents

[foo]("assets/dev.svg")

## Introduction

Trivia Murder Party is a great game to play with friends and family. During one of these sessions, a thought occurred to me

> why can’t we play trivia games based on topics we create ourselves?

And thus, this project was born with a relatively simple premise:

**to create AI-generated trivia games from any given topic**

## Basic Requirements

At a high level, we need the following elements to get a bare-bones version of this project out into the ether:

- The ability for anyone to join a game room without needing to sign up.
- The ability to generate trivia questions from a topic, such as “World History.”

A fairly small and straightforward set of requirements, right?

## Overall Structure

### Trivia Generation

Let’s start with the fun part: generating the trivia questions. We need to ask ourselves, is this going to be a complex workflow? Probably not, so we should be fine with a bare-bones SDK (in lieu of something like LangChain) from a popular LLM provider like OpenAI. Anthropic is an option, but OpenAI is more mature. As of this writing, they officially support two languages: Python and Node.js. My preference is Typescript, as its fully-typed. Let’s flesh out some more details before deciding.

### Data Modeling

The primary model, based on our requirements, will be the “Game Room.” The overall project has an ephemeral and short-lived nature. Generally speaking, our models will be active for a short time, involving a lot of interactions such as players submitting answers, cycling through questions, and status updates. Eventually, after a few hours, the game room will need to be destroyed, preferably automatically. In other words, we need something that can handle high transaction volumes and supports models with a TTL (Time to Live) or a similar mechanism for managing a lifecycle. We have a few options, but popular ones that come to mind are Redis and DynamoDB. Both support sub-second queries and writes, and both offer TTL. For now, **we’ll go with Redis because it’s cost-effective, supports our use cases**, and has clients for both Python and Node.js.

### Services

In general, our services need to do the following:

- Perform normal CRUD operations on the game room.
- Support WebSocket connections for receiving updates about changes to the game room.
- Generate trivia questions using OpenAI.
- Cycle the game room through questions and calculate scores once it starts.
- Implement some form of event sourcing to notify other services of updates, such as alerting WebSocket clients of new changes.
- Provide a web portal for clients to interact with the game room.

Thus, our stack will require the following technologies:

- A service for event sourcing.
- Independent workers to handle the game room’s progression once it starts.
- An API for CRUD operations on the Game Room.
- A web portal.
- A service for generating questions.
- An API for handling WebSocket connections.

## Making Decisions

When designing a system, I prefer to use the same language whenever possible. Our first decision: Python or TypeScript?

We prefer TypeScript, but remember everything we need to support: a robust API framework, WebSockets, OpenAI SDK support, and strong event-sourcing libraries. These days, finding a well-written API framework that is TypeScript-first is challenging. NestJS is the de-facto standard in this space, but many developers, including myself, have concerns about its paradigms and overall design. Another advantage of Python is its excellent support for data validation through libraries like Pydantic. Given these factors, we’ll use Python for the API but stick with TypeScript for the web portal.

Now that we’ve made that decision, let’s refine our choices further:

- FastAPI (API framework): It has strong support, is well-written, supports WebSockets, and handles async operations well.
- Event sourcing: Since we’re using Redis, we’ll go with the RQ library for Python. It supports independent workers, scheduling, and many other features we may need later.
- OpenAI: The official Python SDK by OpenAI suits our needs perfectly.
- Web portal: We’ll use Next.js, one of the few truly enterprise-ready frameworks that is fully typed.

## Design Summary

Our services will have these characteristics:

- The majority of network communication will be through event sourcing.

- We prefer to keep the business logic pertaining to the Game Room within the CRUD API.

- Event sourcing will handle more complex workflows (e.g., building a game room, generating questions, and making appropriate updates once complete).

- WebSocket updates will be managed by a dedicated API, with server-side updates triggered by events and propagated to the clients.

Given the need to support WebSockets, serverless offerings aren’t really an option here, so we’re opting for a microservice architecture.

### Backing Services

- CRUD API
- Generate Trivia Questions Service
- WebSocket API
- Event Sourcing Service and Workers

### Frontend Components

- Web portal

---

In summary, we will have four services plus workers and a web portal for the end users. Next, we’ll flesh out the backing services needed to support this undertaking.
