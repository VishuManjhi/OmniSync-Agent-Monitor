# 🟢 OmniSync Agent Monitor

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-white?style=for-the-badge&logo=socketdotio)](https://socket.io/)



**OmniSync Agent Monitor** (RestroBoard) is a production-grade, real-time dashboard designed for high-stakes call center environments. It bridges the gap between workforce monitoring and instant collaboration, providing supervisors with bird's-eye visibility and agents with immediate support channels.


---

## � Table of Contents
- [✨ Key Features](#-key-features)
- [🏗 Architecture & Real-Time Flow](#-architecture--real-time-flow)
- [🛠 Tech Stack](#-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [📂 Project Structure](#-project-structure)
- [🔒 Security & Authentication](#-security--authentication)
- [👤 Author](#-author)

---

## ✨ Key Features

### 🖥️ Supervisor Command Center
- **Live Agent Monitor**: A dynamic grid tracking statuses (Active, On Call, On Break, Offline) in real-time.
- **Transmission Center**: Specialized broadcast tool allowing **Global Alerts** to all agents or **Targeted Private Messages** to specific individuals via a searchable directory.
- **SOS Help Desk**: Integrated supervisor chat to respond to real-time support requests from agents.
- **Advanced WorkStation**: Visual KPI strip, status breakdown charts, and a detailed 6-column ticket metrics grid.
- **Ticket Lifecycle**: Full control over ticket status (Approve/Reject) with image attachments and zoom-in previews.

### 👤 Agent Workspace
- **Real-Time SOS Widget**: One-click "Help Request" button that opens a direct line to all active supervisors.
- **Broadcast Heads-up Display (HUD)**: Persistent alert banner for system-wide announcements.
- **Session Tracking**: Precise clock-in/out logic with automatic break duration monitoring and live activity syncing.
- **Smart Notifications**: Premium toast alerts for incoming messages and system broadcasts.

---

## 🏗 Architecture & Real-Time Flow

Our platform uses a **Dual-Channel** communication strategy:

1.  **REST Channel**: Handled by Express & Passport.js for high-security operations (Auth, Ticket Creation, File Uploads).
2.  **Socket Channel**: Handled by Socket.IO for event-driven updates (Status changes, Instant messaging, Force Logout commands).

### Message Persistence Logic
- Every message is assigned a **Client-Side UUID** immediately upon sending (Optimistic Update).
- Messages are persisted in **MongoDB** via the `Message` model.
- The server routes packets based on `receiverId` (Targeted) or `room:agents` (Broadcast).

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, TanStack Query, Lucide Icons |
| **Backend** | Node.js, Express, Multer (File Handling) |
| **Database** | MongoDB + Mongoose ODM |
| **Real-Time** | Socket.IO (WebSockets) |
| **Auth** | JWT (JSON Web Tokens) & Passport.js |
| **Offline** | IndexedDB Action Queueing |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- NPM (v9+)

### 1. Installation
```bash
git clone https://github.com/VishuManjhi/OmniSync-Agent-Monitor.git
cd OmniSync-Agent-Monitor
npm install
```

### 2. Configure Environment
Create a `.env` in the `backend` folder:
```env
PORT=3003
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### 3. Seed Database & Run
```bash
# Register default agents and supervisors
node backend/seed.js

# Start backend & websocket servers
npm run dev

# Start frontend (in separate terminal)
cd frontend-react && npm run dev
```

---

## � Project Structure

```text
OmniSync/
├── backend/
│   ├── models/            # Persistence Layer (Mongoose)
│   ├── servers/           # Logic Layer (API & WebSocket Hub)
│   ├── uploads/           # Physical Storage (Ticket Attachments)
│   └── seed.js            # Initialization Script
└── frontend-react/
    ├── src/
    │   ├── api/           # Data Fetching & IndexedDB Sync
    │   ├── context/       # State Engines (Auth, Socket, Messaging)
    │   └── components/    # UI Layer (Supervisor, Agent, Messaging)
```

---

## 🔒 Security & Authentication
- **Role-Based Access Control (RBAC)**: Distinct routes and capabilities for Supervisors vs. Agents.
- **Bcrypt Hashing**: Secure password storage with auto-migration to hashed passwords on successful login.
- **Force Logout**: Supervisor commands trigger a hard redirection on the agent's side, effectively terminating the session immediately.

---

## 👤 Author
**Vishuddhanand Manjhi**
- GitHub: [@VishuManjhi](https://github.com/VishuManjhi)
- Project: [OmniSync-Agent-Monitor](https://github.com/VishuManjhi/OmniSync-Agent-Monitor)

---
<p align="center"><sub>🚀 Built for performance, designed for collaboration.</sub></p>
