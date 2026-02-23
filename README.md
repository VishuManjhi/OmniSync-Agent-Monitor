<p align="center">
  <h1 align="center">🟢 OmniSync Agent Monitor</h1>
  <p align="center">
    A real-time call-center agent monitoring and ticket management dashboard<br/>
    built with <strong>React · TypeScript · Node.js · MongoDB · WebSockets</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs" />
  <img src="https://img.shields.io/badge/MongoDB-6-47A248?style=flat-square&logo=mongodb" />
  <img src="https://img.shields.io/badge/WebSocket-Live-yellow?style=flat-square" />
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Screenshots](#-screenshots)
- [Author](#-author)

---

## Overview

**OmniSync Agent Monitor** (codename: *RestroBoard*) is a production-grade, real-time dashboard for monitoring call-center agents, managing support tickets, and tracking workforce performance — all in a sleek, dark-themed glassmorphism UI.

It features **two role-based dashboards** (Supervisor & Agent), **live WebSocket communication**, **JWT authentication**, and a rich ticket lifecycle (create → assign → resolve / reject).

---

## 🚀 Key Features

### 🖥️ Supervisor Dashboard
| Feature | Description |
|---|---|
| **Live Monitor** | Real-time agent status grid (Active, On Call, On Break, Offline) with search & filter |
| **Activity Log** | Sortable, filterable ticket table with priority detection (> 24h) |
| **WorkStation** | Analytics hub — KPI strip, agent status breakdown bars, 3×2 ticket analytics grid |
| **Ticket Management** | Create, assign, approve, and reject tickets with modal workflows |
| **Force Logout** | Instantly log out an agent via API + WebSocket broadcast |
| **Recent Tickets** | Scrollable card-based feed of the latest 10 tickets with quick actions |

### 👤 Agent Dashboard
| Feature | Description |
|---|---|
| **Clock In / Out** | Session tracking with one-click clock management |
| **Break Management** | Start/end breaks with duration tracking |
| **My Tickets** | View assigned tickets and request resolutions |
| **Real-time Updates** | Instant ticket assignments & force-logout signals via WebSocket |

### 🔐 Authentication
- JWT-based login (`8h` token expiry)
- Role-based routing — **Supervisor** vs **Agent** dashboards
- Persistent session via `localStorage`

### ⚡ Real-Time Communication
- **WebSocket** — live agent state changes, ticket events, force-logout signals
- Automatic reconnection with state sync on reconnect
- Bi-directional message bus via shared `SocketContext`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Styling** | CSS Variables, Glassmorphism, Lucide Icons |
| **State** | React Context API (`AuthContext`, `SocketContext`) |
| **Backend** | Node.js, Express 4 |
| **Database** | MongoDB 6 (via native driver) |
| **Auth** | JSON Web Tokens (JWT) |
| **Real-Time** | WebSocket (`ws` library) |
| **Tooling** | ESLint, PostCSS, Tailwind (dev) |

---

## 🏗 Architecture

```
┌──────────────────────────────────┐
│         React Frontend           │
│  (Vite Dev Server — port 5173)   │
│                                  │
│  ┌────────────┐  ┌─────────────┐ │
│  │  Supervisor │  │    Agent    │ │
│  │  Dashboard  │  │  Dashboard  │ │
│  └──────┬──────┘  └──────┬──────┘ │
│         │    AuthContext  │        │
│         │  SocketContext  │        │
└─────────┼────────────────┼────────┘
          │  REST + WS     │
          ▼                ▼
┌──────────────────────────────────┐
│       Node.js Backend            │
│                                  │
│  ┌──────────────┐ ┌────────────┐ │
│  │  API Server  │ │  WS Server │ │
│  │  (port 3003) │ │ (port 3004)│ │
│  └──────┬───────┘ └────────────┘ │
│         │                        │
└─────────┼────────────────────────┘
          ▼
┌──────────────────────────────────┐
│     MongoDB (restroDB)           │
│  ┌─────────┬──────────┬────────┐ │
│  │ agents  │ sessions │tickets │ │
│  └─────────┴──────────┴────────┘ │
└──────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (local or Atlas)
- **npm** ≥ 9

### 1. Clone the Repository

```bash
git clone https://github.com/VishuManjhi/OmniSync-Agent-Monitor.git
cd OmniSync-Agent-Monitor
```

### 2. Install Dependencies

```bash
# Root (backend)
npm install

# Frontend
cd frontend-react
npm install
cd ..
```

### 3. Seed the Database

```bash
node backend/seed.js
```

### 4. Start the Application

```bash
# Terminal 1 — Backend (API + WebSocket servers)
npm run dev

# Terminal 2 — Frontend
cd frontend-react
npm run dev
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| API Server | `http://localhost:3003` |
| WebSocket | `ws://localhost:3004` |

### 5. Login

Use credentials seeded into the database. Supervisor IDs start with `sup` or use `admin`.

---

## 📁 Project Structure

```
OmniSync-Agent-Monitor/
├── backend/
│   ├── servers/
│   │   ├── api-server.js          # Express REST API (auth, agents, tickets, sessions)
│   │   └── ws-server.js           # WebSocket broadcast server
│   ├── db.js                      # MongoDB connection helper
│   ├── seed.js                    # Database seeding script
│   ├── create_priority_ticket.js  # Utility to create priority test tickets
│   └── start-all.js              # Launches API + WS servers together
│
├── frontend-react/
│   ├── src/
│   │   ├── api/
│   │   │   ├── base.ts            # Axios-like fetch wrapper with JWT injection
│   │   │   ├── agent.ts           # API service functions (agents, tickets, sessions)
│   │   │   └── types.ts           # TypeScript interfaces (Agent, Ticket, Session, etc.)
│   │   ├── components/
│   │   │   ├── Login.tsx           # JWT login page with role-based redirect
│   │   │   ├── SupervisorDashboard.tsx  # Full supervisor command center
│   │   │   ├── AgentDashboard.tsx       # Agent workspace with clock/break/tickets
│   │   │   └── ui/Modal.tsx        # Reusable modal component
│   │   ├── context/
│   │   │   ├── AuthContext.tsx     # JWT auth state & login/logout logic
│   │   │   └── SocketContext.tsx   # WebSocket connection & message bus
│   │   ├── styles/                # Global CSS & theme variables
│   │   ├── App.tsx                # Root router (auth-gated)
│   │   └── main.tsx               # React entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                      # Legacy vanilla JS frontend (deprecated)
├── package.json                   # Root package (backend deps + scripts)
└── README.md
```

---

## 📡 API Endpoints

All endpoints (except login & health) require a `Bearer` JWT token in the `Authorization` header.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/api/auth/login` | Authenticate & receive JWT |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/:agentId` | Get single agent |
| `POST` | `/api/agent-sessions` | Create / update agent session |
| `GET` | `/api/agent-sessions` | Get latest sessions (aggregated) |
| `GET` | `/api/agents/:agentId/sessions/current` | Current session for an agent |
| `POST` | `/api/agents/:agentId/force-logout` | Force logout an agent |
| `POST` | `/api/tickets` | Create a new ticket |
| `GET` | `/api/tickets` | List all tickets |
| `PATCH` | `/api/tickets/:ticketId` | Update ticket (approve/reject) |
| `GET` | `/api/agents/:agentId/tickets` | Tickets for a specific agent |
| `GET` | `/api/queue-stats` | Real-time queue statistics |

### WebSocket Events

| Event | Direction | Description |
|---|---|---|
| `AGENT_STATUS_CHANGE` | Server → Client | Agent status update broadcast |
| `FORCE_LOGOUT` | Client → Server → Client | Force logout signal |
| `ASSIGN_TICKET` | Client → Server → Client | New ticket assignment |
| `TICKET_*` | Server → Client | Ticket lifecycle events |

---

## 📸 Screenshots

> Screenshots are available in the `/screenshots` directory (when applicable).

**Supervisor Dashboard — Live Monitor**
- Real-time 4-column agent grid with status indicators
- Search and filter by agent name or status

**Supervisor Dashboard — WorkStation**
- KPI strip (Total Agents, Active, On Break, Tickets Open, AHT)
- Agent status breakdown with animated progress bars
- 3×2 Ticket Analytics grid (Total, Resolved, Pending, Rejected, Open, Resolution Rate)

**Agent Dashboard**
- Clock in/out with live session timer
- Break management with duration tracking
- Personal ticket feed with resolution request workflow

---

## 🧩 Design Philosophy

- **Dark Glassmorphism UI** — premium feel with translucent cards, subtle borders, and glow effects
- **Real-time First** — WebSocket-driven state with REST fallback for data fetching
- **Role-Based Access** — clean separation of Supervisor and Agent experiences
- **Component Architecture** — modular React components with inline styles for co-location
- **Type Safety** — full TypeScript coverage on the frontend

---

## 👤 Author

Built by **Vishuddhanand Manjhi**

- GitHub: [@VishuManjhi](https://github.com/VishuManjhi)
- Repository: [OmniSync-Agent-Monitor](https://github.com/VishuManjhi/OmniSync-Agent-Monitor)

---

<p align="center">
  <sub>⭐ Star this repo if you found it useful!</sub>
</p>
