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
