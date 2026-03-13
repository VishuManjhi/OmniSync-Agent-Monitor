# OmniSync (RestroBoard)

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-white?style=for-the-badge&logo=socketdotio)](https://socket.io/)

OmniSync is a real-time agent-supervisor operations platform for contact center workflows. It combines ticket lifecycle control, session tracking, live messaging, analytics, report export/email, and asynchronous job processing.

---

## Table of Contents
- [Overview](#overview)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Environment Variables](#environment-variables)
- [Local Setup](#local-setup)
- [Runbook](#runbook)
- [Async Jobs (SQS + AsyncJob)](#async-jobs-sqs--asyncjob)
- [Ticket Workflow Rules](#ticket-workflow-rules)
- [API Surface](#api-surface)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Roadmap / Next Improvements](#roadmap--next-improvements)

---

## Overview

The system has two main personas:

- **Agent**: login, manage session (clock in/out, breaks, on-call), raise tickets, request support, receive broadcasts.
- **Supervisor**: monitor live agent states, manage ticket lifecycle, run SLA automation, access reporting centre, view async job status, send communications.

The project currently includes:

- React frontend (`frontend-react`) as primary UI.
- Legacy static frontend (`frontend`) retained for backward compatibility.
- Node + Express backend (`backend`) with MongoDB and WebSocket servers.
- SQS worker for asynchronous operations.

---

## Core Features

### 1) Authentication & Roles
- JWT-based auth with role-aware behavior (`agent`, `supervisor`).
- Passport JWT protection for private APIs.

### 2) Agent Operations
- Session and status transitions (active, on call, on break, offline).
- Ticket creation and updates with validation rules.
- Real-time support/help messaging and broadcast reception.

### 3) Supervisor Operations
- Dashboard with agent visibility and ticket insights.
- Agent card quick actions including **Open Report**.
- Ticket approvals/rejections for supervisor-assigned flow.
- **Job Status** tab for async pipeline observability.
- **SLA Automation** tab for breach listing and escalation.

### 4) Reports & Analytics
- Weekly/monthly agent performance reports.
- Excel export generation.
- Email report delivery via SMTP.
- Mongo aggregation-based analytics (ticket trends, AHT, attendance).

### 5) Async Processing
- SQS-backed queue processing for:
  - `EXCEL_EXPORT`
  - `EMAIL_REPORT`
  - `NOTIFICATION`
- Async job lifecycle tracked in Mongo via `AsyncJob` model.

---

## Architecture

### Runtime Components
- **API Server** (`backend/servers/api-server.js`): Express REST APIs.
- **WebSocket Server** (`backend/servers/ws-server.js`): real-time events.
- **SQS Worker** (`backend/workers/sqsWorker.js`): async job processing.
- **MongoDB**: persistent source of truth (tickets, sessions, messages, async jobs).
- **SQS**: durable async transport queue (optional but recommended for async features).

### Data Flow (high level)
1. Frontend calls API endpoint.
2. Endpoint handles sync logic or enqueues async job.
3. Async worker consumes job and updates `AsyncJob` status/results.
4. Frontend polls job status/list endpoints and renders current state.
5. WebSocket pushes real-time updates for key interactions.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| Frontend | React 19, TypeScript, Vite, TanStack Query, Lucide |
| Backend | Node.js, Express, Passport JWT, Zod |
| Database | MongoDB + Mongoose |
| Realtime | Socket.IO |
| Queue | AWS SQS (`@aws-sdk/client-sqs`) |
| Reporting | ExcelJS, Nodemailer |
| Security | Helmet, HPP, CORS, rate limiting |

---

## Repository Structure

```text
VBA/
├─ backend/
│  ├─ controllers/
│  ├─ middleware/
│  ├─ models/
│  ├─ routes/
│  ├─ servers/
│  ├─ services/
│  ├─ workers/
│  └─ uploads/
├─ frontend-react/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/
│  │  ├─ context/
│  │  ├─ hooks/
│  │  └─ styles/
├─ frontend/   # legacy static UI
└─ uploads/
```

---

## Environment Variables

Create `.env` in project root (`VBA/.env`):

### Required (core)
- `MONGODB_URI` = MongoDB connection string
- `JWT_SECRET` = signing secret

### Optional / recommended
- `PORT` (default: `3003`)
- `ALLOWED_ORIGINS` (comma-separated)
- `MONGODB_DB` (optional db name override)

### SMTP (for email reports)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### AWS SQS (for async jobs)
- `SQS_QUEUE_URL`
- `AWS_REGION` (fallback if not derivable from queue URL)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

> If `SQS_QUEUE_URL` is absent, async queue operations return `SQS_NOT_CONFIGURED`.

---

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB (local/atlas)
- npm

### Install

```bash
npm install
cd frontend-react
npm install
cd ..
```

---

## Runbook

### Start backend stack

```bash
npm run clear-ports
npm run dev
```

This launches:
- API server on `http://localhost:3003`
- WS server on `ws://localhost:8080`
- SQS worker automatically if `SQS_QUEUE_URL` is configured

### Start frontend

```bash
cd frontend-react
npm run dev
```

Frontend default URL is shown by Vite (commonly `http://localhost:5173`).

### Run worker explicitly (optional)

```bash
npm run worker:sqs
```

---

## Async Jobs (SQS + AsyncJob)

### Why both?
- **SQS** = transport/delivery queue.
- **AsyncJob (Mongo)** = lifecycle tracking + UI visibility + status/history.

### Job lifecycle
`QUEUED` → `PROCESSING` → (`COMPLETED` | `FAILED`)

### Current async types
- `EXCEL_EXPORT`: generate XLSX and store file URL.
- `EMAIL_REPORT`: generate and send report email.
- `NOTIFICATION`: create broadcast/system notification message.

### Job Status tab fields
- **Job ID**: UUID generated on enqueue.
- **Type**: one of async types above.
- **Status**: current lifecycle state.
- **Attempts**: worker processing attempts count.
- **Updated**: latest state update time (`updatedAt`).

### Pagination
- Job list endpoint supports `page` and `limit`.
- SLA breach list endpoint supports `hours`, `page`, and `limit`.

---

## Ticket Workflow Rules

For supervisor-assigned tickets, server-enforced transitions are:

1. `ASSIGNED` → `IN_PROGRESS`
2. `IN_PROGRESS` → `RESOLUTION_REQUESTED`
3. `RESOLUTION_REQUESTED` → `RESOLVED` or back to `IN_PROGRESS`

Direct finalize from invalid intermediate states is blocked by backend validation.

---

## API Surface

### Auth
- `POST /api/auth/login`

### Agents / Sessions
- `/api/agents/*`
- `/api/agent-sessions/*`

### Tickets
- `GET /api/tickets`
- `PATCH /api/tickets/:ticketId`
- `POST /api/tickets`

### Queue Stats / Analytics / Reports
- `GET /api/queue-stats`
- `GET /api/queue-stats/agent/:agentId`
- `GET /api/queue-stats/agent/:agentId/report?period=weekly|monthly`
- `POST /api/queue-stats/agent/:agentId/report/export`
- `POST /api/queue-stats/agent/:agentId/report/email`
- `GET /api/queue-stats/jobs?page=&limit=`
- `GET /api/queue-stats/jobs/:jobId`
- `GET /api/queue-stats/sla/breaches?hours=&page=&limit=`
- `POST /api/queue-stats/sla/automate`

### Messaging / Broadcast
- `/api/broadcasts/*`

---

## Security

- Helmet headers enabled.
- HPP enabled.
- JWT auth via Passport for protected routes.
- Zod validation middleware for request payload safety.
- CORS method whitelisting includes `PATCH` and preflight support.
- Rate limiter present (can be toggled for local testing).

---

## Troubleshooting

### 1) Port already in use

```bash
npm run clear-ports
```

Then restart backend/frontend.

### 2) `SQS_NOT_CONFIGURED`
- Set `SQS_QUEUE_URL` and AWS credentials in `.env`.

### 3) SQS `SignatureDoesNotMatch`
- Ensure region matches queue URL region.
- Current client derives region from queue URL when possible.

### 4) Job visible in DB but not in UI
- Check Job Status tab query errors (now surfaced in UI).
- Verify auth token and endpoint response in browser network tab.

### 5) Email report fails
- Verify SMTP env values and sender auth.

### 6) Mongo namespace/db URI issues
- Validate `MONGODB_URI` and optional `MONGODB_DB` combination.

---

## Roadmap / Next Improvements

- Add Job Status filters (`type`, `status`) and quick retry actions.
- Add Redis cache layer for analytics-heavy reads.
- Add Socket.IO Redis adapter for horizontal scaling.
- Add deployment manifests and CI checks.
- Add E2E tests for report + job lifecycle flows.

---

## Author

Vishuddhanand Manjhi
