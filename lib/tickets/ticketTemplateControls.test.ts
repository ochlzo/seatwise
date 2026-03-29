import assert from "node:assert/strict";
import test from "node:test";

type ReducerState = {
  nodes: Array<{ id: string; x: number; y: number }>;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  clipboard: Array<{ id: string; x: number; y: number }>;
};

type ReducerFn = (
  state: ReducerState | undefined,
  action: { type: string; payload?: unknown },
) => ReducerState;

async function loadReducer() {
  const ticketTemplateModule = (await import(
    "../features/ticketTemplate/ticketTemplateSlice.ts"
  )) as { default: ReducerFn };
  return ticketTemplateModule.default;
}

test("ticket template reducers support grouped copy/paste and arrow-key movement", async () => {
  const reducer = await loadReducer();

  let state = reducer(undefined, { type: "@@INIT" });

  state = reducer(state, {
    type: "ticketTemplate/addFieldNode",
    payload: { fieldKey: "show_name", x: 100, y: 120 },
  });
  const firstId = state.selectedNodeId;
  assert.ok(firstId);

  state = reducer(state, {
    type: "ticketTemplate/addQrNode",
    payload: { x: 300, y: 220 },
  });
  const secondId = state.selectedNodeId;
  assert.ok(secondId);

  state = reducer(state, {
    type: "ticketTemplate/selectNodes",
    payload: [firstId, secondId],
  });

  assert.deepEqual(state.selectedNodeIds, [firstId, secondId]);

  state = reducer(state, { type: "ticketTemplate/copySelectedNodes" });
  assert.equal(state.clipboard.length, 2);

  state = reducer(state, {
    type: "ticketTemplate/pasteNodesAt",
    payload: { x: 500, y: 500 },
  });

  assert.equal(state.selectedNodeIds.length, 2);
  const pastedIds = [...state.selectedNodeIds];
  const pastedNodes = state.nodes.filter((node) => pastedIds.includes(node.id));
  assert.equal(pastedNodes.length, 2);

  const pastedCenter = pastedNodes.reduce(
    (acc, node) => {
      acc.x += node.x;
      acc.y += node.y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  pastedCenter.x /= pastedNodes.length;
  pastedCenter.y /= pastedNodes.length;

  assert.equal(Math.round(pastedCenter.x), 500);
  assert.equal(Math.round(pastedCenter.y), 500);

  state = reducer(state, {
    type: "ticketTemplate/moveSelectedNodesBy",
    payload: { dx: 10, dy: -20 },
  });

  const movedNodes = state.nodes.filter((node) => pastedIds.includes(node.id));
  const movedCenter = movedNodes.reduce(
    (acc, node) => {
      acc.x += node.x;
      acc.y += node.y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  movedCenter.x /= movedNodes.length;
  movedCenter.y /= movedNodes.length;

  assert.equal(Math.round(movedCenter.x), 510);
  assert.equal(Math.round(movedCenter.y), 480);
});

test("ticket template reducers support grouped cut", async () => {
  const reducer = await loadReducer();

  let state = reducer(undefined, { type: "@@INIT" });

  state = reducer(state, {
    type: "ticketTemplate/addFieldNode",
    payload: { fieldKey: "show_name", x: 140, y: 180 },
  });
  const firstId = state.selectedNodeId;
  assert.ok(firstId);

  state = reducer(state, {
    type: "ticketTemplate/addQrNode",
    payload: { x: 360, y: 240 },
  });
  const secondId = state.selectedNodeId;
  assert.ok(secondId);

  state = reducer(state, {
    type: "ticketTemplate/selectNodes",
    payload: [firstId, secondId],
  });

  state = reducer(state, { type: "ticketTemplate/cutSelectedNodes" });

  assert.equal(state.clipboard.length, 2);
  assert.equal(state.selectedNodeIds.length, 0);
  assert.equal(state.selectedNodeId, null);
  assert.equal(
    state.nodes.some((node) => node.id === firstId || node.id === secondId),
    false,
  );
});
