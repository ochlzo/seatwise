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

## Seat Types & Categories
- `seatType` added to seat nodes: `"standard"` (default) or `"vip"`.
- Sidebar has Standard Seat and VIP Seat drag tiles.
- **Seat Categories**: Added support for up to 5 custom seat categories (name + color).
- Sidebar integration for managing categories with a fixed color palette.
- **Transparent Palette Swatch**: Category palette includes a `transparent` option for no-color categories.
- **No Default Category**: Seats remain uncategorized until the user assigns a category.
- Dynamic SVG swap based on category color mapping:
  - `#ffd700` -> `/vip-seat-1.svg`
  - `#e005b9` -> `/vip-seat-2.svg`
  - `#111184` -> `/vip-seat-3.svg`
  - `#800020` -> `/vip-seat-4.svg`
  - `#046307` -> `/vip-seat-5.svg`
- Category assignment panel in Selection Panel with active state highlighting.

## Seat Labeling & Numbering
- Added `rowLabel` (uppercase string) and `seatNumber` (integer) to seat nodes.
- Labels rendered directly on seat icons using Konva `Text` components.
- **Counter-Rotation**: Labels remain upright regardless of seat rotation for readability.
- **Contrast Logic**: Text color automatically switches between black and white based on the seat's background/category color.
- **Bulk Range Assignment**: Sequential numbering for multiple selected seats starting from a user-defined value.
- **Validation**: Inputs allow clearing values (sets to `undefined`) to remove labels from specific seats.

## Selection Panel
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

## Seatmap Layout & Performance
- Seatmap layout now uses shadcn `SidebarProvider` + `SidebarInset`.
- Seat palette moved into `SeatMapSidebar` (non-gutter offcanvas collapse).
- New non-sticky `SeatmapPageHeader` mirrors `PageHeader` without `StickyHeader`.
- Hexagon palette icon replaced with an SVG polygon for correct display.
- **Konva Performance**: Consolidated the Stage tree into a single `Layer`, with `SeatLayer` and `SectionLayer` rendering `Group` wrappers instead of nested layers to reduce the layer count warning.

## Export & Import (JSON & PNG)
- **Export Options Dropdown**: Replaced single export button with a dropdown for JSON and PNG formats.
- **JSON Persistence**: Full state (nodes, categories, title, snap settings) can be exported and re-imported.
- **Overwrite Protection**: A confirmation dialog (shadcn `Dialog`) warns users if they try to import a file onto a non-empty canvas.
- **Unassigned Seat Guard**: JSON export and template saves are blocked if any seat lacks a category, with a dialog warning (e.g., "Ex: Regular.").
- **High-Res PNG Export**:
  - Resolution: Exported at 3x pixel ratio for high definition.
  - Background: Solid white background added automatically during export.
  - Intelligent Cropping: PNGs are tightly cropped to the bounding box of existing nodes with a 10px padding, rather than exporting the whole stage.
- **Unified Fit-to-Content**:
  - Created centralized `calculateFitViewport` and `calculateNodesBounds` utilities in `lib/seatmap/view-utils.ts`.
  - **Auto-Fit on Mount**: Seatmap automatically centers and scales to fit all nodes when the page loads.
  - **Auto-Fit on Export**: Viewport is reset to a "fit" state before capturing PNGs or saving JSON to ensure consistent viewing.
  - **Fine-Tuning**: Standardized padding (10px) and max zoom scale (1.6x) for "fit" calculations.

## Bug Fixes & Stability
- **Vercel Build**: Updated `addSeat` reducer and `SeatmapSeatNode` types to explicitly handle `seatType: "vip" | "standard"`, resolving production compilation errors.
- **Selection Consistency**: Fixed "Rules of Hooks" violation in `SelectionPanel` by stabilizing state hooks for range assignments.
- **State Persistence**: Bulk update helpers (`updateBulkSeatInfo`) updated to support clearing properties by using the `in` operator to check for key existence rather than value check.
- **Export Cleanliness**: Automatic deselection and transformer hiding during PNG export.

## Files Touched (Seatmap)
- `components/seatmap/SeatmapCanvas.tsx`
- `components/seatmap/SeatLayer.tsx`
- `components/seatmap/SectionLayer.tsx`
- `components/seatmap/UIOverlays.tsx`
- `components/seatmap/SeatmapExportActions.tsx` (New)
- `components/seatmap/seatmap-sidebar.tsx`
- `components/seatmap/seatmap-page-header.tsx`
- `components/ui/upload-progress.tsx`
- `lib/features/seatmap/seatmapSlice.ts`
- `lib/seatmap/types.ts`
- `lib/seatmap/view-utils.ts` (New)
- `lib/seatmap/geometry.ts`
- `app/(admin-user)/seat-builder/page.tsx`
- `app/test/page.tsx`
