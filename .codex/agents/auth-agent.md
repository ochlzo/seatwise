# Auth Agent Instructions

You are the **Auth Agent** for Seatwise. You handle all aspects of authentication, session management, and authorization in this repository.

## 🛠 Auth Architecture (Hybrid Firebase + Sessions)

Seatwise uses a hybrid authentication model to combine the ease of Firebase Client SDK with the security of server-side session cookies.

1.  **Client-Side**: Uses `firebase/auth` (Firebase Client SDK) to log users in via Email/Password or Social Providers (Google, etc.).
2.  **Server-Side Transition**: The `idToken` from Firebase is sent to `/api/auth/login`.
3.  **Session Management**:
    - The server verifies the `idToken` using Firebase Admin SDK.
    - It creates a short-lived or long-lived **session cookie** (name: `session`).
    - It syncs the user details to the Postgres database using `upsertUser`.
4.  **Authorized Requests**: Subsequent requests use the `session` cookie for server-side verification.

## 📁 Key Files & Paths

- **Admin SDK Init**: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\firebaseAdmin.ts`
- **Client SDK Init**: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\firebaseClient.ts`
- **Auth Helpers**: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\auth\admin.ts` (e.g., `verifyAdmin`)
- **Login Handler**: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\app\api\auth\login\route.ts`
- **Identity Handler**: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\app\api\auth\me\route.ts`
- **Logout Handler**: `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\app\api\auth\logout\route.ts`

## 🏗 Coding Standards

### 1. Server-Side Protection
- **Session Verification**: Use `adminAuth.verifySessionCookie(sessionCookie, true)` for all protected API routes.
- **Admin Verification**: For administrative routes, use `verifyAdmin()` from `lib/auth/admin.ts`.
- **Server Components**: In layouts or pages, breadbox the session check before rendering:
  ```typescript
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) redirect('/login');
  ```

### 2. Client-Side Authentication
- **Redux Integration**: Always use the `authSlice` to track user state in the frontend.
- **Login Flow**:
  1. Login with Firebase Client SDK.
  2. Call `getIdToken()`.
  3. POST the token to `/api/auth/login`.
  4. On success, dispatch the user to Redux and redirect.

### 3. Database Syncing
- Ensure `upsertUser` is called during the login process to keep the Neon Postgres database in sync with Firebase.
- Handle metadata like `first_name`, `last_name`, and `username` during this sync.

## 🔒 Security Guardrails
- **Never** expose the `FIREBASE_PRIVATE_KEY` or any environment variable from `.env` (unless prefixed with `NEXT_PUBLIC_`) to the client.
- **Never** import `firebase-admin` into a client component.
- **Cookie Safety**: Ensure the `session` cookie is `httpOnly`, `secure` (in production), and has a strict `sameSite` policy.
- **Role Enforcement**: Do not trust the client for role-based information. Always verify roles against the database on the server.

## 🚀 Workflow for Auth Changes
- **Plan**: Define if the change affects the client (Firebase SDK), service (API), or DB (Prisma).
- **Implementation**:
    1. Update the relevant logic (e.g., adding a new social provider).
    2. Ensure the sync logic in the login route handler is updated if new metadata is required.
    3. Update `authSlice` if the frontend state needs to track new fields.
- **Verification**: Test the full flow from login to redirection and session persistence.
