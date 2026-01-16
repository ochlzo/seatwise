# Security Rules

This document outlines the security protocols and requirements for the Seatwise repository. All developers and AI agents must adhere to these rules to ensure the safety of user data and system integrity.

---

## 1. Authentication (Firebase + Sessions)

The application uses a hybrid authentication model: Firebase Client SDK for login/signup and Firebase Admin SDK for session management and server-side verification.

- **Session Cookies**: Authentication is managed via a `session` cookie. 
- **Server-Side Verification**: 
    - Every protected API route or Server Action MUST verify the session cookie using `adminAuth.verifySessionCookie(sessionCookie, true)`.
    - Verification should occur at the start of the request.
- **Client-Side Safety**: 
    - NEVER import `firebase-admin` or anything from `lib/firebaseAdmin.ts` into a client component.
    - NEVER expose the Firebase Service Account key or private keys to the client.

---

## 2. Authorization (RBAC)

Seatwise uses Role-Based Access Control (RBAC) to restrict access to sensitive features.

- **Role Verification**: High-privilege actions (like administrative tasks) must use the `verifyAdmin()` helper from `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\auth\admin.ts`.
- **Ownership Enforcement**: 
    - Users should only be able to read or modify data that belongs to them.
    - Always filter database queries using the `uid` extracted from the verified session token.
    - Example: `prisma.user.findUnique({ where: { firebase_uid: decodedToken.uid } })`.

---

## 3. Data Protection & Environment Variables

- **Secret Management**:
    - All secrets (API keys, DB URLs, Firebase private keys) must be stored in `.env` and never hardcoded.
    - Ensure `.env` is listed in `.gitignore`.
- **Environment Variable Scope**:
    - Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Only public configuration (like Firebase Client config) should use this prefix.
    - Sensitive keys (Neon, Cloudinary API Secret, Firebase Admin) MUST NOT have the `NEXT_PUBLIC_` prefix.

---

## 4. Input Validation & Sanitization

- **Strict Typing**: Use TypeScript interfaces for all request payloads.
- **Validation**:
    - All incoming data for `POST`, `PUT`, and `PATCH` requests MUST be validated (e.g., using Zod or manual checks) before processing or saving to the database.
    - Validate the format and length of strings (usernames, emails, etc.).
- **SQL Injection**: Always use the Prisma ORM for database interactions. Avoid raw queries (`prisma.$queryRaw`) unless strictly necessary and properly escaped.

---

## 5. Cloud Storage Security (Cloudinary)

- **Server-Side Uploads Only**: 
    - NEVER perform direct uploads from the client using the `api_secret`.
    - Always use Server Actions or API routes for uploads.
    - Cloudinary uploads should only happen after user session verification.
- **Path Isolation**:
    - Enforce a strict folder structure: `seatwise/avatars/user_custom/${uid}`.
    - Custom avatars should use the user's `uid` as the `public_id` to prevent redundant storage.
- **Optimized Delivery**:
    - Always use secure HTTPS URLs (`secure_url`) returned by the Cloudinary SDK.

---

## 6. API Security

- **Status Codes**: Return appropriate HTTP status codes to avoid leaking information:
    - `401 Unauthorized`: For missing or invalid sessions.
    - `403 Forbidden`: For valid sessions that lack proper roles.
- **CORS**: Next.js App Router routes are private by default. Do not open CORS wide unless a specific external integration requires it.
- **Rate Limiting**: Be mindful of expensive database or external API operations that could be exploited for DoS.

---

## 7. Database Safety (Prisma/Neon)

- **Server-Only Access**: Prisma client imports MUST only happen in Server Components, Route Handlers, or `lib/` helpers.
- **Sensitive Fields**: Ensure that UI responses do not accidentally return sensitive database fields (like internal IDs or transition states) unless required by the frontend.
