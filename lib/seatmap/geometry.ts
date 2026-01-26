export function polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
}

export function describeArc(
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number
) {
    const start = polarToCartesian(x, y, outerRadius, endAngle);
    const end = polarToCartesian(x, y, outerRadius, startAngle);
    const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
    const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    const d = [
        "M",
        start.x,
        start.y,
        "A",
        outerRadius,
        outerRadius,
        0,
        largeArcFlag,
        0,
        end.x,
        end.y,
        "L",
        innerEnd.x,
        innerEnd.y,
        "A",
        innerRadius,
        innerRadius,
        0,
        largeArcFlag,
        1,
        innerStart.x,
        innerStart.y,
        "Z",
    ].join(" ");

    return d;
}

export function midAngle(startAngle: number, endAngle: number) {
    return startAngle + (endAngle - startAngle) / 2;
}

type KonvaLikeNode = {
    getAbsoluteTransform: () => { copy: () => { invert: () => void; point: (pos: { x: number; y: number }) => { x: number; y: number } } };
    getStage: () => { getPointerPosition: () => { x: number; y: number } | null };
};

export function getRelativePointerPosition(node: KonvaLikeNode) {
    const transform = node.getAbsoluteTransform().copy();
    transform.invert();
    const pos = node.getStage().getPointerPosition();
    if (!pos) return null;
    return transform.point(pos);
}

export function closestPointOnSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) {
        return { x: ax, y: ay, t: 0 };
    }
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    return { x: ax + abx * t, y: ay + aby * t, t };
}

export function closestPointOnPolyline(px: number, py: number, points: number[]) {
    if (points.length < 4) {
        return { point: { x: px, y: py }, distance: Infinity };
    }
    let closest = { x: px, y: py };
    let minDistSq = Infinity;
    for (let i = 0; i < points.length - 2; i += 2) {
        const ax = points[i];
        const ay = points[i + 1];
        const bx = points[i + 2];
        const by = points[i + 3];
        const candidate = closestPointOnSegment(px, py, ax, ay, bx, by);
        const dx = candidate.x - px;
        const dy = candidate.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
            minDistSq = distSq;
            closest = { x: candidate.x, y: candidate.y };
        }
    }
    return { point: closest, distance: Math.sqrt(minDistSq) };
}

export function getNodeBoundingBox(node: { type: string; position: { x: number; y: number }; scaleX?: number; scaleY?: number; width?: number; height?: number; radius?: number; shape?: string; points?: number[]; helperType?: string }) {
    const sx = node.scaleX ?? 1;
    const sy = node.scaleY ?? 1;

    if (node.type === "seat") {
        const w = 32 * sx;
        const h = 32 * sy;
        return {
            x: node.position.x - w / 2,
            y: node.position.y - h / 2,
            width: w,
            height: h,
            centerX: node.position.x,
            centerY: node.position.y,
        };
    }
    if (node.type === "shape") {
        let w = 0;
        let h = 0;
        const cx = node.position.x;
        const cy = node.position.y;

        if (node.shape === "rect" || node.shape === "stairs" || node.shape === "text") {
            w = (node.width ?? 0) * sx;
            h = (node.height ?? 0) * sy;
        } else if (node.shape === "circle" || node.shape === "polygon") {
            const r = (node.radius ?? 0) * Math.max(sx, sy);
            w = r * 2;
            h = r * 2;
        } else if (node.shape === "line") {
            const pts = node.points ?? [0, 0, 0, 0];
            let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
            for (let i = 0; i < pts.length; i += 2) {
                const px = pts[i] * sx;
                const py = pts[i + 1] * sy;
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minY = Math.min(minY, py);
                maxY = Math.max(maxY, py);
            }
            w = maxX - minX;
            h = maxY - minY;
            // Lines are centered in commonProps.
            // x={shape.position.x + centerX} where centerX = (minX + maxX) / 2
            // points are centered (val - centerX)
            // So commonProps x is already the center of the bounding box.
            return {
                x: node.position.x + minX,
                y: node.position.y + minY,
                width: w,
                height: h,
                centerX: node.position.x + (minX + maxX) / 2,
                centerY: node.position.y + (minY + maxY) / 2,
            };
        }
        return {
            x: cx - w / 2,
            y: cy - h / 2,
            width: w,
            height: h,
            centerX: cx,
            centerY: cy,
        };
    }
    if (node.type === "helper" && node.helperType === "guidePath") {
        const pts = node.points;
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
            minX = Math.min(minX, pts[i]);
            maxX = Math.max(maxX, pts[i]);
            minY = Math.min(minY, pts[i + 1]);
            maxY = Math.max(maxY, pts[i + 1]);
        }
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
        };
    }
    return null;
}

