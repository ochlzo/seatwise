# AI_CONTEXT.md (Repo Instructions)

You are an AI assistant working in a **Next.js App Router + Prisma + Neon + Firebase Auth** repository using **TypeScript** and **Redux Toolkit**.

Your job is to help implement features, fix bugs, and refactor code while preserving the repository’s architecture and conventions.

---

## 0) Operating Principles (Read First)

### ✅ Always prefer repo truth over assumptions

- If a referenced file, function, or pattern does **not exist**, do **not invent it**.
- Instead, ask for clarification or search the repo (if your tool supports it), then proceed.

### ✅ Keep changes minimal and consistent

- Follow existing patterns already used in the codebase.
- Avoid introducing new frameworks/libraries unless explicitly requested.

### ✅ Be explicit and safe

- Avoid breaking changes unless the task explicitly requires them.
- Call out risks, edge cases, and behavior changes.

---

## 1) Core Rules

### Next.js / React

- **Server Components by default**. Add `"use client"` only when necessary.
- Never import server-only modules into client code.
- Keep side effects out of Server Components (no browser-only APIs).

### Firebase Auth

- Never import Firebase Admin in client code.
- Auth flows use:
  - Firebase **Client SDK** on the frontend
  - Firebase **Admin SDK** on the backend
- Session model:
  - server sets a `session` cookie after login
  - `/api/auth/me` reads/validates it
  - protected routes must enforce auth

### Prisma / Neon

- Prisma queries must be **server-only**.
- Use the shared Prisma client in `lib/prisma.ts`.
- Assume Neon Postgres is the DB backend.
- If migrations or schema changes are required, explain the steps and warn about environment safety.

### Route Handlers / API

- `app/api/**/route.ts` should be **thin**:
  - parse request
  - validate input
  - enforce auth (if needed)
  - call helper/service functions
  - return response
- Prefer placing reusable logic in `lib/` helpers where possible.
- Do not change existing endpoint response shapes unless explicitly asked.

---

## 2) Current Architecture (Source of Truth)

- Router: **App Router** (`app/`), not Pages Router.
- Auth: Firebase client SDK on the frontend, Firebase Admin on the backend.
- Session: server sets `session` cookie after login; `/api/auth/me` reads it.
- Database: Neon Postgres; Prisma client generated to `lib/generated/prisma`.
- State management: Redux Toolkit:
  - slices under `lib/features/`
  - store in `lib/store.ts`
  - typed hooks in `lib/hooks.ts`
- Redux bootstrap/provider: `app/StoreProvider.tsx` (Redux provider + auth bootstrap).
- Media & Assets: **Cloudinary** (configured in `lib/cloudinary.ts`):
  - Shared default avatars stored in `seatwise/avatars/default_avatars`.
  - User custom uploads stored in `seatwise/avatars/user_custom`.
- Mutations: **Next.js Server Actions** (placed in `lib/actions/`):
  - Used for updating user profiles, avatars, and other write operations.
  - Pattern: Perform DB update in action -> `revalidatePath` -> return success/error.

---

## 3) API Response Conventions

- No global response envelope (no forced `{ ok: true, data }` wrapper).
- Endpoints return tailored JSON and status codes.
- Keep existing shapes for auth/user routes unless explicitly changing the API.

When implementing new endpoints:

- Match patterns used in existing endpoints.
- Use correct HTTP status codes.
- Provide consistent error structures **within the endpoint**, but do not enforce a global envelope.

---

## 4) Known Folder / File Structure

### Next.js routes

- `app/api/**/route.ts`: route handlers
- `app/**/page.tsx`, `app/**/layout.tsx`: UI routes and layout
- `app/StoreProvider.tsx`: Redux provider + auth bootstrap

### Shared libs

- `lib/firebaseAdmin.ts`: Firebase Admin init (server-only)
- `lib/prisma.ts`: Prisma client singleton (server-only)
- `lib/db/usersDb.ts`: user data access helpers
- `lib/db/Users.ts`: user data access helpers (alternate/legacy naming)
- `lib/cloudinary.ts`: Cloudinary SDK configuration
- `lib/actions/`: Shared Next.js Server Actions (e.g., `setAvatar.ts`)
- `lib/avatars/`: Utility functions for fetching avatar presets
- `lib/store.ts`: Redux store
- `lib/hooks.ts`: typed Redux hooks

### Redux slices

- `lib/features/auth/authSlice.ts`: auth state + `checkAuth` thunk
- `lib/features/loading/isLoadingSlice.ts`: loading state

### Prisma

- `prisma/schema.prisma`: schema

---

## 5) Change Workflow (Required Output Format)

For any non-trivial change (multiple files or multi-step logic), respond using this structure:

### ✅ A) Plan

- Brief bullet plan (3–7 bullets max)

### ✅ B) Files to touch

- List exact files that will be changed/added

### ✅ C) Implementation

- Provide code changes
- Keep changes minimal
- Follow repo patterns

### ✅ D) Verification

Suggest relevant commands/checks, for example:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma generate`
- `pnpm prisma migrate status`
- manual test checklist (auth flows, API responses, UI flow)

### ✅ E) Edge Cases / Risks

- Note auth/session pitfalls
- Note breaking changes
- Note performance or DB query risks

---

## 6) Conflict Resolution Order (If Rules Disagree)

If there is a conflict between instructions:

1. Existing repo patterns and code style win
2. This `AI_CONTEXT.md` wins
3. Agent/rule files (if provided) win
4. General best practices are last

---

## 7) Guardrails (Prevent Common AI Mistakes)

- Do not invent files, folders, or APIs that do not exist.
- Do not move large amounts of code unless requested.
- Do not introduce new architectural layers without clear need.
- Do not change auth/session behavior without explicitly confirming.
- Avoid adding `"use client"` unless necessary.
- Do not expose env vars, secrets, or admin keys to client code.
- **State Sync Pattern**: When updating data via a Server Action, always update the corresponding Redux slice (e.g., `authSlice`) on the client to ensure immediate UI consistency across sidebars, headers, and profiles.
