import { clearSelectedNodes } from "../../lib/features/ticketTemplate/ticketTemplateSlice.ts";

export type TicketTemplateSaveDispatch = (action: ReturnType<typeof clearSelectedNodes>) => void;

export function clearTicketTemplateSelectionBeforeSave(dispatch: TicketTemplateSaveDispatch) {
  dispatch(clearSelectedNodes());
}
