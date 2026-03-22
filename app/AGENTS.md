# App Route Context

This folder contains the Next.js App Router surfaces for Seatwise.

## What lives here

- Route groups for app users and admin users
- API routes under `app/api/`
- page/layout/loading/error files for routed screens

## Working rules

- Prefer the existing route-group structure.
- Keep page-specific UI close to the route that uses it.
- For API work, inspect the related `lib/` business logic before editing handlers.
- For user-facing screens, verify the matching shared components in `components/` first.

## Key patterns

- `app/(app-user)/` is the customer-facing experience.
- `app/(admin-user)/` is the admin dashboard experience.
- `app/api/` contains the backend route handlers used by those screens.

## Before editing

- Check whether the change belongs in a route, a server action, or shared library code.
- Avoid duplicating queue, reservation, or status logic inside route files.
