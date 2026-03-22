# Components Context

This folder contains reusable React UI for Seatwise.

## Working rules

- Reuse shared primitives before creating new component patterns.
- Keep layout and spacing consistent with the current design system.
- Prefer small, composable components over page-local duplication.

## Key subareas

- `components/ui/` shared primitives
- `components/show/` show detail and public-facing show content
- `components/queue/` reservation queue and reserve flow
- `components/seatmap/` seat selection and map display

## Before editing

- Check whether the change belongs in a shared primitive or in a feature component.
- For modal, card, badge, dialog, or label changes, inspect `components/ui/` first.