export function getNodesBoundingBox(nodeList: { type: string; position: { x: number; y: number }; scaleX?: number; scaleY?: number; width?: number; height?: number; radius?: number; shape?: string; points?: number[]; helperType?: string }[]) {
    if (nodeList.length === 0) return null;
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    nodeList.forEach((node) => {
        const bb = getNodeBoundingBox(node);
        if (bb) {
            minX = Math.min(minX, bb.x);
            maxX = Math.max(maxX, bb.x + bb.width);
            minY = Math.min(minY, bb.y);
            maxY = Math.max(maxY, bb.y + bb.height);
        }
    });
    if (minX === Infinity) return null;
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
    };
}

export function getSnapResults(
    draggedBB: {
        x: number;
        y: number;
        width: number;
        height: number;
        centerX: number;
        centerY: number;
    },
    allNodes: { id: string; type: string; position: { x: number; y: number }; scaleX?: number; scaleY?: number; width?: number; height?: number; radius?: number; shape?: string; points?: number[]; helperType?: string }[],
    selectedIds: string[],
    spacing: number,
    threshold: number = 8
) {
    let bestX = { pos: draggedBB.centerX, snap: null as number | null, isSpacing: false };
    let bestY = { pos: draggedBB.centerY, snap: null as number | null, isSpacing: false };
    let minDiffX = threshold;
    let minDiffY = threshold;

    allNodes.forEach((node) => {
        if (selectedIds.includes(node.id)) return;
        const targetBB = getNodeBoundingBox(node);
        if (!targetBB) return;

        // X candidates for dragged.centerX
        const candidatesX: { val: number; snap: number; isSpacing: boolean }[] = [
            { val: targetBB.centerX, snap: targetBB.centerX, isSpacing: false },
            { val: targetBB.x - draggedBB.width / 2, snap: targetBB.x, isSpacing: false },
            {
                val: targetBB.x + targetBB.width + draggedBB.width / 2,
                snap: targetBB.x + targetBB.width,
                isSpacing: false,
            },
            { val: targetBB.x + draggedBB.width / 2, snap: targetBB.x, isSpacing: false },
            {
                val: targetBB.x + targetBB.width - draggedBB.width / 2,
                snap: targetBB.x + targetBB.width,
                isSpacing: false,
            },
        ];

        if (spacing > 0) {
            candidatesX.push(
                {
                    val: targetBB.x - spacing - draggedBB.width / 2,
                    snap: targetBB.x,
                    isSpacing: true,
                },
                {
                    val: targetBB.x + targetBB.width + spacing + draggedBB.width / 2,
                    snap: targetBB.x + targetBB.width,
                    isSpacing: true,
                }
            );
        }

        candidatesX.forEach((c) => {
            const diff = Math.abs(draggedBB.centerX - c.val);
            if (diff < minDiffX) {
                minDiffX = diff;
                bestX = { pos: c.val, snap: c.snap, isSpacing: c.isSpacing };
            }
        });

        // Y candidates for dragged.centerY
        const candidatesY: { val: number; snap: number; isSpacing: boolean }[] = [
            { val: targetBB.centerY, snap: targetBB.centerY, isSpacing: false },
            { val: targetBB.y - draggedBB.height / 2, snap: targetBB.y, isSpacing: false },
            {
                val: targetBB.y + targetBB.height + draggedBB.height / 2,
                snap: targetBB.y + targetBB.height,
                isSpacing: false,
            },
            { val: targetBB.y + draggedBB.height / 2, snap: targetBB.y, isSpacing: false },
            {
                val: targetBB.y + targetBB.height - draggedBB.height / 2,
                snap: targetBB.y + targetBB.height,
                isSpacing: false,
            },
        ];

        if (spacing > 0) {
            candidatesY.push(
                {
                    val: targetBB.y - spacing - draggedBB.height / 2,
                    snap: targetBB.y,
                    isSpacing: true,
                },
                {
                    val: targetBB.y + targetBB.height + spacing + draggedBB.height / 2,
                    snap: targetBB.y + targetBB.height,
                    isSpacing: true,
                }
            );
        }

        candidatesY.forEach((c) => {
            const diff = Math.abs(draggedBB.centerY - c.val);
            if (diff < minDiffY) {
                minDiffY = diff;
                bestY = { pos: c.val, snap: c.snap, isSpacing: c.isSpacing };
            }
        });
    });

    return {
        x: bestX.pos,
        y: bestY.pos,
        snapX: bestX.snap,
        snapY: bestY.snap,
        isSpacingX: bestX.isSpacing,
        isSpacingY: bestY.isSpacing,
    };
}
