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
import { resolveTicketTemplateAssetRefsForSave } from "../clients/cloudinary-upload.ts";
import { serializeTicketTemplateEditor } from "../features/ticketTemplate/ticketTemplateSlice.ts";

type EditorSliceModule = {
  default: (
    state: unknown,
    action: { type: string; payload?: unknown },
  ) => unknown;
};

async function loadEditorReducer() {
  try {
    const ticketTemplateModule = (await import(
      "../features/ticketTemplate/ticketTemplateSlice.ts"
    )) as EditorSliceModule;
    return ticketTemplateModule.default;
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

test("ticket template title field allows temporarily empty values while typing", async () => {
  const reducer = await loadEditorReducer();
  assert.ok(reducer, "ticket template reducer should exist");
  const editorState = reducer?.(undefined, {
    type: "ticketTemplate/setTitle",
    payload: "",
  }) as
    | {
        title: string;
      }
    | undefined;

  assert.equal(editorState?.title, "");
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

test("serializeTicketTemplateEditor preserves editable node properties for save and reload", () => {
  const serialized = serializeTicketTemplateEditor({
    canvas: {
      width: 2550,
      height: 825,
    },
    nodes: [
      {
        id: "asset-hero",
        kind: "asset",
        x: 24,
        y: 36,
        width: 800,
        height: 320,
        opacity: 0.7,
        assetKey: "seatwise/ticket_templates/draft-123/assets/hero",
        src: "https://res.cloudinary.com/seatwise/image/upload/v1/hero.png",
        name: "hero.png",
      },
      {
        id: "field-booking-ref",
        kind: "field",
        fieldKey: "reservation_number",
        label: "Booking Ref",
        x: 120,
        y: 160,
        width: 420,
        height: 92,
        fontSize: 58,
        fontFamily: "Georgia",
        fontWeight: 700,
        fill: "#111827",
        align: "center",
        opacity: 0.9,
      },
      {
        id: "qr-1",
        kind: "qr",
        x: 2000,
        y: 110,
        size: 220,
        opacity: 0.8,
      },
    ],
  });

  assert.deepEqual(serialized.nodes, [
    {
      id: "asset-hero",
      kind: "asset",
      x: 24,
      y: 36,
      width: 800,
      height: 320,
      opacity: 0.7,
      assetKey: "seatwise/ticket_templates/draft-123/assets/hero",
      src: "https://res.cloudinary.com/seatwise/image/upload/v1/hero.png",
      name: "hero.png",
    },
    {
      id: "field-booking-ref",
      kind: "field",
      fieldKey: "reservation_number",
      label: "Booking Ref",
      x: 120,
      y: 160,
      width: 420,
      height: 92,
      fontSize: 58,
      fontFamily: "Georgia",
      fontWeight: 700,
      fill: "#111827",
      align: "center",
      opacity: 0.9,
    },
    {
      id: "qr-1",
      kind: "qr",
      x: 2000,
      y: 110,
      size: 220,
      opacity: 0.8,
    },
  ]);
});

test("ticket template save/load preserves off-canvas coordinates without clamping", async () => {
  const reducer = await loadEditorReducer();
  assert.ok(reducer, "ticket template reducer should exist");

  let editorState = reducer(undefined, { type: "@@INIT" }) as
    | {
        canvas: { width: number; height: number };
        nodes: Array<{
          id: string;
          kind: string;
          x: number;
          y: number;
          width?: number;
          height?: number;
        }>;
        selectedNodeId: string | null;
      }
    | undefined;

  editorState = reducer(editorState, {
    type: "ticketTemplate/addAssetNode",
    payload: {
      width: 640,
      height: 280,
      src: "data:image/png;base64,TEST_IMAGE",
      x: 120,
      y: 90,
    },
  }) as typeof editorState;

  const assetId = editorState.selectedNodeId;
  assert.ok(assetId);

  editorState = reducer(editorState, {
    type: "ticketTemplate/moveSelectedNodesBy",
    payload: { dx: -240, dy: -180 },
  }) as typeof editorState;

  const movedAsset = editorState.nodes.find((node) => node.id === assetId);
  assert.ok(movedAsset);
  assert.equal(movedAsset.x, -120);
  assert.equal(movedAsset.y, -90);
  assert.equal(movedAsset.width, 640);
  assert.equal(movedAsset.height, 280);

  const serialized = serializeTicketTemplateEditor({
    canvas: editorState.canvas,
    nodes: editorState.nodes,
  });
  const serializedAsset = serialized.nodes.find((node) => node.id === assetId);
  assert.ok(serializedAsset);
  assert.equal(serializedAsset.x, -120);
  assert.equal(serializedAsset.y, -90);

  const reloadedState = reducer(editorState, {
    type: "ticketTemplate/loadTicketTemplate",
    payload: {
      template: serialized,
    },
  }) as typeof editorState;

  const reloadedAsset = reloadedState.nodes.find((node) => node.id === assetId);
  assert.ok(reloadedAsset);
  assert.equal(reloadedAsset.x, -120);
  assert.equal(reloadedAsset.y, -90);
  assert.equal(reloadedAsset.width, 640);
  assert.equal(reloadedAsset.height, 280);
});

test("resolveTicketTemplateAssetRefsForSave uploads only local asset previews during save", async () => {
  const template = createEmptyTicketTemplate();
  template.nodes.push(
    {
      id: "asset-local",
      kind: "asset",
      x: 0,
      y: 0,
      width: 300,
      height: 180,
      src: "data:image/png;base64,LOCAL_PREVIEW",
      name: "local.png",
      opacity: 1,
    },
    {
      id: "asset-cloudinary",
      kind: "asset",
      x: 320,
      y: 0,
      width: 120,
      height: 120,
      src: "https://res.cloudinary.com/demo/image/upload/v1/already.png",
      assetKey: "seatwise/ticket_templates/template-1/assets/already",
      name: "already.png",
      opacity: 1,
    },
  );

  const uploadCalls: Array<{ file: File | string; purpose: string }> = [];

  const resolved = await resolveTicketTemplateAssetRefsForSave(template, {
    ticketTemplateId: "template-1",
    uploadKey: "draft-1",
    uploadAsset: async (file, purpose) => {
      uploadCalls.push({ file, purpose });
      return {
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/local.png",
        publicId: "seatwise/ticket_templates/template-1/assets/local",
      };
    },
  });

  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0]?.file, "data:image/png;base64,LOCAL_PREVIEW");
  assert.equal(uploadCalls[0]?.purpose, "ticket-template-asset");
  assert.deepEqual(resolved.nodes, [
    {
      id: "asset-local",
      kind: "asset",
      x: 0,
      y: 0,
      width: 300,
      height: 180,
      src: "https://res.cloudinary.com/demo/image/upload/v1/local.png",
      assetKey: "seatwise/ticket_templates/template-1/assets/local",
      name: "local.png",
      opacity: 1,
    },
    {
      id: "asset-cloudinary",
      kind: "asset",
      x: 320,
      y: 0,
      width: 120,
      height: 120,
      src: "https://res.cloudinary.com/demo/image/upload/v1/already.png",
      assetKey: "seatwise/ticket_templates/template-1/assets/already",
      name: "already.png",
      opacity: 1,
    },
  ]);
});

test("resolveTicketTemplateAssetRefsForSave uploads the rendered preview PNG when provided", async () => {
  const template = createEmptyTicketTemplate();
  const uploadCalls: Array<{ file: File | string; purpose: string }> = [];

  const resolved = await resolveTicketTemplateAssetRefsForSave(template, {
    ticketTemplateId: "template-42",
    uploadKey: "draft-42",
    previewDataUrl: "data:image/png;base64,PREVIEW_CAPTURE",
    uploadAsset: async (file, purpose) => {
      uploadCalls.push({ file, purpose });
      return {
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/template-preview.png",
        publicId: "seatwise/ticket_templates/template-42/previews/template-preview",
      };
    },
  });

  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0]?.file, "data:image/png;base64,PREVIEW_CAPTURE");
  assert.equal(uploadCalls[0]?.purpose, "ticket-template-preview");
  assert.equal(
    resolved.previewUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/template-preview.png",
  );
  assert.equal(
    resolved.previewAssetKey,
    "seatwise/ticket_templates/template-42/previews/template-preview",
  );
});
