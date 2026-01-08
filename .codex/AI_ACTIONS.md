# AI_ACTIONS.md (Action Code Router)

This repository uses ACTION CODES to load role- and topic-specific instructions.

## How to use

When a prompt includes ACTION CODES, do the following in order:

1. Read `AI_CONTEXT.md` first
2. Read the relevant files for each ACTION CODE below
3. Apply their rules while implementing the task
4. Follow the required workflow: Plan → Files → Implementation → Verification → Risks

If a referenced file does not exist in the repo, do not invent it. Ask or search first.

---

## ACTION CODES

### 1 — Backend / API Work

Use for:

- creating or updating `app/api/**/route.ts`
- server-side logic, business rules, request handling
- input validation and error handling

Read in order:

1. `.codex/agents/backend-agent.md`
2. `.codex/rules/api.md`
3. `.codex/rules/nextjs.md`
4. `.codex/rules/ecurity.md`
5. `.codex/rules/conventions.md`

---

### 2 — Frontend / UI Work

Use for:

- building pages/components
- client state changes
- form handling, UI rendering
- client-side fetching patterns

Read in order:

1. `.codex/agents/frontend-agent.md`
2. `.codex/rules/nextjs.md`
3. `.codex/rules/conventions.md`
4. `.codex/rules/security.md`

---

### 3 — Data Fetching / Caching / State

Use for:

- server vs client fetching decisions
- Redux Toolkit patterns
- caching, revalidation, performance concerns
- API call conventions from UI

Read in order:

1. `.codex/rules/data-fetching.md`
2. `.codex/rules/nextjs.md`
3. `.codex/rules/api.md`
4. `.codex/rules/conventions.md`

---

### 4 — Database / Prisma / Neon

Use for:

- schema changes
- migrations, seed changes
- repository patterns and query logic

Read in order:

1. `.codex/agents/database-agent.md`
2. `.codex/rules/prisma.md`
3. `.codex/rules/neon.md`
4. `.codex/rules/security.md`

---

### 5 — Authentication / Authorization (Firebase + Sessions)

Use for:

- session cookie login/logout/me
- protecting API routes
- role checks, user identity, access control

Read in order:

1. `.codex/agents/auth-agent.md`
2. `.codex/rules/firebase-auth.md`
3. `.codex/rules/security.md`
4. `.codex/rules/api.md`

---

### 6 — Testing / QA / Review

Use for:

- adding tests
- reviewing changes
- edge cases and verification checklists

Read in order:

1. `.codex/agents/qa-agent.md`
2. `.codex/rules/testing.md`
3. `.codex/rules/security.md`
4. `.codex/rules/api.md`

---

## Standard Output Requirements (Always)

For any non-trivial change:
A) Plan (3–7 bullets)
B) Files to touch
C) Implementation (code changes)
D) Verification commands/checklist
E) Risks / Edge cases

---

## Quick Prompt Examples

### Example: Protected endpoint

Read `.codex/AI_CONTEXT.md`.
Then read `.codex/AI_ACTIONS.md` and apply ACTION CODES: 1,5.
Task: Create a protected API route `/api/users` that returns all users.

### Example: Add a Prisma model + endpoint

Read `AI_CONTEXT.md`.
Then read `AI_ACTIONS.md` and apply ACTION CODES: 4,1,5.
Task: Add `Post` model linked to users, migrate schema, then implement `/api/posts`.

### Example: UI page consuming protected API

Read `.codex/AI_CONTEXT.md`.
Then read `.codex/AI_ACTIONS.md` and apply ACTION CODES: 2,3,5.
Task: Create a dashboard page that fetches `/api/user/profile` and displays user info.
