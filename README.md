# 🌑 RestroBoard: High-Fidelity Support Infrastructure

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-white?style=for-the-badge&logo=socketdotio)](https://socket.io/)

RestroBoard is an enterprise-grade, real-time support operations platform designed for elite restaurant groups. It merges mission-critical operational control with a premium architectural UI to streamline the entire support lifecycle—from initial ticket triage to final resolution.

---

## ✨ Premium Frontend Engineering

RestroBoard is built to reduce cognitive load while maintaining an elite corporate aesthetic.

### 🏢 Architectural Hero & UI
- **Obsidian Aesthetic**: A deep, moody cinematic background (`#050810` base) with optimized contrast for zero-latency readability.
- **High-Fidelity Typography**: Specialized font hierarchies with silver-to-white gradients and refined letter-spacing.
- **Style Isolation**: All marketing styles are isolated to the `.landing-page` container using `--l-` prefixed variables, ensuring zero pollution into the core product modules.

### 🃏 3D Interaction & Productivity
- **3D Card Deck**: A tactical, bi-directional navigation system for feature discovery, using React state-driven CSS `perspective` and transforms.
- **Expandable Feedback Bar**: A compact, search-bar style expandable widget that maximizes screen real estate while remaining instantly accessible.
- **Center-Screen Modals**: High-visibility success popups and technical deep-dive modals for executive-level engagement.

---

## 🎧 Advanced Support Management

Built for scale, the system manages the high-pressure intersection of agents and supervisors.

### 📋 Total Ticket Lifecycle Control
- **Intelligent Triage System (ITS)**: Weighted scoring algorithms that automatically route mission-critical issues (BOH/FOH) to the highest-skilled agents.
- **Workflow State Enforcement**: Strict server-side validation for ticket transitions: `ASSIGNED` → `IN_PROGRESS` → `RESOLUTION_REQUESTED` → `RESOLVED`.
- **Real-Time Collab Rooms**: Dedicated Socket.io environments for rapid area manager collaboration and technical deep-dives.

### 💂 Supervisor Command Centre
- **Live Operation Monitoring**: Real-time visibility into agent states (Active, On-Call, On-Break) with quick-action cards.
- **SLA Breach Automation**: Automated listing and escalation of tickets nearing breach, ensuring compliance across multi-location groups.
- **Reporting Centre**: Weekly/monthly performance analytics, Excel export generation, and automated SMTP email delivery.
- **Async Job Observability**: A dedicated frontend for monitoring SQS-backed background jobs (Exports, Internal Broadcasts).

---

## ⚙️ Technical Architecture

### Tech Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, TanStack Query, Lucide |
| **Backend** | Node.js, Express, Passport JWT, Zod Validation |
| **Database** | MongoDB + Mongoose (Aggregation Pipelines) |
| **Realtime** | Socket.IO (WebSocket for <100ms Event Sync) |
| **Queueing** | AWS SQS (`@aws-sdk/client-sqs`) |
| **Reporting** | ExcelJS, Nodemailer |
| **Security** | Helmet, HPP, CORS, Rate Limiting |

### Repository Structure
```text
VBA/
├─ backend/             # REST APIs, WS Server, & Workers
│  ├─ controllers/      # Business Logic (Tickets, Auth, Analytics)
│  ├─ models/           # Mongoose Schemas (AsyncJob, Ticket, Lead)
│  └─ workers/          # SQS Queue Consumers
├─ frontend-react/      # Premium UI (Vite + React)
│  ├─ src/api/          # Public & Private API mappings
│  └─ src/components/   # High-Fidelity Modules (3D Deck, Dashboards)
└─ uploads/             # Volatile report storage
```

---

## 🚀 Deployment & Setup

### 1. Installation
```bash
npm install
cd frontend-react
npm install
```

### 2. Environment Configuration
Create a `.env` in the root (`VBA/.env`):
```env
MONGODB_URI=your_mongo_uri
JWT_SECRET=your_jwt_secret
PORT=3003
SQS_QUEUE_URL=your_sqs_url (optional for async jobs)
```

### 3. Execution
```bash
# Start Backend Infrastructure
npm run dev

# Start Frontend UI
cd frontend-react && npm run dev
```

---

## 🤝 Professional Advisory
*RestroBoard: Elite Operations Engineering.*

Produced & Maintained by **Vishuddhanand Manjhi**. 

