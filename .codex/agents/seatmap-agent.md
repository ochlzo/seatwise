# Seatmap Updates Summary (Jan 2026)

## Core Interaction Changes
- Dragging seats/shapes now updates position during drag (raf-throttled) to prevent flicker.
- Stage pan is disabled while dragging nodes; stage drag end only updates viewport if the stage is the drag target.
- Trackpad navigation: two-finger scroll pans; pinch zoom zooms to cursor with limits (min 0.4, max 3).
- Right-click pans the canvas; context menu suppressed.
- Reset View now fits all nodes (seats + shapes) to viewport with padding.

## Draw Mode (Shapes)
- New `mode: "draw"` and draw shape selection in Redux.
- Shapes are created via click-drag (rubber-band) in draw mode (no drag/drop for shapes).
- Supported shapes: rect, circle, hexagon (polygon), line, dashed line. Stairs removed from UI.
- Draft preview layer renders while dragging; commit on mouse up.
- Circle/polygon radius uses min(width,height)/2; center at drag midpoint.

## Seat Types
- `seatType` added to seat nodes: `"standard"` (default) or `"vip"`.
- Sidebar has Standard Seat and VIP Seat drag tiles.
- Seat rendering swaps SVGs based on type and selection:
  - Standard: `/seat-default.svg`, `/seat-selected.svg`
  - VIP: `/default-vip-seat.svg`, `/selected-vip-seat.svg`

## Selection Panel
- Shows scale values (scaleX / scaleY).
- Shape color palette split into Stroke Color and Fill Color pickers.
  - Lines only use stroke; fill picker hidden for lines.
- Note: editable Rotation / X/Y / Scale UI is in progress (see below).

## Rotation & Resize
- Rotation supported via Transformer and keyboard.
- Keyboard: `[` / `]` rotate 5°, Shift rotates 15°.
- Transformer rotation uses Shift snap (15°).
- Resize enabled for shapes and seats with min/max bounds:
  - Seats: min 16, max 320.
  - Shapes: min 10, max 800.
- Lines: resize via draggable endpoint handles; min line length enforced.
- Keyboard scale now scales line endpoints instead of scale transforms.

## Files Touched (Seatmap)
- `components/seatmap/SeatmapCanvas.tsx`
- `components/seatmap/SeatLayer.tsx`
- `components/seatmap/SectionLayer.tsx`
- `components/seatmap/UIOverlays.tsx`
- `lib/features/seatmap/seatmapSlice.ts`
- `lib/seatmap/types.ts`
- `public/seat-selected.svg` (new)
- `public/default-vip-seat.svg`, `public/selected-vip-seat.svg` (used)

## Notes / Follow-ups
- Editable fields (Rotation / X/Y / Scale) were requested; helper functions were added in `components/seatmap/UIOverlays.tsx`, but the UI inputs still show static text due to a failed patch. Update that block to use inputs and wire `updateRotation`, `updatePosition`, `updateScale`.
