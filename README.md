# OmniSync (VBA)

Real-time Agent/Supervisor operations platform with ticket lifecycle management, live messaging, analytics, and report export.

## Features
- Role-based login (`agent`, `supervisor`) with JWT auth.
- Agent workspace: session control, ticket raise/update flow, support messaging.
- Supervisor dashboard: live monitoring, agent controls, ticket approvals/rejections, report centre.
- Real-time events over Socket.IO (status, ticket updates, messaging, force logout).
- Analytics APIs for queue stats, agent trends, and report metrics.
- Excel report export and optional email delivery via SMTP.

## Tech Stack
- Frontend: React 19, TypeScript, Vite, TanStack Query.
- Backend: Node.js, Express, Passport JWT, Zod validation.
- Database: MongoDB + Mongoose.
- Realtime: Socket.IO.
- Reporting: ExcelJS + Nodemailer.

## Repository Layout
- `backend/` API server, WS server, controllers, routes, models, middleware.
- `frontend-react/` modern React UI.
- `frontend/` legacy static frontend.
- `uploads/` runtime file storage (ignored from git).

## Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

## Environment Variables (Backend)
Create a `.env` (or set shell vars):
- `PORT` (default `3003`)
- `MONGODB_URI` (Mongo connection string)
- `JWT_SECRET` (required in production)
- `ALLOWED_ORIGINS` (comma-separated origins; optional)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (optional, for email reports)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SQS_QUEUE_URL` (required for async report/email/notification queue)

## Install
```bash
npm install
cd frontend-react
npm install
```

## Run (Local)
From repo root:
```bash
npm run clear-ports
npm run dev
```
This starts API (`3003`) + WS (`8080`).

If `SQS_QUEUE_URL` is configured, SQS worker starts automatically with the stack.

Or run worker separately:
```bash
npm run worker:sqs
```

In another terminal:
```bash
cd frontend-react
npm run dev
```

## Key API Areas
- Auth: `/api/auth/*`
- Agent sessions: `/api/agent-sessions`
- Tickets: `/api/tickets`
- Queue/analytics: `/api/queue-stats`
- Reports:
  - `GET /api/queue-stats/agent/:agentId/report?period=weekly|monthly`
  - `GET /api/queue-stats/agent/:agentId/report/export?period=...` (sync fallback)
  - `POST /api/queue-stats/agent/:agentId/report/export` (async queued)
  - `POST /api/queue-stats/agent/:agentId/report/email` (async queued)
  - `POST /api/queue-stats/notifications` (async queued)
  - `GET /api/queue-stats/jobs/:jobId` (job status)

## Ticket Workflow (Supervisor-assigned)
Enforced server-side:
1. `ASSIGNED` → `IN_PROGRESS` (Accept Task)
2. `IN_PROGRESS` → `RESOLUTION_REQUESTED` (Request Resolution)
3. `RESOLUTION_REQUESTED` → `RESOLVED` (Approve) or `IN_PROGRESS` (Reject/Send back)

Direct resolution from `IN_PROGRESS` is blocked for supervisor-assigned tickets.

## Report Centre: Data + Excel Flow
- Frontend component: `frontend-react/src/components/dashboard/supervisor/ReportCentre.tsx`
- Report API source: `backend/controllers/analyticsController.js` (`buildAgentReportMetrics`)
- Data is produced using MongoDB aggregation pipelines (`Ticket.aggregate`, `Session.aggregate`) for totals, attendance, and AHT.
- Excel generation uses `ExcelJS` workbook creation (`buildWorkbookBuffer`) and is returned as `.xlsx` bytes by export endpoint.

## Async Queue (SQS + Worker)
- Async job types: `EXCEL_EXPORT`, `EMAIL_REPORT`, `NOTIFICATION`.
- API enqueues jobs and returns `202` with `jobId`.
- Worker (`backend/workers/sqsWorker.js`) consumes SQS messages, processes jobs, and updates `AsyncJob` status.
- Export jobs generate file under `backend/uploads/reports` and expose `downloadUrl` in job result.

## Aggregation Pipelines (Current)
Total: **8**
- `analyticsController.js`: 7 pipelines (report metrics, queue stats, agent analytics)
- `agentController.js`: 1 pipeline (latest session per agent)

## Security Notes
- Helmet + HPP enabled.
- Rate limiting enabled for `/api/*` (OPTIONS preflight excluded).
- Zod request validation for critical endpoints.
- JWT auth via Passport.

## Development Notes
- Runtime artifacts (logs, txt dumps, uploads) are ignored by `.gitignore`.
- Keep `backend/uploads/.gitkeep` to preserve folder structure.

## Author
Vishuddhanand Manjhi
