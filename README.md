# Dashboard V13 — Futuristic Glassmorphism Admin Workspace

A responsive, full-stack course-library dashboard inspired by the supplied Dashboard V13 reference video. Includes a React/Vite frontend, Express API, persistent SQLite database powered by `sql.js` (no native Node addon compilation), JWT login, bcrypt password hashing, course CRUD, event creation, approval actions, activity log, notifications, search, filtering, sorting and pagination.

## Requirements
- Node.js 20 or newer (Node 22 LTS recommended)
- npm

## Run locally
```bash
npm install
cp .env.example .env
npm run dev
```
Open **http://localhost:5173**. The API runs at **http://localhost:4000**.

## Demo administrator
- Email: `admin@dashboardv13.com`
- Password: `Admin123!`

Change the demo password and set a long random `JWT_SECRET` before deploying publicly. The demo account is intentionally seeded for local evaluation.

## Production build
```bash
npm install
npm run build
NODE_ENV=production npm start
```
The Express server serves the compiled frontend and API from the same origin. The SQLite database is created at `server/dashboard.sqlite` on first run. Ensure the deployment platform provides a persistent disk/volume mounted for the `server` directory (or change `DB_FILE` in `server/index.js` to a persistent path). If the host has an ephemeral filesystem, data may be lost on redeploy.

## Main API
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/courses?q=&status=&sort=`
- `POST /api/courses`
- `PUT /api/courses/:id`
- `DELETE /api/courses/:id`
- `PATCH /api/approvals/:id`
- `POST /api/events`
- `PATCH /api/notifications/read-all`
- `GET /api/health`

All dashboard and management routes except login/health require a Bearer token. The UI refreshes live dashboard data every 30 seconds and after write operations. This first release uses polling rather than WebSockets; it is appropriate for a small admin workspace and can be upgraded to Socket.IO if true push updates are needed.

## Notes
- `sql.js` is a WebAssembly SQLite implementation, avoiding native `better-sqlite3` compilation problems on newer Node versions.
- Seed data is inserted only when the database has no user records.
- The example revenue figure is calculated from course price × enrolled students, not from a connected payment processor. Connect a payment provider and persist verified transactions before treating revenue as financial reporting.
- The Students, Instructors, Analytics, Reports, Messages and Settings navigation entries are present as interface sections; dedicated management modules for those areas are planned extensions. Course management, events, approvals, authentication, notifications and activity feed are implemented in this release.
