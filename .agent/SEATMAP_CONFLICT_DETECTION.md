# Seatmap Conflict Detection Implementation

## Overview
Implemented a conflict detection and resolution system that prevents users from accidentally modifying seatmaps that are actively being used by shows with seat assignments.

## Problem Statement
When a seatmap is being used by active shows (OPEN, ON_GOING, or UPCOMING status), modifying it could:
- Break referential integrity with existing `SeatAssignment` records
- Cause data inconsistencies in active shows
- Violate database constraints

## Solution Architecture

### 1. Backend Conflict Detection (`lib/actions/saveSeatmapTemplate.ts`)

**Query Logic:**
```typescript
const conflictCheck = await prisma.seatAssignment.findFirst({
  where: {
    seat: {
      seatmap_id: seatmap_id,
    },
    sched: {
      show: {
        show_status: {
          in: ["OPEN", "ON_GOING", "UPCOMING"],
        },
      },
    },
  },
  include: {
    sched: {
      include: {
        show: {
          select: {
            show_id: true,
            show_name: true,
            show_status: true,
          },
        },
      },
    },
  },
});
```

**Return Structure:**
- If conflict detected: Returns `{ success: false, error: "SEATMAP_IN_USE", conflictDetails: {...} }`
- If no conflict: Proceeds with normal upsert operation

### 2. Frontend Conflict Resolution (`components/seatmap/SeatmapFileMenu.tsx`)

**User Flow:**
1. User clicks "Save to Templates"
2. Validation checks (empty seatmap, seat numbers)
3. Server-side conflict detection
4. If conflict detected:
   - Display modal with conflict details
   - Offer two options:
     - **Cancel**: Abort the save operation
     - **Duplicate**: Save as new template with " - Copy" suffix

**Key Implementation Details:**
- `handleSaveToTemplates(forceDuplicate = false)`: Main save handler
- `handleDuplicateConfirm()`: Triggers save with `forceDuplicate = true`
- When duplicating:
  - Appends " - Copy" to the seatmap name
  - Passes `undefined` as `seatmap_id` to create new record
  - Prevents overwriting the original seatmap
  - **Automatically updates URL** to the new seatmap ID using `router.replace()`
  - Example: `/seat-builder?seatmapId=OLD_ID` → `/seat-builder?seatmapId=NEW_ID`

### 3. Modal UI

**Conflict Dialog Features:**
- Red warning icon (AlertTriangle)
- Clear explanation of which show is using the seatmap
- Show name and status displayed
- Prominent "Duplicate as New Template" action button
- Mobile-responsive design

## Database Relationships

```
Seatmap (being edited)
  └─> Seat (seatmap_id)
       └─> SeatAssignment (seat_id)
            └─> Sched (sched_id)
                 └─> Show (show_id, show_status)
```

## Edge Cases Handled

1. **Multiple Shows Using Same Seatmap**: Query returns first conflict found
2. **Closed/Cancelled Shows**: Not considered conflicts (only OPEN, ON_GOING, UPCOMING)
3. **New Seatmaps**: Conflict check skipped (no `seatmap_id`)
4. **Duplicate Name Conflicts**: Handled by " - Copy" suffix

## Testing Checklist

- [ ] Create a seatmap and assign it to a show
- [ ] Set show status to OPEN
- [ ] Create seat assignments for the show
- [ ] Try to edit and save the seatmap
- [ ] Verify conflict modal appears
- [ ] Click "Cancel" - verify save is aborted
- [ ] Click "Duplicate" - verify new seatmap is created with " - Copy"
- [ ] Verify original seatmap remains unchanged
- [ ] Test with CLOSED show - verify no conflict

## Future Enhancements

1. Show list of ALL affected shows (not just first one)
2. Add "View Show" link in conflict modal
3. Implement "Archive" option for old seatmaps
4. Add conflict detection for category assignments
