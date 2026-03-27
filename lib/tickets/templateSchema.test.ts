import assert from "node:assert/strict";
import test from "node:test";

import {
  TICKET_TEMPLATE_CANVAS_INCH_HEIGHT,
  TICKET_TEMPLATE_CANVAS_INCH_WIDTH,
  TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
  TICKET_TEMPLATE_CANVAS_PX_WIDTH,
} from "./constants.ts";
import type { TicketTemplateVersion } from "./types.ts";
import {
  createEmptyTicketTemplate,
  normalizeTemplateVersion,
} from "./templateSchema.ts";

type EditorSliceModule = {
  default: (
    state: unknown,
    action: { type: string; payload?: unknown },
  ) => unknown;
};

async function loadEditorReducer() {
  try {
    const module = (await import(
      "../features/ticketTemplate/ticketTemplateSlice.ts"
    )) as EditorSliceModule;
    return module.default;
  } catch {
    return null;
  }
}

test("createEmptyTicketTemplate returns the fixed ticket canvas dimensions", () => {
  const template = createEmptyTicketTemplate();

  assert.equal(TICKET_TEMPLATE_CANVAS_PX_WIDTH, 2550);
  assert.equal(TICKET_TEMPLATE_CANVAS_PX_HEIGHT, 825);
  assert.equal(TICKET_TEMPLATE_CANVAS_INCH_WIDTH, 8.5);
  assert.equal(TICKET_TEMPLATE_CANVAS_INCH_HEIGHT, 2.75);
  assert.equal(template.canvas.width, 2550);
  assert.equal(template.canvas.height, 825);
  assert.deepEqual(template.nodes, []);
});

test("normalizeTemplateVersion preserves only the supported ticket node kinds", () => {
  const normalized = normalizeTemplateVersion({
    canvas: {
      width: 123,
      height: 456,
    },
    nodes: [
      { id: "asset-1", kind: "asset", x: 0, y: 0, width: 400, height: 200 },
      { id: "field-1", kind: "field", fieldKey: "reservation_number", x: 10, y: 20 },
      { id: "qr-1", kind: "qr", x: 30, y: 40, size: 150 },
      { id: "ignored-1", kind: "shape", x: 50, y: 60 },
    ],
  } as unknown as TicketTemplateVersion);

  assert.equal(normalized.canvas.width, 2550);
  assert.equal(normalized.canvas.height, 825);
  assert.deepEqual(
    normalized.nodes.map((node) => node.kind),
    ["asset", "field", "qr"],
  );
});

test("normalizeTemplateVersion keeps field nodes above asset nodes", () => {
  const normalized = normalizeTemplateVersion({
    canvas: {
      width: 2550,
      height: 825,
    },
    nodes: [
      { id: "field-1", kind: "field", fieldKey: "show_name", x: 100, y: 100 },
      { id: "asset-1", kind: "asset", x: 0, y: 0, width: 400, height: 200 },
      { id: "asset-2", kind: "asset", x: 500, y: 0, width: 300, height: 200 },
      { id: "field-2", kind: "field", fieldKey: "guest_name", x: 200, y: 100 },
      { id: "qr-1", kind: "qr", x: 600, y: 100, size: 150 },
    ],
  } as TicketTemplateVersion);

  assert.deepEqual(
    normalized.nodes.map((node) => node.id),
    ["asset-1", "asset-2", "field-1", "field-2", "qr-1"],
  );
});

test("ticket template editor initializes with a fixed empty canvas", async () => {
  const reducer = await loadEditorReducer();
  assert.ok(reducer, "ticket template reducer should exist");
  const editorState = reducer?.(undefined, { type: "@@INIT" }) as
    | {
        title: string;
        canvas: { width: number; height: number };
        nodes: Array<unknown>;
        hasUnsavedChanges: boolean;
      }
    | undefined;

  assert.equal(editorState.title, "Untitled Ticket Template");
  assert.deepEqual(editorState.canvas, {
    width: 2550,
    height: 825,
  });
  assert.deepEqual(editorState.nodes, []);
  assert.equal(editorState.hasUnsavedChanges, false);
});

test("ticket template editor ignores canvas resize mutations", async () => {
  const reducer = await loadEditorReducer();
  assert.ok(reducer, "ticket template reducer should exist");
  const editorState = reducer?.(undefined, {
    type: "ticketTemplate/updateCanvasSize",
    payload: {
      width: 100,
      height: 100,
    },
  }) as
    | {
        canvas: { width: number; height: number };
      }
    | undefined;

  assert.deepEqual(editorState.canvas, {
    width: 2550,
    height: 825,
  });
});

test("ticket template editor keeps field nodes above asset nodes", async () => {
  const reducer = await loadEditorReducer();
  assert.ok(reducer, "ticket template reducer should exist");
  const editorState = reducer?.(undefined, {
    type: "ticketTemplate/replaceNodes",
    payload: [
      { id: "field-1", kind: "field", fieldKey: "show_name", x: 320, y: 140 },
      { id: "asset-1", kind: "asset", x: 0, y: 0, width: 400, height: 200 },
      { id: "asset-2", kind: "asset", x: 450, y: 0, width: 300, height: 180 },
      { id: "qr-1", kind: "qr", x: 1700, y: 120, size: 180 },
    ],
  }) as
    | {
        nodes: Array<{ id: string }>;
      }
    | undefined;

  assert.deepEqual(
    editorState.nodes.map((node) => node.id),
    ["asset-1", "asset-2", "field-1", "qr-1"],
  );
});
