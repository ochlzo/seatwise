import type { TICKET_TEMPLATE_NODE_KINDS } from "./constants.ts";

export type TicketTemplateNodeKind =
  (typeof TICKET_TEMPLATE_NODE_KINDS)[number];

export type TicketTemplateCanvas = {
  width: number;
  height: number;
};

type TicketTemplateNodeBase<TKind extends TicketTemplateNodeKind> = {
  id: string;
  kind: TKind;
  x: number;
  y: number;
};

export type TicketTemplateAssetNode = TicketTemplateNodeBase<"asset"> & {
  width: number;
  height: number;
  assetKey?: string | null;
};

export type TicketTemplateFieldNode = TicketTemplateNodeBase<"field"> & {
  fieldKey: string;
};

export type TicketTemplateQrNode = TicketTemplateNodeBase<"qr"> & {
  size: number;
};

export type TicketTemplateNode =
  | TicketTemplateAssetNode
  | TicketTemplateFieldNode
  | TicketTemplateQrNode;

export type TicketTemplateVersion = {
  canvas: TicketTemplateCanvas;
  nodes: TicketTemplateNode[];
};
