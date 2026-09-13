# Biomedical Waste Billing & Collection Management System

Billing + Accounts Receivable + Collection + Follow-up Management System for a biomedical waste
treatment company. See `docs/` for the full Phase 0 discovery (business requirements, user roles,
workflows, database design, API architecture, edge cases, roadmap) and `prompts/` for the phased
development prompts driving this build.

## Structure

- `backend/` — NestJS + TypeScript + Prisma + PostgreSQL API.
- `frontend/` — Next.js + TypeScript + Tailwind CSS app.
- `docs/` — Phase 0 discovery documents (read these first).
- `prompts/` — master context + business docs used to drive phased development.

## Status

**Phase 1 — Foundation & Authentication: done.** Auth (JWT access + rotating refresh tokens,
reuse detection), Users module (Super Admin-only CRUD, role assignment, status/deactivation),
global RBAC guards (`@Roles()`), audit logging, standard response/error envelope, Prisma schema
scoped to Identity & Access + Taluka/Route. See `docs/DEVELOPMENT_ROADMAP.md` for what's next
(Phase 2 — Customer Management).

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then edit DATABASE_URL / JWT secrets
npx prisma migrate dev --name init
npx prisma db seed
npm run bootstrap       # BOOTSTRAP_EMAIL=... BOOTSTRAP_PASSWORD=... env vars required
npm run start:dev
```

API runs on `http://localhost:3001/api/v1`, Swagger docs at `http://localhost:3001/api/docs`,
health check at `GET /api/v1/health`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # points at the backend above
npm run dev
```

App runs on `http://localhost:3000` — redirects to `/login`, then `/dashboard` after sign-in.

### Requirements

- Node.js 20+ (this repo was built and tested against v20.20.2 — the environment's default
  Node 14 is too old for NestJS 10 / Next.js 14).
- A running PostgreSQL instance for `DATABASE_URL`.
