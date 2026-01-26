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

    const expand = (x: number, y: number, halfW: number, halfH: number) => {
        minX = Math.min(minX, x - halfW);
        maxX = Math.max(maxX, x + halfW);
        minY = Math.min(minY, y - halfH);
        maxY = Math.max(maxY, y + halfH);
    };

    items.forEach((node) => {
        const sx = node.scaleX ?? 1;
        const sy = node.scaleY ?? 1;

        if (node.type === "seat") {
            expand(node.position.x, node.position.y, 16 * sx, 16 * sy);
            return;
        }

        if (node.type !== "shape") return;

        if (node.shape === "rect" || node.shape === "stairs") {
            const w = (node.width ?? 0) * sx;
            const h = (node.height ?? 0) * sy;
            expand(node.position.x, node.position.y, w / 2, h / 2);
            return;
        }
        if (node.shape === "text") {
            const w = (node.width ?? 0) * sx;
            const h = (node.height ?? 0) * sy;
            expand(node.position.x, node.position.y, w / 2, h / 2);
            return;
        }

        if (node.shape === "circle" || node.shape === "polygon") {
            const r = (node.radius ?? 0) * Math.max(sx, sy);
            expand(node.position.x, node.position.y, r, r);
            return;
        }

        if (node.shape === "line") {
            const points = Array.isArray(node.points) ? node.points : [0, 0, 0, 0];
            let pMinX = Infinity;
            let pMinY = Infinity;
            let pMaxX = -Infinity;
            let pMaxY = -Infinity;
            for (let i = 0; i < points.length; i += 2) {
                const px = points[i] * sx;
                const py = points[i + 1] * sy;
                pMinX = Math.min(pMinX, px);
                pMaxX = Math.max(pMaxX, px);
                pMinY = Math.min(pMinY, py);
                pMaxY = Math.max(pMaxY, py);
            }
            minX = Math.min(minX, node.position.x + pMinX);
            maxX = Math.max(maxX, node.position.x + pMaxX);
            minY = Math.min(minY, node.position.y + pMinY);
            maxY = Math.max(maxY, node.position.y + pMaxY);
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
