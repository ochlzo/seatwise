---
trigger: always_on
---

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
  - Show thumbnails stored in `seatwise/show_thumbnails`.
  - **Auto-Cleanup**: When replacing a `google_avatars` entry, the server action automatically deletes the old asset from Cloudinary to prevent storage bloat.
- Mutations: **Next.js Server Actions** (placed in `lib/actions/`):
  - Consolidated logic: `updateAvatarAction.ts` handles both preset selection and custom Cloudinary uploads in a single transactional flow.
  - Show creation uses `createShowAction` with optional base64 image upload (Cloudinary) and schedule creation in a transaction.
  - Pattern: Perform DB update in action -> `revalidatePath` -> return success/error.

---

## 3) Component Logic & UX Patterns

### Avatar Selection Flow

- **Staged Preview**: `AvatarSelect` uses `stagedBase64` to show a local preview immediately after file selection.
- **Deferred Persistence**: No database or Cloudinary writes occur until the user clicks "Save".
- **Simulated Progress**: Two progress phases—local compression (simulated) and server upload (simulated up to 95%, then finished).

### Global Progress Dialog (`UploadProgress`)

- **Auto-Close**: The dialog automatically closes **800ms** after `totalProgress` hits 100%.
- **Filename Truncation**: All filenames are truncated to **42 characters** using the `truncateText` utility to prevent layout distortion.

### File Uploader (`FileUploader`)

- **Overwrite Mode**: When `maxFiles` is 1, the uploader enters "Replacement Mode"—dropping a new file automatically replaces the current one instead of erroring.
- **Hide Remove Option**: Supports a `showRemoveButton` prop to strip redundant "x" buttons in simplified selection flows.
- **Shared Preview**: `FileImagePreview` is the shared preview component for uploaded images.

### Show Schedule Modal

- **Date Range Gate**: "Add Schedule" is disabled until `show_start_date` and `show_end_date` are valid.
- **Multi-Date Select**: Schedules are created by selecting multiple dates, then adding one or more time ranges.
- **Persisted Fields**: Each schedule row saves `sched_date`, `sched_start_time`, and `sched_end_time` (time-only fields).

---

## 4) API Response & Type Conventions

...

- State management: Redux Toolkit:
  - slices under `lib/features/`
  - store in `lib/store.ts`
  - typed hooks in `lib/hooks.ts`
  - **User Type**: The `User` interface (`authSlice.ts`) requires `firstName` and `lastName`. Always include these when manual user objects are constructed in auth hooks or login forms.

---

## 5) Known Folder / File Structure

...

- `lib/actions/updateAvatar.ts`: Consolidated avatar update action (server-only)
- `lib/utils.ts`: Includes `truncateText` and `formatBytes` utilities.

---

...

---

## 8) Guardrails (Prevent Common AI Mistakes)

- **Server Action Build Safety**: To prevent "Module not found (net/tls)" errors in Turbopack, **never** import Node-only modules (like `firebase-admin`, `cloudinary`, `prisma`) at the top level of a file containing `"use server"` if that file is imported by Client Components.
  - **Solution**: Use dynamic imports inside the action function: `const { adminAuth } = await import("@/lib/firebaseAdmin");`.
- **State Sync Pattern**: When updating data via a Server Action, always update the corresponding Redux slice (e.g., `authSlice`) on the client to ensure immediate UI consistency across sidebars, headers, and profiles.
- **File Uploader Reset**: When using the `FileUploader` as a pick-and-done tool, ensure the parent manages its state to clear/reset the component if needed.
