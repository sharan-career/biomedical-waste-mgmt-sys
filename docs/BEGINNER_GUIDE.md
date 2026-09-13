# Beginner's Guide to This Stack

You don't need to know NestJS, Prisma, or Next.js before reading this — it explains each piece
using the actual code in this repo as the example. Read it alongside the files it points to.

---

## 1. The big picture

Two separate programs talk to each other over HTTP:

```
Browser (you)  →  frontend/ (Next.js, runs on :3000)  →  backend/ (NestJS, runs on :3001)  →  Postgres
```

- **Frontend** = what the user sees and clicks. It has no direct access to the database — it only
  ever calls the backend's API (`http://localhost:3001/api/v1/...`).
- **Backend** = the API. It owns all business rules ("only a Super Admin can create a user") and is
  the only thing that talks to the database.
- **Database (Postgres)** = where data actually lives, on disk, permanently.

Nothing here is unusual — this is the standard shape of almost every web app you've ever used.

---

## 2. Backend: NestJS

NestJS is a framework for building APIs in TypeScript. Think of it as "opinionated Express" — it
gives you a folder structure and set of building blocks so every feature looks the same, instead of
everyone inventing their own way to organize an API.

### The building blocks

**Module** — a folder that groups one feature together. Look at [`backend/src/modules/users/`](../backend/src/modules/users/):
```
users.module.ts       ← registers everything below with NestJS
users.controller.ts   ← defines the HTTP routes (GET /users, POST /users, ...)
users.service.ts       ← the actual logic (talks to the database, enforces rules)
dto/                   ← shapes of the data going in/out (see §4)
```
Every feature (Auth, Users, and soon Customers) is its own module. `app.module.ts` is the root that
imports all of them.

**Controller** — maps an HTTP request to a method. In
[`users.controller.ts`](../backend/src/modules/users/users.controller.ts):
```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return this.usersService.findOneOrThrow(id);
}
```
`@Get(':id')` means "when someone does `GET /users/abc123`, run this method with `id = 'abc123'`."
The controller itself does no logic — it just calls the service and returns what it gets back.

**Service** — where the actual work happens: database queries, validation, business rules. Look at
[`users.service.ts`](../backend/src/modules/users/users.service.ts) — `create()`, `findAll()`,
`update()` etc. Controllers are thin, services are where the logic lives. This separation exists so
you can test business logic (the service) without spinning up a whole HTTP server — see
[`auth.service.spec.ts`](../backend/src/modules/auth/auth.service.spec.ts) for exactly that.

**Decorators** (the `@Something()` lines) — NestJS's way of attaching metadata to a class or method
without writing boilerplate. `@Controller('users')`, `@Get()`, `@Roles(RoleName.SUPER_ADMIN)` are
all decorators. You'll see them everywhere; they're just annotations NestJS reads at startup.

**Guards** — code that runs *before* your route handler and can block the request. This app has two,
applied globally (see [`app.module.ts`](../backend/src/app.module.ts)):
- `JwtAuthGuard` — checks "is there a valid access token?" Rejects with 401 if not (unless the route
  is marked `@Public()`).
- `RolesGuard` — checks "does this user have one of the `@Roles(...)` required for this route?"
  Rejects with 403 if not.

**Interceptors / Filters** — code that wraps the *response* instead of the request.
[`ResponseInterceptor`](../backend/src/common/interceptors/response.interceptor.ts) wraps every
successful response in `{ data: ... }` so the frontend always knows what shape to expect.
[`AllExceptionsFilter`](../backend/src/common/filters/all-exceptions.filter.ts) does the same for
errors — every error becomes `{ error: { code, message } }`, no matter what went wrong internally.

### Why this matters for you

When you add a new feature (like Customers in Phase 2), you're doing the *same thing* every time:
add a Prisma model → write a service with the CRUD logic → write a controller with the routes →
register a module → import that module in `app.module.ts`. Once Phase 2 is done, you'll have seen
this pattern three times (Auth, Users, Customers) and it'll feel mechanical.

---

## 3. Database: Prisma + PostgreSQL

