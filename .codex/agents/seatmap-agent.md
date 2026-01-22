# Seatmap Updates Summary (Jan 2026)

## Core Interaction Changes
- Dragging seats/shapes now updates position during drag (raf-throttled) to prevent flicker.
- Stage pan is disabled while dragging nodes; stage drag end only updates viewport if the stage is the drag target.
- Trackpad navigation: two-finger scroll pans; pinch zoom zooms to cursor with limits (min 0.4, max 3).
- Right-click pans the canvas; context menu suppressed.
- Reset View now fits all nodes (seats + shapes) to viewport with padding.
- Multi-select supported via Shift/Ctrl/Cmd toggle on click/tap.
- Marquee (rubber-band) selection added in select mode; Shift/Ctrl add, Alt subtract, intersection-based hit testing.

## Draw Mode (Shapes)
- New `mode: "draw"` and draw shape selection in Redux.
- Shapes are created via click-drag (rubber-band) in draw mode (no drag/drop for shapes).
- Supported shapes: rect, circle, hexagon (polygon), line, text. Stairs removed from UI.
- Draft preview layer renders while dragging; commit on mouse up.
- Circle/polygon radius uses min(width,height)/2; center at drag midpoint.
- Text shape is placed on click (no drag sizing) with default styling.

## Seat Types
- `seatType` added to seat nodes: `"standard"` (default) or `"vip"`.
- Sidebar has Standard Seat and VIP Seat drag tiles.
- Seat rendering swaps SVGs based on type and selection:
  - Standard: `/seat-default.svg`, `/seat-selected.svg`
  - VIP: `/default-vip-seat.svg`, `/selected-vip-seat.svg`

## Selection Panel
- Shows scale values (scaleX / scaleY).
- Shows scale values (scaleX / scaleY).
- Shape color palette split into Stroke Color and Fill Color pickers.
  - Lines only use stroke; fill picker hidden for lines.
- Text shapes have a text input + font size control.
- Dashed stroke toggle (checkbox) added for shapes.
- Text shapes include transparent stroke/fill options.

## Rotation & Resize
- Rotation supported via Transformer and keyboard.
- Keyboard: `[` / `]` rotate 5°, Shift rotates 15°.
- Transformer rotation uses Shift snap (15°).
- Resize enabled for shapes and seats with min/max bounds:
  - Seats: min 16, max 320.
  - Shapes: min 10, max 800.
- Lines: resize via draggable endpoint handles; min line length enforced.
- Keyboard scale now scales line endpoints instead of scale transforms.
- Multi-selection group Transformer added (single transformers hidden when multi-select).
- Group rotation: default orbits around selection; Alt rotates in place; Shift snapping still applies.
- Group multi-drag moves all selected nodes together with one history entry.

## Seatmap Layout
- Seatmap layout now uses shadcn `SidebarProvider` + `SidebarInset`.
- Seat palette moved into `SeatMapSidebar` (non-gutter offcanvas collapse).
- New non-sticky `SeatmapPageHeader` mirrors `PageHeader` without `StickyHeader`.
- Hexagon palette icon replaced with an SVG polygon for correct display.

## Konva Performance
- Consolidated the Stage tree into a single `Layer`, with `SeatLayer` and `SectionLayer` rendering `Group` wrappers instead of nested layers to reduce the layer count warning.

## Files Touched (Seatmap)
- `components/seatmap/SeatmapCanvas.tsx`
- `components/seatmap/SeatLayer.tsx`
- `components/seatmap/SectionLayer.tsx`
- `components/seatmap/UIOverlays.tsx`
- `components/seatmap/seatmap-sidebar.tsx`
- `components/seatmap/seatmap-page-header.tsx`
- `lib/features/seatmap/seatmapSlice.ts`
- `lib/seatmap/types.ts`
- `app/test/page.tsx`
