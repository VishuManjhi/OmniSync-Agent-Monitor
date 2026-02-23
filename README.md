<p align="center">
  <h1 align="center">🟢 OmniSync Agent Monitor</h1>
  <p align="center">
    A real-time call-center agent monitoring and ticket management dashboard<br/>
    built with <strong>React · TypeScript · Node.js · MongoDB (Mongoose) · Socket.IO</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb" />
  <img src="https://img.shields.io/badge/Socket.IO-Live-white?style=flat-square&logo=socketdotio" />
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
- [Author](#-author)

---

## Overview

**OmniSync Agent Monitor** (codename: *RestroBoard*) is a production-grade, real-time dashboard for monitoring call-center agents, managing support tickets, and tracking workforce performance — all in a sleek, dark-themed glassmorphism UI.

It features **two role-based dashboards** (Supervisor & Agent), **live bidirectional communication**, **JWT authentication**, and a robust **Offline Action Queue** to ensure high availability.

---

## 🚀 Key Features

### 🖥️ Supervisor Dashboard
| Feature | Description |
|---|---|
| **Live Monitor** | Real-time agent status grid (Active, On Call, On Break, Offline) |
| **Activity Log** | Sortable ticket table with priority detection and status filtering |
| **WorkStation** | Analytics hub — KPI strip, status breakdown bars, and a 3×2 ticket metrics grid |
| **Ticket Management** | Approve/Reject tickets with **compact image previews** and zoom-in views |
| **Offline Command Queue** | **Implemented via IndexedDB**: Force logout commands are locally queued if the supervisor is offline and automatically synced upon reconnect |

### 👤 Agent Dashboard
| Feature | Description |
|---|---|
| **Clock In / Out** | Precise session tracking with live duration timers |
| **Break Management** | Start/end breaks with automatic activity status updates |
| **My Tickets** | Personal feed with resolution request workflows and attachment support |
| **Force Logout Protection** | Instant redirection to login if a session is terminated by a supervisor |

### 🔐 Authentication & Security
- **JWT + Passport**: Secure role-based resource protection
- **bcrypt Hashing**: Passwords are automatically hashed and salted before storage
- **Supervisor Fallback**: Robust validation for admin and fallback supervisor accounts

### ⚡ Real-Time & Offline First
- **Socket.IO**: Switched from standard WS for better reconnection and event handling
- **IndexedDB Actions**: Critical actions (like Force Logout) survive browser refreshes and connection drops
- **Cache Invalidation**: React Query-powered state management for instant UI updates

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7, React Query |
| **Styling** | Vanilla CSS, Glassmorphism, Lucide Icons |
| **State** | React Context API & TanStack Query |
| **Backend** | Node.js, Express 4 |
| **Database** | MongoDB (via **Mongoose ODM**) |
| **Auth** | JWT (jsonwebtoken) & Passport.js |
| **Real-Time** | **Socket.IO** |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **MongoDB Atlas** or Local MongoDB
- **npm** ≥ 9

### 1. Installation
```bash
git clone https://github.com/VishuManjhi/OmniSync-Agent-Monitor.git
cd OmniSync-Agent-Monitor
npm install
cd frontend-react && npm install && cd ..
```

### 2. Database Setup
```bash
# Seeds the DB with default users (Vishu, Rashi, Aryan, etc.)
node backend/seed.js
```

### 3. Run
```bash
# Runs API Server (3003) and Socket Server (8080)
npm run dev

# (In separate terminal)
cd frontend-react && npm run dev
```

### ⚙️ Default Credentials
| Role | ID | Password |
|---|---|---|
| **Agent** | `a1`, `a2`, `a3`, `a4` | `agent123` |
| **Supervisor** | `admin`, `sup1` | `sup123` |

---

## 📁 Project Structure

```
OmniSync-Agent-Monitor/
├── backend/
│   ├── models/            # Mongoose Schemas (Agent, Ticket, Session)
│   ├── servers/
│   │   ├── api-server.js   # REST API (Passport protected)
│   │   └── ws-server.js    # Socket.IO Event Hub
│   ├── seed.js             # DB Seeding Script
│   └── uploads/            # Multer storage for ticket attachments
├── frontend-react/
│   ├── src/
│   │   ├── api/
│   │   │   ├── indexedDB.ts # Offline action queue logic
│   │   │   └── base.ts      # Fetch wrapper with interceptors
│   │   ├── context/
│   │   │   ├── AuthContext.tsx   # JWT handling
│   │   │   └── SocketContext.tsx # Sync management & WS hooks
│   │   └── components/
│   │       ├── SupervisorDashboard.tsx
│   │       └── AgentDashboard.tsx
```

---

## 👤 Author
Built by **Vishuddhanand Manjhi**
- GitHub: [@VishuManjhi](https://github.com/VishuManjhi)
- Repository: [OmniSync-Agent-Monitor](https://github.com/VishuManjhi/OmniSync-Agent-Monitor)

---
<p align="center"><sub>⭐ Star this repo if you found it useful!</sub></p>
