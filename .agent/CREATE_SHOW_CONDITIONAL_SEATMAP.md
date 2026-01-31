# Create Show Form - Conditional Seatmap Requirements

## Changes Implemented

### 1. Removed Illogical Status Options
**File**: `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`

**Removed Statuses**:
- ❌ **ON_GOING**: Can't create a show that's already in progress
- ❌ **CLOSED**: Can't create a show that's already closed
- ❌ **CANCELLED**: Can't create a show that's already cancelled
- ❌ **POSTPONED**: Can't create a show that's already postponed

**Valid Creation Statuses**:
- ✅ **DRAFT**: Show is being planned
- ✅ **UPCOMING**: Show is scheduled and ready for ticket sales
- ✅ **OPEN**: Show is actively selling tickets

**Rationale**: You can only create shows in states that make sense for new productions. Other statuses (CLOSED, CANCELLED, etc.) are transition states that existing shows move into.

### 2. Conditional Seatmap Section Rendering
**Visibility Logic**:
```typescript
{(formData.show_status === "UPCOMING" || formData.show_status === "OPEN") && (
  // Seatmap section content
)}
```

**When Shown**: Only for `UPCOMING` and `OPEN` statuses
**When Hidden**: For `DRAFT`, `CLOSED`, `CANCELLED`, and `POSTPONED` statuses

**Rationale**:
- **DRAFT**: Show is being planned, seats not ready yet
- **UPCOMING/OPEN**: Show is ready for ticket sales, requires seatmap
- **CLOSED/CANCELLED/POSTPONED**: Show is no longer active, seatmap not needed

### 3. Conditional Validation Logic
**Updated `missingFields` useMemo**:
```typescript
const requiresSeatmap = formData.show_status === "UPCOMING" || formData.show_status === "OPEN";

if (requiresSeatmap) {
  // Validate seatmap_id
  // Validate schedules
  // Validate categories
  // Validate seat assignments
}
```

**Updated `handleSave` validation**:
```typescript
const requiresSeatmap = formData.show_status === "UPCOMING" || formData.show_status === "OPEN";

if (
  // ... other required fields
  (requiresSeatmap && !formData.seatmap_id)
) {
  toast.error("Please fill out all required fields.");
  return;
}
```

### 4. Field Requirements by Status

| Status | Seatmap Required | Schedules Required | Categories Required |
|--------|-----------------|-------------------|---------------------|
| **DRAFT** | ❌ No | ⚠️ Optional | ❌ No |
| **UPCOMING** | ✅ Yes | ✅ Yes | ✅ Yes |
| **OPEN** | ✅ Yes | ✅ Yes | ✅ Yes |

**DRAFT Show Workflow**:
1. Create show with basic info (name, description, venue, dates)
2. Optionally add schedules (performance dates/times)
3. Save as DRAFT (no seatmap needed)
4. Later, change status to UPCOMING → seatmap section appears
5. Configure seatmap, categories, and seat assignments
6. Change status to OPEN → show goes live for ticket sales

## Benefits

1. **Flexible Workflow**: Admins can create DRAFT shows without configuring seats
2. **Logical Constraints**: Prevents creating shows in illogical states (ON_GOING)
3. **Reduced Friction**: Non-active shows don't require complex seatmap setup
4. **Data Integrity**: Only shows that need seat assignments (UPCOMING/OPEN) are required to have them

## Testing Checklist

- [ ] Create a DRAFT show without seatmap - should succeed
- [ ] Create an UPCOMING show without seatmap - should fail validation
- [ ] Create an OPEN show with seatmap - should succeed
- [ ] Verify ON_GOING is not in status dropdown
- [ ] Switch from DRAFT to UPCOMING - seatmap section should appear
- [ ] Switch from UPCOMING to CLOSED - seatmap section should hide
- [ ] Save a CLOSED show without seatmap data - should succeed

## Related Changes Needed

### Backend (createShowAction)
The server action should also be updated to:
1. Allow `seatmap_id` to be optional/null for non-active shows
2. Skip schedule and category creation if status is not UPCOMING/OPEN
3. Update Prisma schema if `seatmap_id` needs to be nullable

### Database Schema Consideration
Currently, `Show.seatmap_id` is required in the schema:
```prisma
model Show {
  seatmap_id  String  // REQUIRED
  seatmap     Seatmap @relation(...)
}
```

**Options**:
1. Keep it required, but use a "placeholder" seatmap for non-active shows
2. Make it optional: `seatmap_id String?` (requires migration)

**Recommendation**: Make it optional to fully support the new workflow.
