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

**Phases 1–4 done.**
- **Phase 1 — Foundation & Authentication**: JWT auth with rotating refresh tokens + reuse
  detection, Users module (Super Admin-only CRUD), global RBAC guards, audit logging, standard
  response/error envelope.
- **Phase 2 — Customer Management**: Customer + CustomerContact CRUD, search/filter.
- **Phase 3 — Contracts & Pricing**: Contract lifecycle (DRAFT → ACTIVE → EXPIRED/TERMINATED),
  versioned RateCard + RateCardComponent pricing (flat/tiered, not usage-based).
  **Phase 4 — Invoice & Billing**: billing-run engine (contract → rate card → invoice), GST-aware
  invoice generation matching the real business's tax-inclusive pricing and invoice numbering,
  invoice lifecycle, basic credit notes, print-style Tax Invoice view.

See `docs/DEVELOPMENT_ROADMAP.md` for what's next (Phase 5 — Payments & Outstanding).

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
Both servers are up and ready:

Backend: http://localhost:3001 (health check OK)
Frontend: http://localhost:3000

To test Phase 4 in your browser:

Log in at http://localhost:3000/login with admin@biowaste.local / ChangeMe123!
Go to Customers → open City Hospital (or any customer)
In the Contracts panel, either use the existing test contract or create a new one
On the contract page, if it's not ACTIVE yet: create a rate card (e.g. PER_BED component) and Activate it
Scroll to the Invoices panel → Generate Invoice with a billing period
Click into the generated invoice — you should see the print-style Tax Invoice layout with your company details, line items, and the CGST/SGST breakdown
Try Approve → Mark Sent, and try Print to see how it renders
Try adding a Credit Note on the invoice and approving/applying it
