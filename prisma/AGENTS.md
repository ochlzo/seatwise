# Prisma Context

This subtree contains the schema and migrations for Seatwise.

## Working rules

- Check `schema.prisma` before changing reservation, show, seat, or payment behavior.
- Keep migrations aligned with the current application contract.
- Treat model relation changes as high impact.

## Key files

- `schema.prisma`
- `migrations/`

## Before editing

- Verify relation names, indexes, and uniqueness constraints.
- Check whether new behavior should be reflected in both schema and seeding/cleanup scripts.
