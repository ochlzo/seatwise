import { SeatmapNode, SeatmapViewport } from "./types";

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function calculateNodesBounds(nodes: Record<string, SeatmapNode>): Bounds | null {
    const items = Object.values(nodes);
    if (items.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const expand = (x: number, y: number) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    };

    const expandRotatedRect = (x: number, y: number, w: number, h: number, rotation: number) => {
        const rad = (rotation * Math.PI) / 180;
        const hw = w / 2;
        const hh = h / 2;
        // Corners relative to center
        const corners = [
            { dx: -hw, dy: -hh },
            { dx: hw, dy: -hh },
            { dx: hw, dy: hh },
            { dx: -hw, dy: hh }
        ];
        corners.forEach(c => {
            const rx = c.dx * Math.cos(rad) - c.dy * Math.sin(rad);
            const ry = c.dx * Math.sin(rad) + c.dy * Math.cos(rad);
            expand(x + rx, y + ry);
        });
    };

    items.forEach((node) => {
        const sx = node.scaleX ?? 1;
        const sy = node.scaleY ?? 1;
        const rotation = node.rotation ?? 0;

        if (node.type === "seat") {
            // Seats are 32x32 centered
            expandRotatedRect(node.position.x, node.position.y, 32 * sx, 32 * sy, rotation);
            return;
        }

        if (node.type !== "shape") return;

        if (node.shape === "rect" || node.shape === "stairs" || node.shape === "text") {
            let w = 0;
            let h = 0;
            if (node.shape === "rect" || node.shape === "stairs") {
                w = (node.width ?? 50) * sx;
                h = (node.height ?? 50) * sy;
            } else {
                w = (node.width ?? 100) * sx;
                h = (node.height ?? 40) * sy;
            }
            expandRotatedRect(node.position.x, node.position.y, w, h, rotation);
            return;
        }

        if (node.shape === "circle" || node.shape === "polygon") {
            const r = (node.radius ?? 30) * Math.max(sx, sy);
            // Circles/Polygons might have rotation but their bounding box is just radius if symmetrical
            // To be safe for polygons, we could expand by radius
            expand(node.position.x - r, node.position.y - r);
            expand(node.position.x + r, node.position.y + r);
            expand(node.position.x - r, node.position.y + r);
            expand(node.position.x + r, node.position.y - r);
            return;
        }

        if (node.shape === "line") {
            const points = Array.isArray(node.points) ? node.points : [0, 0, 100, 0];
            // Lines in SectionLayer are centered on position.x + centerX, position.y + centerY
            // and then rotated.
            let pMinX = Infinity;
            let pMinY = Infinity;
            let pMaxX = -Infinity;
            let pMaxY = -Infinity;
            for (let i = 0; i < points.length; i += 2) {
                pMinX = Math.min(pMinX, points[i]);
                pMaxX = Math.max(pMaxX, points[i]);
                pMinY = Math.min(pMinY, points[i + 1]);
                pMaxY = Math.max(pMaxY, points[i + 1]);
            }
            const localCX = (pMinX + pMaxX) / 2;
            const localCY = (pMinY + pMaxY) / 2;
            const pivotX = node.position.x + localCX;
            const pivotY = node.position.y + localCY;
            const rad = (rotation * Math.PI) / 180;

            for (let i = 0; i < points.length; i += 2) {
                const dx = (points[i] - localCX) * sx;
                const dy = (points[i + 1] - localCY) * sy;
                const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
                const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
                expand(pivotX + rx, pivotY + ry);
            }
        }
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

export function calculateFitViewport(
    nodes: Record<string, SeatmapNode>,
    viewportSize: { width: number; height: number },
    padding: number = 10
): SeatmapViewport {
    const bounds = calculateNodesBounds(nodes);

    if (!bounds) {
        return { position: { x: 0, y: 0 }, scale: 1 };
    }

    const viewW = Math.max(1, viewportSize.width - padding * 2);
    const viewH = Math.max(1, viewportSize.height - padding * 2);
    const scale = Math.min(viewW / bounds.width, viewH / bounds.height, 1.6);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    return {
        position: {
            x: viewportSize.width / 2 - centerX * scale,
            y: viewportSize.height / 2 - centerY * scale,
        },
        scale,
    };
}
