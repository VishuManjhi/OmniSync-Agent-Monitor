# Git Push README (Copy/Paste)

## 1) What changed

### Frontend
- Fixed Supervisor dashboard lint/runtime issues and data refresh stability.
- Added robust polling/reconnect behavior for supervisor ticket visibility.
- Added removable attachment UX (small X icon) in agent ticket flow.
- Enforced mandatory call duration from Agent UI before ticket submit.

### Backend
- Hardened backend startup flow to reduce crash loops in local dev.
- Enforced validation rule: call duration mandatory for agent-created tickets.
- Added cleanup rules for runtime artifacts and logs via `.gitignore`.

### Repo hygiene
- Removed crash/debug artifacts and test upload junk files.
- Kept upload directory structure using `backend/uploads/.gitkeep`.

---

## 2) Aggregation pipelines: what each one does

Total aggregate pipelines currently used: **8**

### A) Agent report metrics pipelines (`buildAgentReportMetrics`)
1. **Ticket aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Computes `totalRaised`, `totalResolved`, `totalRejected` for an agent in a selected period (weekly/monthly).
   - Stages: `$match` (agent + date range) → `$group` (conditional sums by status).

2. **Session aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Computes total attendance hours.
   - Stages: `$match` (agent + date range) → `$project` (session duration from clock-in/out) → `$group` (sum duration).

3. **AHT aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Computes average handle time for resolved tickets.
   - Stages: `$match` (resolved + valid timestamps + date range) → `$group` (sum total time and count).

### B) Queue stats pipeline (`getQueueStats`)
4. **Global ticket stats aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Builds dashboard counters in one DB round-trip.
   - Stages: `$facet` with:
     - `statusCounts`: `$group` by ticket status.
     - `totalCount`: `$count` total tickets.
     - `ahtStats`: `$match` resolved tickets then `$group` total handle time + count.

### C) Agent analytics pipelines (`getAgentAnalytics`)
5. **Ticket trend aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Daily raised vs resolved trend for the last 7 days.
   - Stages: `$match` (agent + last 7 days) → `$group` by day (`$dateToString`) → `$sort`.

6. **Session trend aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Daily online hours for the last 7 days.
   - Stages: `$match` → `$project` (duration + day) → `$group` by day → `$sort`.

7. **Overall ratio + AHT aggregate** in `analyticsController`:
   - File: `backend/controllers/analyticsController.js`
   - Purpose: Single query for lifetime totals (`raised/resolved/rejected`) and AHT.
   - Stages: `$match` agent → `$facet` with:
     - `ratios`: `$group` with conditional status sums.
     - `aht`: `$match` resolved with timestamps → `$group` totalTime + count.

### D) Session dedupe pipeline (`getAllSessions`)
8. **Latest session per agent** in `agentController`:
   - File: `backend/controllers/agentController.js`
   - Purpose: Returns one latest session document per agent.
   - Stages: `$sort` by `updatedAt` desc → `$group` by `agentId` taking `$first` → `$replaceRoot`.

---

## 3) Why aggregations are used here
- They reduce multiple queries into one pipeline (especially with `$facet`).
- They return API-ready dashboard/report metrics without post-processing large arrays in Node.
- They keep analytics work in MongoDB where grouping/filtering over large collections is optimized.

---

## 4) Push checklist (copy/paste commands)

```bash
git status --short
git add -A
git commit -m "fix: stabilize dashboards, enforce call duration, cleanup artifacts"
git push
```

If your branch has no upstream yet:

```bash
git push -u origin <your-branch-name>
```

---

## 5) Suggested PR description (copy/paste)

### Summary
This PR stabilizes Agent and Supervisor dashboard behavior, enforces required ticket fields, improves UX around file uploads, and cleans runtime artifacts before release.

### Key changes
- Fixed supervisor dashboard errors and improved long-running data freshness.
- Added remove-file control (X icon) for agent ticket attachments.
- Made call duration mandatory for agent-generated tickets (frontend + backend validation).
- Improved backend startup resilience to reduce local crash/fetch-failure loops.
- Removed debug/crash artifact files and added ignore rules.

### Validation
- Supervisor dashboard lint: clean.
- Target frontend components: compile/lint clean.
- Backend ports startup checked after clear-ports flow.

### Risk
- Low to medium: validation is stricter for agent ticket creation; supervisor ticket creation remains allowed without call duration.
