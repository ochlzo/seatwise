export type SeatmapNodeType =
  | "stage"
  | "seat"
  | "section"
  | "row"
  | "label"
  | "aisle"
  | "shape"
  | "helper";

export type SeatStatus = "available" | "reserved" | "sold" | "blocked";

export type SeatmapPoint = {
  x: number;
  y: number;
};

export type SeatmapTransform = {
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
};

export type SeatmapNodeBase = {
  id: string;
  type: SeatmapNodeType;
  name?: string;
  position: SeatmapPoint;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  radius?: number;
  locked?: boolean;
  visible?: boolean;
  zIndex?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  tags?: string[];
};

export type SeatmapStageNode = SeatmapNodeBase & {
  type: "stage";
  label?: string;
  shape?: "rect" | "curve" | "arc";
};

export type SeatmapSeatNode = SeatmapNodeBase & {
  type: "seat";
  rowId?: string;
  rowLabel?: string;
  seatNumber?: number;
  status: SeatStatus;
  seatType?: "standard";
  snapGuideId?: string;
  categoryId?: string;
};

export type SeatCategory = {
  id: string;
  name: string;
  color: string;
};

export type SeatmapRowNode = SeatmapNodeBase & {
  type: "row";
  seatIds: string[];
  curve?: {
    radius: number;
    startAngle: number;
    endAngle: number;
  };
  label?: string;
};

export type SeatmapSectionNode = SeatmapNodeBase & {
  type: "section";
  rowIds: string[];
  label?: string;
};

export type SeatmapAisleNode = SeatmapNodeBase & {
  type: "aisle";
  path: SeatmapPoint[];
};

export type SeatmapLabelNode = SeatmapNodeBase & {
  type: "label";
  text: string;
  fontSize?: number;
  fontFamily?: string;
  align?: "left" | "center" | "right";
};

export type SeatmapShapeNode = SeatmapNodeBase & {
  type: "shape";
  shape:
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "path"
  | "polygon"
  | "stairs"
  | "text";
  points?: number[];
  dash?: number[];
  sides?: number; // for regular polygons like hexagon
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  padding?: number;
};

export type GuidePathNode = SeatmapNodeBase & {
  type: "helper";
  helperType: "guidePath";
  points: number[];
  dash?: number[];
};

export type SeatmapNode =
  | SeatmapStageNode
  | SeatmapSeatNode
  | SeatmapRowNode
  | SeatmapSectionNode
  | SeatmapAisleNode
  | SeatmapLabelNode
  | SeatmapShapeNode
  | GuidePathNode;

export type SeatmapViewport = {
  position: SeatmapPoint;
  scale: number;
};

export type SeatmapGrid = {
  enabled: boolean;
  size: number;
  color?: string;
};

export type SeatmapMetadata = {
  name?: string;
  venueId?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
};

export type SeatmapState = {
  nodes: Record<string, SeatmapNode>;
  nodeOrder: string[];
  selectedIds: string[];
  viewport: SeatmapViewport;
  grid: SeatmapGrid;
  metadata?: SeatmapMetadata;
  categories: SeatCategory[];
  zoomLocked: boolean;
  snapSpacing: number;
};