**PostgreSQL** is the actual database — a program that stores your data in tables, on disk. It's
running right now as a Windows service on your machine (`postgresql-x64-17`), separate from the
Node.js backend.

**Prisma** is how the NestJS code talks to Postgres *without writing raw SQL*. Three pieces:

1. **`backend/prisma/schema.prisma`** — you describe your data model here, e.g.:
   ```prisma
   model User {
     id           String   @id @default(uuid())
     email        String   @unique
     passwordHash String
     roles        UserRole[]
   }
   ```
   This is the single source of truth for what tables/columns exist.

2. **Migrations** (`backend/prisma/migrations/`) — every time you change `schema.prisma`, you run
   `npx prisma migrate dev --name something`. Prisma diffs your schema against the database, writes
   the exact SQL needed (`CREATE TABLE`, `ALTER TABLE`, ...) into a new migration file, and applies
   it. This is how the database structure evolves safely over time, with a history you can replay on
   any machine (or in production) to end up with the same schema.

3. **Prisma Client** — after you run `npx prisma generate`, Prisma reads your schema and generates a
   fully-typed TypeScript client. That's why `this.prisma.user.findUnique({ where: { email } })` in
   [`auth.service.ts`](../backend/src/modules/auth/auth.service.ts) autocompletes and type-checks —
   Prisma generated that `user.findUnique` method and its types from your schema.

You'll run these three commands constantly during development:
```bash
npx prisma migrate dev --name add_customers   # after editing schema.prisma
npx prisma generate                            # regenerate the typed client (migrate dev does this for you)
npx prisma studio                              # opens a GUI in your browser to browse/edit table data
```

---

## 4. DTOs and validation

A **DTO** (Data Transfer Object) is just a class describing what a request body should look like,
decorated with validation rules. Example, [`create-user.dto.ts`](../backend/src/modules/users/dto/create-user.dto.ts):

