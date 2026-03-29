import assert from "node:assert/strict";
import test from "node:test";

import { validateShowPayload } from "./showValidation.ts";

function buildBasePayload() {
  return {
    show_name: "Ticketed Show",
    show_description: "A production with a ticket template.",
    venue: "Seatwise Theater",
    address: "123 Main St",
    show_status: "DRAFT" as const,
    show_start_date: "2026-04-10",
    show_end_date: "2026-04-12",
    gcash_qr_image_key: "https://example.com/gcash.png",
    gcash_number: "09171234567",
    gcash_account_name: "Seatwise Admin",
    seatmap_id: null,
    ticket_template_ids: [],
    ticket_template_id: null,
    scheds: [
      {
        client_id: "sched-1",
        sched_date: "2026-04-10",
        sched_start_time: "19:00",
        sched_end_time: "21:00",
      },
      {
        client_id: "sched-2",
        sched_date: "2026-04-11",
        sched_start_time: "19:00",
        sched_end_time: "21:00",
      },
      {
        client_id: "sched-3",
        sched_date: "2026-04-12",
        sched_start_time: "19:00",
        sched_end_time: "21:00",
      },
    ],
    categorySets: [],
    seatIds: [],
    seatmapExists: false,
    ticketTemplatesExist: true,
    ticketTemplateExists: true,
  };
}

test("validateShowPayload rejects an unknown ticket template selection", () => {
  const result = validateShowPayload({
    ...buildBasePayload(),
    ticket_template_ids: ["ticket-template-missing"],
    ticketTemplatesExist: false,
  });

  assert.equal(result.hasValidationErrors, true);
  assert.equal(result.validation.fieldErrors.ticket_template_id, true);
  assert.equal(
    result.errorMessage,
    "One or more selected ticket templates were not found.",
  );
});

test("validateShowPayload allows a valid ticket template selection", () => {
  const result = validateShowPayload({
    ...buildBasePayload(),
    ticket_template_ids: ["ticket-template-1"],
    ticketTemplatesExist: true,
  });

  assert.equal(result.validation.fieldErrors.ticket_template_id, false);
  assert.equal(result.hasValidationErrors, false);
});
