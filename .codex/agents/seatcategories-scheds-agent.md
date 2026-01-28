# Seat Categories + Schedules (Schema + Create Show)

## Current Schema Intent
- `SeatCategory` is **scoped to a Seatmap** via `seatmap_id`. It stores `category_name`, `price`, and `color_code`.
- `Set` links a **schedule (`Sched`) to a seat category (`SeatCategory`)**. A schedule can have many categories via multiple `Set` rows.
- `SeatAssignment` optionally points to a `Set` via `set_id` (used later for seat distribution). Do **not** touch `Seat` or `SeatAssignment` yet unless explicitly requested.

## Create Show Flow (lib/actions/createShow.ts)
When creating a show:
1. Create `Show`.
2. Create each `Sched` row (one per schedule in the payload) and store a map of `client_id -> sched_id`.
3. If categories are provided:
   - Deduplicate by `category_name`.
   - Look up existing `SeatCategory` for the selected `seatmap_id`.
   - Create missing `SeatCategory` rows with `category_name`, `price`, `color_code`, `seatmap_id`.
   - Build `Set` rows by pairing each category with target schedules:
     - If `apply_to_all` is true, link to all created schedules.
     - Otherwise, link only to `sched_ids` provided (mapped via client_id).
   - Create `Set` rows via `createMany(..., skipDuplicates: true)`.

## Payload Shape (CreateShowForm -> createShowAction)
`categories` payload items:
- `category_name` (string)
- `price` (string; decimal)
- `color_code` (enum `ColorCodes`)
- `apply_to_all` (boolean)
- `sched_ids` (array of client schedule IDs)

## API Routes
- `/api/seatmaps/[seatmapId]` includes `seatCategories` in response (from `SeatCategory` by seatmap).
- `/api/seatCategories/[seatmapId]` returns categories scoped to the seatmap and includes linked `sets` with `sched`.

## Key Rules
- Categories belong to **seatmaps**, not shows.
- Schedule-category linkage is via **Set** rows.
- Seat distribution (Seat + SeatAssignment) is handled later by user action.
