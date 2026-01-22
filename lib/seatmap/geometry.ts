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

export function getRelativePointerPosition(node: any) {
    const transform = node.getAbsoluteTransform().copy();
    transform.invert();
    const pos = node.getStage().getPointerPosition();
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
