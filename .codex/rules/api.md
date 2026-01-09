# API Rules

This document defines the standards for implementing and maintaining API Route Handlers in the Seatwise repository.

---

## 1. Structure & Routing

- **Location**: All API routes MUST be located in `app/api/`.
- **Naming**: Use kebab-case for folder names (e.g., `/api/user-profile/`).
- **Handlers**: Use Next.js 15+ App Router `route.ts` files with exported functions for each HTTP method (GET, POST, PUT, DELETE, PATCH).

---

## 2. Request Handling

- **Validation**:
    - Every non-GET request body MUST be validated using a Zod schema (stored in `lib/validation/`).
    - Handlers should return `400 Bad Request` if validation fails.
- **Payload Extraction**:
    - Use `await req.json()` for POST/PUT/PATCH bodies.
    - Use `req.nextUrl.searchParams` for query parameters in GET requests.

---

## 3. Response Standard (Envelope)

All new API responses MUST follow a consistent envelope structure to allow the frontend to handle success and failure predictably.

### Success Response
- **Status**: `200 OK` (or `201 Created` for new resources)
- **Body**:
```json
{
  "ok": true,
  "data": { ... }
}
```

### Error Response
- **Status**: Appropriate 4xx or 5xx code.
- **Body**:
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_SLUG",
    "message": "Human readable message",
    "details": { ... } 
  }
}
```

---

## 4. Status Codes

- `200 OK`: Successful request.
- `201 Created`: Successful creation of a resource.
- `400 Bad Request`: Validation errors or malformed input.
- `401 Unauthorized`: Missing or invalid session cookie.
- `403 Forbidden`: Authenticated user lacks roles (e.g., needs ADMIN).
- `404 Not Found`: The requested resource does not exist.
- `500 Internal Server Error`: Unhandled server-side exceptions.

---

## 5. Middleware & Security

- **Authentication**:
    - Protected routes MUST check the `session` cookie.
    - Use the pattern: `const session = (await cookies()).get("session")?.value;`
    - Verify via `adminAuth.verifySessionCookie(session, true)`.
- **CORS**: Private by default. Do not implement custom CORS headers unless explicitly required for external integrations.
- **Methods**: Only expose the HTTP methods that are actually implemented.

---

## 6. Business Logic Separation

- **Thin Handlers**: Logic MUST NOT be contained within the handler function.
- **Repositories**: Database interactions must be offloaded to `lib/db/`.
- **Services/Actions**: Complex multi-step operations or external API calls (e.g., Stripe, Cloudinary) should live in `lib/services/` or `lib/actions/`.

---

## 7. Versioning

- Currently, we use unversioned routes.
- If breaking changes are required for a shared API, consider `/api/v1/resource/` or `/api/v2/resource/`.

---

## 8. Naming in JSON

- Use **camelCase** for properties in the JSON request and response bodies.
- ✅ `userId`
- ❌ `user_id`
*(Note: Database fields may use snake_case, but the API should transform these for frontend consumption.)*