```ts
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

When a `POST /users` request comes in, NestJS's global `ValidationPipe` (set up in
[`main.ts`](../backend/src/main.ts)) automatically checks the request body against this class. If
`email` isn't a valid email, the request is rejected with a 400 *before your code even runs* — you
never have to write `if (!email.includes('@')) throw ...` by hand.

---

## 5. Auth: JWTs, access tokens, refresh tokens

This trips up most beginners, so slowly:

- When you log in (`POST /auth/login`), the backend gives you back **two tokens**:
  - **Access token** — a JWT (a signed, tamper-proof string encoding your user id + roles), valid
    for 15 minutes. You send this on every request (`Authorization: Bearer <token>`). The backend
    verifies its signature and reads your identity straight out of it — no database lookup needed,
    which is what makes JWTs fast.
  - **Refresh token** — a long random string, valid for 7 days, stored *hashed* in the database.
    When your access token expires, you send the refresh token to `POST /auth/refresh` to get a new
    pair. This is why you don't get logged out every 15 minutes.
- **Why rotate refresh tokens?** Every time you refresh, the old refresh token is revoked and a new
  one issued. If someone ever steals an old (already-used) refresh token and tries to use it, the
  backend detects the reuse and revokes *all* your sessions — see the reuse-detection logic in
  [`auth.service.ts`](../backend/src/modules/auth/auth.service.ts) `refresh()`. This limits the
  damage if a refresh token ever leaks.
- **Where do tokens live in the frontend?** Right now, in `localStorage` (see
  [`api-client.ts`](../frontend/src/lib/api-client.ts)) — simplest option for now, flagged in the
  README as something to harden later (httpOnly cookies) before real production use.

---

## 6. RBAC (Role-Based Access Control)

"Only a Super Admin can deactivate a user" is enforced with one line on the controller method:
```ts
@Roles(RoleName.SUPER_ADMIN)
```
No `@Roles()` at all means "any logged-in user can call this" — see `GET /users/me`, which every
authenticated user needs regardless of role. The check itself happens in
[`roles.guard.ts`](../backend/src/common/guards/roles.guard.ts) — it reads whatever roles you put in
`@Roles(...)` and compares them to the roles on the logged-in user's JWT.

---

## 7. Frontend: Next.js + React

**React** — a library for building UI out of small, reusable pieces called **components**. A
component is just a function that returns some JSX (HTML-like syntax mixed with TypeScript). See
[`login/page.tsx`](../frontend/src/app/login/page.tsx) — `LoginPage()` is a component.

**Next.js** — a framework on top of React that adds file-based routing and a lot of production
tooling. The rule: whatever folder path you create under `src/app/`, that becomes the URL.
`src/app/login/page.tsx` → `/login`. `src/app/dashboard/page.tsx` → `/dashboard`. No route
configuration file to maintain — the folder structure *is* the router.

**`'use client'`** — at the top of a file, this tells Next.js "run this component in the browser,
not on the server." Every interactive page in this app (forms, buttons, anything using `useState`)
needs this, because Next.js defaults to rendering on the server where there's no browser to click
things in.

**Hooks** (`useState`, `useEffect`, `useContext` — anything starting with `use`) — React's way of
giving a component memory and side effects. `useState` remembers a value across re-renders;
`useEffect` runs code when something changes (e.g., "when the page loads, check if I'm logged in" in
[`auth-context.tsx`](../frontend/src/lib/auth-context.tsx)).

**Context** (`AuthProvider` / `useAuth()` in `auth-context.tsx`) — React's way of sharing state
(like "who is logged in") across many components without passing it down manually through every
layer. Any component can call `useAuth()` and get `{ user, login, logout, hasRole }`.

**React Hook Form + Zod** (see `login/page.tsx`) — Zod defines what a valid form looks like (`z.string().email()`),
React Hook Form wires that validation up to actual `<input>` fields and shows errors, so you don't
hand-write `onChange` handlers and manual validation for every field.

**TanStack Query** — installed and wired up (`app/providers.tsx`) but not yet used for data-fetching;
it'll matter starting Phase 2 when we have real lists of data (customers) to fetch, cache, and
refetch after mutations, rather than raw `fetch()` calls everywhere.

---

## 8. How a request actually flows, end to end

Worked example: you click "Sign in" on the login page.

1. `LoginPage` calls `login(email, password)` from `useAuth()`.
2. `auth-context.tsx`'s `login()` calls `apiRequest('/auth/login', { method: 'POST', body: {...} })`.
3. `api-client.ts` does `fetch('http://localhost:3001/api/v1/auth/login', ...)`.
4. NestJS receives it. `AuthController.login()` is matched, `LoginDto` validates the body shape.
5. `AuthService.login()` runs: looks up the user via Prisma, checks the password with bcrypt, writes
   an audit log row, issues a JWT + refresh token, saves the refresh token (hashed) via Prisma.
6. The response passes through `ResponseInterceptor`, becomes `{ data: { accessToken, refreshToken } }`.
7. Back in the frontend, `auth-context.tsx` stores both tokens in `localStorage`, then calls
   `GET /users/me` to load your profile.
8. React re-renders; `RequireAuth` sees `user` is now set and lets you through to `/dashboard`.

Every future feature (Customers, Invoices, Payments...) follows this same shape — once you've traced
this one request end-to-end, you've essentially seen the whole system's architecture.

---

## 9. Testing

Unit tests live next to the code they test (`*.spec.ts`). See
[`auth.service.spec.ts`](../backend/src/modules/auth/auth.service.spec.ts) — it creates an
`AuthService` with *fake* (mocked) Prisma/JWT/Config objects, so the test runs in milliseconds
without touching a real database, and only checks "does the logic behave correctly given these
inputs." Run them with `npm test` inside `backend/`.

---

## 10. Where to look things up

- NestJS docs: https://docs.nestjs.com (their "Overview" section covers everything in §2 above)
- Prisma docs: https://www.prisma.io/docs (their "Getting Started" + "Prisma Client" guides)
- Next.js docs (App Router): https://nextjs.org/docs/app
- React docs: https://react.dev/learn (short, excellent, start with "Describing the UI")
