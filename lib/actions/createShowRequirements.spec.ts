import assert from "node:assert/strict";

import {
  CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE,
  getCreateShowTicketTemplateError,
  normalizeCreateShowTicketTemplateIds,
} from "./createShowRequirements.ts";

assert.equal(
  getCreateShowTicketTemplateError(undefined),
  CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE,
);
assert.equal(
  getCreateShowTicketTemplateError([]),
  CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE,
);
assert.equal(
  getCreateShowTicketTemplateError(["   ", "\t"]),
  CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE,
);
assert.equal(getCreateShowTicketTemplateError(["tpl_1"]), null);
assert.deepEqual(
  normalizeCreateShowTicketTemplateIds([" tpl_1 ", "tpl_1", "tpl_2", ""]),
  ["tpl_1", "tpl_2"],
);

console.log("createShowRequirements.spec.ts passed");
