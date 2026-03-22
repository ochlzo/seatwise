# Shared UI Primitives

This subtree holds the shared UI building blocks used across the app.

## Working rules

- Keep primitives generic and reusable.
- Avoid feature-specific logic in shared UI files.
- Maintain consistency with the existing theme, spacing, and accessibility patterns.

## Important files

- `dialog.tsx`
- `card.tsx`
- `label.tsx`
- `button.tsx`
- `badge.tsx`

## Notes

- `DialogHeader` defaults to centered text on mobile.
- `Label` has a built-in flex + gap layout.
- If a feature needs to override these defaults, prefer a local class override in the feature component before changing the primitive.
