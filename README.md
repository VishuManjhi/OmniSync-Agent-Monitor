OmniSync Agent Monitor 

A real-time, browser-intensive agent monitoring dashboard built to explore high-frequency UI updates, offline reliability, background analytics, and memory-safe DOM architecture in modern web applications.

This project was built with a focus on runtime behavior, correctness, and performance diagnostics rather than visual polish.

🚀 Key Features
-Real-Time Agent Monitoring

- Live tracking of agent states: Available, Busy, Break, On Call

- Instant state propagation using WebSockets

- Heartbeat logic to detect stale or disconnected agents (ShortPolling)

- Offline-First Supervisor Actions (Offline queue)

- Critical supervisor actions are queued when offline (LongPolling)

- Uses IndexedDB as a persistent offline queue

- Automatic replay and sync on reconnection

- Idempotent State Synchronization

- Each critical action includes a unique Idempotency Key

Prevents duplicate execution during:

-network retries

-reconnect storms

-request timeouts

- Guarantees actions like Force Logout execute exactly once. 

- High-Frequency UI Updates Without Main-Thread Blocking

- Optimized rendering for rapid agent state transitions

- Heavy operations moved off the main thread (WebWorkers)

- Designed to handle dense, fast-changing dashboards

- Background Analytics with Web Workers

- Computes Average Handle Time (AHT) and aggregates

- Processes ~10,000 records in a Web Worker

- Keeps the UI responsive during heavy computation

- Multi-Channel Communication Architecture

Purpose-built communication strategy:

- WebSockets → live agent state updates

- Server-Sent Events (SSE) → queue stats & SLA metrics

- Long Polling → supervisor command handshake

- Short Polling → system health checks with abort & backoff

- Each channel is used intentionally, not redundantly.

- Efficient State Management with Native Data Structures

- Map for real-time agent state lookups

- Set for unique incident and error tracking

- Enables fast updates and de-duplication under load

- Memory-Safe DOM Architecture

- Event delegation for high-density agent grids

- Single listener handles all card actions

- Prevents listener bloat and unnecessary reflows

- Explicit Memory Leak Detection & GC Validation

- Built-in Stress Test Mode generates 1,000 temporary agents

- Heap snapshots taken before and after stress tests

- WeakMap / WeakSet ensure DOM metadata is garbage collected

- Verified memory cleanup after DOM removal

- Persistent & Context-Aware UI

- LocalStorage persists dashboard layout

- SessionStorage stores active monitoring context

- Supervisor state survives refresh safely

Binary Asset Uploads

Multipart uploads for:

- call recordings

- agent profile images

- Previews generated using URL.createObjectURL

- Safe cleanup using try / catch / finally

- Runtime Diagnostics & Debug Tools

- Live protocol indicators (WS / SSE / LP / SP)

- Offline sync counter for queued actions

Event Loop diagnostics logging:

macrotasks vs microtasks

🧠 Architecture Overview
Persistence & Offline Reliability

IndexedDB stores:

agent directory

historical metrics

offline action queue

Sync logic replays queued actions safely using idempotency keys

Concurrency & Background Processing

Web Workers handle analytics workloads

Prevents UI freezes during high-volume computation

DOM & Memory Strategy

Event delegation minimizes listeners

WeakMap / WeakSet tie metadata to DOM lifecycle

Verified garbage collection via DevTools

🛠 Tech Stack

Frontend: JavaScript, HTML, CSS

Backend: Node.js, Express (simulated endpoints where required)

Real-Time: WebSockets, Server-Sent Events

Storage: IndexedDB, LocalStorage, SessionStorage

Concurrency: Web Workers

Tooling: Chrome DevTools (Memory & Performance)

📸 Audit & Screenshots

Screenshots are available in the /screenshots directory:

Heap snapshots (before & after stress test)

Network tab showing:

multipart uploads

long-poll requests in pending state

Console logs explaining event loop execution order

👤 Author

Built by Vishuddhanand Manjhi
