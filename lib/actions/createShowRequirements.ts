export const CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE =
  "At least one ticket template is required to create a show.";

export function normalizeCreateShowTicketTemplateIds(
  ticketTemplateIds?: string[] | null,
) {
  return Array.from(
    new Set(
      (Array.isArray(ticketTemplateIds) ? ticketTemplateIds : [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function getCreateShowTicketTemplateError(
  ticketTemplateIds?: string[] | null,
) {
  return normalizeCreateShowTicketTemplateIds(ticketTemplateIds).length > 0
    ? null
    : CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE;
}
