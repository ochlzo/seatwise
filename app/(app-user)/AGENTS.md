# App User Routes

This subtree holds the customer-facing app screens.

## Focus

- event browsing
- reservation flow
- queue entry and reservation room flow
- public show detail pages

## Working rules

- Keep reservation flow behavior consistent with `components/queue/` and `lib/queue/`.
- Use the shared show-detail and reserve components instead of page-local duplicates.
- When a page triggers queue or reservation state, verify the API route it calls.

## Key areas

- `app/(app-user)/(events)/[showId]/page.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/`

## Before editing

- Check how the show detail page passes props into `components/show/ShowDetailPublic.tsx`.
- Confirm whether a UI change belongs in the page shell or in a shared component.
