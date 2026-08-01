const LINK_1_MM = 260;
const LINK_2_MM = 255;

const J1_MIN_DEG = -90;
const J1_MAX_DEG = 90;
const J2_MIN_DEG = -180;
const J2_MAX_DEG = 180;

const HOME_J1_DEG = 0;
const HOME_J2_DEG = 180;

const PLAYBACK_SPEED_DEG_PER_SEC = 180;
const INTRO_EXTEND_DEG = 18;

const HEAD_PRE_DOCK_OFFSET = 40;
const HEAD_APPROACH_MS = 380;
const HEAD_DOCK_MS = 160;
const HEAD_REST_SCREEN = { x: 975, y: 400 };
const HEAD_REST_ANGLE = -0.4;

const BLADE_TOGGLE_PAUSE_MS = 250;

const PRODUCT_SMOOTHING_MS = 150;
const PRODUCT_MAX_DEVIATION_DEG = 1.0;

const TRACE_CATCHUP_MS = 150;
const TRACE_CATCHUP_ALPHA = 0.5;

const rad = degrees => degrees * Math.PI / 180;
const deg = radians => radians * 180 / Math.PI;

function normalizeJointDegrees(degrees) {
    while (degrees > 180) degrees -= 360;
    while (degrees < -180) degrees += 360;
    return degrees;
}

function shortestJointDelta(targetDeg, currentDeg) {
    return normalizeJointDegrees(targetDeg - currentDeg);
}

function angleInRange(j1Deg, j2Deg) {
    return j1Deg >= J1_MIN_DEG && j1Deg <= J1_MAX_DEG && j2Deg >= J2_MIN_DEG && j2Deg <= J2_MAX_DEG;
}

function forwardKinematics(j1Deg, j2Deg) {
    const t1 = rad(j1Deg);
    const t2 = rad(j2Deg);

    const elbowX = -LINK_1_MM * Math.sin(t1);
    const elbowY = LINK_1_MM * Math.cos(t1);

    const tipX = elbowX + LINK_2_MM * Math.sin(t2 - t1);
    const tipY = elbowY + LINK_2_MM * Math.cos(t2 - t1);

    return { elbow: { x: elbowX, y: elbowY }, tip: { x: tipX, y: tipY } };
}

const TRAIL_BLADE_MM = 15;
const TRAIL_MAX_TURN_RATE_DEG_PER_SEC = 1000;
const OVERCUT_RUNWAY_MM = TRAIL_BLADE_MM * 4;

const CUTOUT_LOOP_TOLERANCE_MM = 5;
const CUTOUT_CROSS_TOLERANCE_MM = 5;
const CUTOUT_SIMPLIFY_TOLERANCE_MM = 3;
const CUTOUT_VERTEX_MERGE_MM = 1.5;
const CUTOUT_MIN_AREA_MM2 = 200;

const CUTOUT_FILL_COLOR = '#c9a66b';
const CUTOUT_SHADOW_COLOR = '#7a5c3a';
const CUTOUT_SHADOW_OFFSET = 6;

function flattenTrail(segments) {
    if (segments.length === 0) return [];

    const points = [{ x: segments[0].x1, y: segments[0].y1 }];
    segments.forEach(segment => points.push({ x: segment.x2, y: segment.y2 }));
    return points;
}

function simplifyPolyline(points, toleranceMm) {
    if (points.length < 3) return points.slice();

    function perpendicularDistance(point, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared < 1e-9) return Math.hypot(point.x - a.x, point.y - a.y);

        const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
        const projX = a.x + t * dx, projY = a.y + t * dy;

        return Math.hypot(point.x - projX, point.y - projY);
    }

    function simplifySection(section) {
        if (section.length < 3) return section;

        let maxDistance = 0;
        let maxIndex = 0;

        for (let i = 1; i < section.length - 1; i++) {
            const distance = perpendicularDistance(section[i], section[0], section[section.length - 1]);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance <= toleranceMm) {
            return [section[0], section[section.length - 1]];
        }

        const left = simplifySection(section.slice(0, maxIndex + 1));
        const right = simplifySection(section.slice(maxIndex));
        return left.slice(0, -1).concat(right);
    }

    return simplifySection(points);
}

function closestPtSegmentSegment(p1, q1, p2, q2) {
    const d1x = q1.x - p1.x, d1y = q1.y - p1.y;
    const d2x = q2.x - p2.x, d2y = q2.y - p2.y;
    const rx = p1.x - p2.x, ry = p1.y - p2.y;

    const a = d1x * d1x + d1y * d1y;
    const e = d2x * d2x + d2y * d2y;
    const f = d2x * rx + d2y * ry;

    const EPS = 1e-9;
    let s, t;

    if (a <= EPS && e <= EPS) {
        s = 0; t = 0;
    } else if (a <= EPS) {
        s = 0;
        t = Math.max(0, Math.min(1, f / e));
    } else {
        const c = d1x * rx + d1y * ry;
        if (e <= EPS) {
            t = 0;
            s = Math.max(0, Math.min(1, -c / a));
        } else {
            const b = d1x * d2x + d1y * d2y;
            const denom = a * e - b * b;
            s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
            t = (b * s + f) / e;

            if (t < 0) {
                t = 0;
                s = Math.max(0, Math.min(1, -c / a));
            } else if (t > 1) {
                t = 1;
                s = Math.max(0, Math.min(1, (b - c) / a));
            }
        }
    }

    const c1x = p1.x + d1x * s, c1y = p1.y + d1y * s;
    const c2x = p2.x + d2x * t, c2y = p2.y + d2y * t;
    const dx = c1x - c2x, dy = c1y - c2y;

    return { s, t, distSq: dx * dx + dy * dy };
}

function buildPlanarGraph(points) {
    const n = points.length;
    const splitParams = Array.from({ length: n - 1 }, () => [0, 1]);
    const bridges = [];
    const toleranceSq = CUTOUT_CROSS_TOLERANCE_MM * CUTOUT_CROSS_TOLERANCE_MM;

    const closed = points[0].x === points[n - 1].x && points[0].y === points[n - 1].y;

    for (let i = 0; i < n - 1; i++) {
        for (let j = i + 2; j < n - 1; j++) {
            if (closed && i === 0 && j === n - 2) continue;

            const p1 = points[i], q1 = points[i + 1];
            const p2 = points[j], q2 = points[j + 1];

            const d1x = q1.x - p1.x, d1y = q1.y - p1.y;
            const d2x = q2.x - p2.x, d2y = q2.y - p2.y;
            const denom = d1x * d2y - d1y * d2x;

            let t, u, crossed = false;

            if (Math.abs(denom) >= 1e-9) {
                t = ((p2.x - p1.x) * d2y - (p2.y - p1.y) * d2x) / denom;
                u = ((p2.x - p1.x) * d1y - (p2.y - p1.y) * d1x) / denom;
                crossed = t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
            }

            if (crossed) {
                splitParams[i].push(t);
                splitParams[j].push(u);
                continue;
            }

            const closest = closestPtSegmentSegment(p1, q1, p2, q2);
            if (closest.distSq > toleranceSq) continue;

            splitParams[i].push(closest.s);
            splitParams[j].push(closest.t);
            bridges.push({ i, s: closest.s, j, t: closest.t });
        }
    }

    const vertices = [];

    function findOrAddVertex(p) {
        for (let k = 0; k < vertices.length; k++) {
            if (Math.hypot(vertices[k].x - p.x, vertices[k].y - p.y) < CUTOUT_VERTEX_MERGE_MM) return k;
        }
        vertices.push({ x: p.x, y: p.y });
        return vertices.length - 1;
    }

    const edgeKeys = new Set();
    const edges = [];

    function addEdge(a, b) {
        if (a === b) return;
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push([a, b]);
    }

    function segmentVertexAt(i, t) {
        const ax = points[i].x, ay = points[i].y;
        const dx = points[i + 1].x - ax, dy = points[i + 1].y - ay;
        return findOrAddVertex({ x: ax + dx * t, y: ay + dy * t });
    }

    for (let i = 0; i < n - 1; i++) {
        const ts = [...new Set(splitParams[i])].sort((a, b) => a - b);
        const ax = points[i].x, ay = points[i].y;
        const dx = points[i + 1].x - ax, dy = points[i + 1].y - ay;

        let prevVertex = findOrAddVertex({ x: ax, y: ay });

        for (let k = 1; k < ts.length; k++) {
            const vertex = findOrAddVertex({ x: ax + dx * ts[k], y: ay + dy * ts[k] });
            addEdge(prevVertex, vertex);
            prevVertex = vertex;
        }
    }

    bridges.forEach(({ i, s, j, t }) => {
        addEdge(segmentVertexAt(i, s), segmentVertexAt(j, t));
    });

    return { vertices, edges };
}

function signedArea(polygon) {
    let sum = 0;

    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        sum += a.x * b.y - b.x * a.y;
    }

    return sum / 2;
}

function traceFaces(vertices, edges) {
    const adjacency = vertices.map(() => []);

    edges.forEach(([a, b]) => {
        adjacency[a].push({ to: b, angle: Math.atan2(vertices[b].y - vertices[a].y, vertices[b].x - vertices[a].x) });
        adjacency[b].push({ to: a, angle: Math.atan2(vertices[a].y - vertices[b].y, vertices[a].x - vertices[b].x) });
    });

    adjacency.forEach(list => list.sort((p, q) => p.angle - q.angle));

    const visited = new Set();
    const faces = [];

    edges.forEach(([a, b]) => {
        [[a, b], [b, a]].forEach(([startU, startV]) => {
            if (visited.has(`${startU}_${startV}`)) return;

            const polygon = [];
            let u = startU, v = startV;
            let guard = 0;

            while (guard++ < vertices.length + edges.length + 2) {
                visited.add(`${u}_${v}`);
                polygon.push(vertices[u]);

                const list = adjacency[v];
                const arrivalIndex = list.findIndex(entry => entry.to === u);
                const nextIndex = (arrivalIndex - 1 + list.length) % list.length;
                const next = list[nextIndex].to;

                u = v;
                v = next;

                if (u === startU && v === startV) break;
            }

            if (polygon.length >= 3) faces.push(polygon);
        });
    });

    return faces;
}

function excludeOuterFace(faces, vertices) {
    if (faces.length <= 1) return [];

    let extremeIndex = 0;
    vertices.forEach((v, i) => {
        if (v.y < vertices[extremeIndex].y || (v.y === vertices[extremeIndex].y && v.x < vertices[extremeIndex].x)) {
            extremeIndex = i;
        }
    });
    const extreme = vertices[extremeIndex];

    let outerFaceIndex = -1;
    let bestArea = -1;

    faces.forEach((face, index) => {
        if (!face.includes(extreme)) return;

        const area = Math.abs(signedArea(face));
        if (area > bestArea) {
            bestArea = area;
            outerFaceIndex = index;
        }
    });

    return faces.filter((_, index) => index !== outerFaceIndex);
}

function computeCutoutPolygons(points) {
    let simplified = simplifyPolyline(points, CUTOUT_SIMPLIFY_TOLERANCE_MM);
    if (simplified.length < 3) return [];

    const first = simplified[0];
    const last = simplified[simplified.length - 1];

    if ((last.x !== first.x || last.y !== first.y) && Math.hypot(last.x - first.x, last.y - first.y) <= CUTOUT_LOOP_TOLERANCE_MM) {
        simplified = simplified.concat([first]);
    }

    if (simplified.length < 4) return [];

    const { vertices, edges } = buildPlanarGraph(simplified);
    if (edges.length < 3) return [];

    const faces = traceFaces(vertices, edges);
    const enclosed = excludeOuterFace(faces, vertices);

    return enclosed.filter(face => Math.abs(signedArea(face)) >= CUTOUT_MIN_AREA_MM2);
}

function normalizeAngleRad(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

function inverseKinematics(x, y, elbowDown) {
    const c2raw = (x * x + y * y - LINK_1_MM * LINK_1_MM - LINK_2_MM * LINK_2_MM) / (2 * LINK_1_MM * LINK_2_MM);

    if (c2raw < -1.00001 || c2raw > 1.00001) {
        return null;
    }

    const c2 = Math.min(1, Math.max(-1, c2raw));
    let s2 = Math.sqrt(Math.max(0, 1 - c2 * c2));

    if (elbowDown) {
        s2 = -s2;
    }

    const t2 = Math.atan2(s2, c2);
    const t1 = Math.atan2(x, y) - Math.atan2(LINK_2_MM * s2, LINK_1_MM + LINK_2_MM * c2);

    const j1Deg = -deg(t1);
    const j2Deg = deg(t2);

    if (!angleInRange(j1Deg, j2Deg)) {
        return null;
    }

    return { j1Deg, j2Deg };
}

function isPointReachable(x, y) {
    return inverseKinematics(x, y, true) !== null || inverseKinematics(x, y, false) !== null;
}

function smoothPathXY(points, smoothingMs, maxDeviationDeg) {
    if (points.length < 3 || smoothingMs <= 0) {
        return points;
    }

    const smoothed = points.map(point => ({ x: point.x, y: point.y, t: point.t }));
    const windowFractions = [1, 0.5, 0.25, 0];

    for (let i = 0; i < points.length; i++) {
        const rawX = points[i].x;
        const rawY = points[i].y;

        const reachMm = Math.max(Math.hypot(rawX, rawY), 20);
        const maxDeviationMm = rad(maxDeviationDeg) * reachMm;
        const elbowDown = rawX < 0;

        let solved = false;

        for (const fraction of windowFractions) {
            const windowMs = smoothingMs * fraction;

            let sx = rawX;
            let sy = rawY;

            if (windowMs > 0) {
                let sumX = 0;
                let sumY = 0;
                let count = 0;

                for (const point of points) {
                    if (Math.abs((point.t - points[i].t) * 1000) <= windowMs) {
                        sumX += point.x;
                        sumY += point.y;
                        count++;
                    }
                }

                sx = sumX / count;
                sy = sumY / count;
            }

            if (maxDeviationDeg > 0) {
                sx = Math.min(rawX + maxDeviationMm, Math.max(rawX - maxDeviationMm, sx));
                sy = Math.min(rawY + maxDeviationMm, Math.max(rawY - maxDeviationMm, sy));
            }

            if (inverseKinematics(sx, sy, elbowDown)) {
                smoothed[i].x = sx;
                smoothed[i].y = sy;
                solved = true;
                break;
            }
        }

        if (!solved) {
            smoothed[i].x = rawX;
            smoothed[i].y = rawY;
        }
    }

    smoothed[0] = { ...points[0] };
    smoothed[smoothed.length - 1] = { ...points[points.length - 1] };

    return smoothed;
}

const CANVAS_WIDTH = 1000;
const CANVAS_TOP_CROP = 220;
const CANVAS_HEIGHT = 1000 - CANVAS_TOP_CROP;
const REACH_MM = LINK_1_MM + LINK_2_MM;

const centerX = CANVAS_WIDTH / 2;
const centerY = CANVAS_WIDTH / 2 + CANVAS_WIDTH * 0.18 - CANVAS_TOP_CROP;
const scale = (CANVAS_WIDTH * 0.42) / REACH_MM;

const toScreen = (x, y) => ({ x: centerX + x * scale, y: centerY - y * scale });
const toMm = (px, py) => ({ x: (px - centerX) / scale, y: (centerY - py) / scale });

const VIEW_MODE = 'desk';
const VIEW_TRANSITION_MS = 1200;

const DESK_ZOOM = 1.5;
const DESK_FOCUS_MM = { x: 280, y: 50 };
const DESK_FOCUS_SCREEN = toScreen(DESK_FOCUS_MM.x, DESK_FOCUS_MM.y);
const DESK_FOCUS_TARGET = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

const DESK_PAN_X = DESK_FOCUS_TARGET.x - DESK_ZOOM * DESK_FOCUS_SCREEN.x;
const DESK_PAN_Y = DESK_FOCUS_TARGET.y - DESK_ZOOM * DESK_FOCUS_SCREEN.y;

let cameraZoom = 1;
let cameraPanX = 0;
let cameraPanY = 0;

function toMmView(px, py) {
    return toMm((px - cameraPanX) / cameraZoom, (py - cameraPanY) / cameraZoom);
}

const REACH_BOUNDARY_SAMPLES = 180;

function maxReachableRadius(dirX, dirY) {
    let best = 0;

    for (let radius = 2; radius <= REACH_MM; radius += 2) {
        if (isPointReachable(dirX * radius, dirY * radius)) {
            best = radius;
        }
    }

    return best;
}

const reachBoundary = Array.from({ length: REACH_BOUNDARY_SAMPLES }, (_, index) => {
    const phi = (index / REACH_BOUNDARY_SAMPLES) * Math.PI * 2;
    const radius = maxReachableRadius(Math.cos(phi), Math.sin(phi));
    return { phi, r: radius };
});

const HOME_DEADZONE_RADIUS_MM = 40;

const homeArmSegment = (() => {
    const forward = forwardKinematics(HOME_J1_DEG, HOME_J2_DEG);
    return { ax: 0, ay: 0, bx: forward.elbow.x, by: forward.elbow.y };
})();

const STATIONARY_ARM_LENGTH_MM = 160;
const STATIONARY_ARM_DEADZONE_RADIUS_MM = 40;
const stationaryArmSegment = { ax: 0, ay: 0, bx: 0, by: -STATIONARY_ARM_LENGTH_MM };

const ARM_BODY_COLOR = '#f2f2f2';
const ARM_OUTLINE_COLOR = '#a8a8a8';
const ARM_GREEN = '#2FAE60';
const BASE_PLATE_COLOR = '#4a4a4a';
const BASE_PLATE_LENGTH_MM = 320;
const BASE_PLATE_TOP_MM = 260;
const BASE_PLATE_WIDTH = 60;
const UPPER_ARM_SHORTEN_PX = 56;

const STATIONARY_BUTTON_LARGE_RADIUS = 12;
const STATIONARY_BUTTON_SMALL_RADIUS = 8;
const STATIONARY_BUTTON_BORDER_COLOR = '#9d9d9d';
const STATIONARY_BUTTON_SMALL_FRACTIONS = [0.22, 0.42, 0.62];

const CUTTING_HEAD_RADIUS = 40;
const CUTTING_HEAD_STROKE_WIDTH = 3;
const CUTTING_HEAD_BAR_HEIGHT = 40;
const CUTTING_HEAD_BAR_RADIUS = 5;
const CUTTING_HEAD_BAR_OVERHANG = 37;
const ARM_END_CAP_RADIUS = 29;

const TRACING_HEAD_RADIUS = 22;
const TRACE_HEAD_REST_SCREEN = { x: 975, y: 500 };
const TRACE_HEAD_REST_ANGLE = -0.4;

const REST_SPOT_COLOR = '#8f8f8f';
const REST_SPOT_OPACITY = 0.35;
const REST_SPOT_LABEL_GAP = 10;
const REST_SPOT_FONT = "600 11px 'Plus Jakarta Sans', sans-serif";

function strokeBodySegment(ctx, ax, ay, bx, by) {
    ctx.lineCap = 'round';

    ctx.lineWidth = 64;
    ctx.strokeStyle = ARM_OUTLINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.lineWidth = 58;
    ctx.strokeStyle = ARM_BODY_COLOR;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
}

function drawCuttingHeadBarPass(ctx, armLocalX, overhang, halfHeight, cornerRadius, notchRadius, color) {
    ctx.beginPath();
    ctx.roundRect(armLocalX, -halfHeight, overhang - armLocalX, halfHeight * 2, cornerRadius);

    if (notchRadius > 0) {
        ctx.moveTo(armLocalX + notchRadius, 0);
        ctx.arc(armLocalX, 0, notchRadius, 0, Math.PI * 2);
    }

    ctx.fillStyle = color;
    ctx.fill(notchRadius > 0 ? 'evenodd' : 'nonzero');
}

function drawHead(ctx, worldX, worldY, worldAngle, armLocalX, radius, strokeWidth, docked, withBar, withIndicator) {
    ctx.save();
    ctx.translate(worldX, worldY);
    ctx.rotate(worldAngle);

    ctx.beginPath();
    ctx.arc(0, 0, radius + strokeWidth, 0, Math.PI * 2);
    ctx.fillStyle = ARM_OUTLINE_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = ARM_BODY_COLOR;
    ctx.fill();

    if (withBar) {
        drawCuttingHeadBarPass(
            ctx, armLocalX,
            CUTTING_HEAD_BAR_OVERHANG + strokeWidth,
            CUTTING_HEAD_BAR_HEIGHT / 2 + strokeWidth,
            CUTTING_HEAD_BAR_RADIUS + strokeWidth,
            docked ? ARM_END_CAP_RADIUS + strokeWidth : 0,
            ARM_OUTLINE_COLOR
        );
        drawCuttingHeadBarPass(
            ctx, armLocalX,
            CUTTING_HEAD_BAR_OVERHANG,
            CUTTING_HEAD_BAR_HEIGHT / 2,
            CUTTING_HEAD_BAR_RADIUS,
            docked ? ARM_END_CAP_RADIUS : 0,
            ARM_BODY_COLOR
        );
    }

    if (withIndicator) {
        ctx.beginPath();
        ctx.roundRect(
            CUTTING_HEAD_BAR_OVERHANG - INDICATOR_MARGIN - INDICATOR_WIDTH / 2,
            -INDICATOR_HEIGHT / 2,
            INDICATOR_WIDTH,
            INDICATOR_HEIGHT,
            INDICATOR_RADIUS
        );
        ctx.fillStyle = INDICATOR_COLOR;
        ctx.fill();
    }

    ctx.restore();
}

function drawRestSpot(ctx, x, y, radius, labelColor, label) {
    ctx.save();
    ctx.globalAlpha = REST_SPOT_OPACITY;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = REST_SPOT_COLOR;
    ctx.fill();
    ctx.restore();

    ctx.font = REST_SPOT_FONT;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - radius - REST_SPOT_LABEL_GAP);
}

const TENSIONER_WIDTH = 9;
const TENSIONER_HEIGHT = 15;
const TENSIONER_RADIUS = 4;

const INDICATOR_WIDTH = 6;
const INDICATOR_HEIGHT = 15;
const INDICATOR_RADIUS = 3;
const INDICATOR_MARGIN = -1;
const INDICATOR_COLOR = '#333333';

const PIVOT_MARKER_WIDTH = 16;
const PIVOT_MARKER_HEIGHT = 22;
const PIVOT_MARKER_RADIUS = 8;
const PIVOT_MARKER_SETBACK = 55;

function drawBeltTensioner(ctx, cx, cy, angleRad) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleRad);
    ctx.beginPath();
    ctx.roundRect(-TENSIONER_HEIGHT / 2, -TENSIONER_WIDTH / 2, TENSIONER_HEIGHT, TENSIONER_WIDTH, TENSIONER_RADIUS);
    ctx.fillStyle = ARM_GREEN;
    ctx.fill();
    ctx.restore();
}

function drawLatchButton(ctx, cx, cy, angleRad) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleRad);
    ctx.beginPath();
    ctx.roundRect(-PIVOT_MARKER_HEIGHT / 2, -PIVOT_MARKER_WIDTH / 2, PIVOT_MARKER_HEIGHT, PIVOT_MARKER_WIDTH, PIVOT_MARKER_RADIUS);
    ctx.fillStyle = ARM_GREEN;
    ctx.fill();
    ctx.restore();
}

function nearestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    let position = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
    position = Math.max(0, Math.min(1, position));

    return { x: ax + dx * position, y: ay + dy * position };
}

function distanceToSegment(x, y, segment) {
    const nearest = nearestPointOnSegment(x, y, segment.ax, segment.ay, segment.bx, segment.by);
    return Math.hypot(x - nearest.x, y - nearest.y);
}

function isPointDrawable(x, y) {
    if (x < 0) return false;
    if (!isPointReachable(x, y)) return false;
    if (distanceToSegment(x, y, homeArmSegment) < HOME_DEADZONE_RADIUS_MM) return false;
    if (distanceToSegment(x, y, stationaryArmSegment) < STATIONARY_ARM_DEADZONE_RADIUS_MM) return false;
    return true;
}

const PHYSICS_DT = 0.004;

function stepCountFor(jointDistanceDeg, speedDegPerSec) {
    return Math.max(1, Math.ceil(jointDistanceDeg / speedDegPerSec / PHYSICS_DT));
}

function advanceTrailAngle(currentAngleRad, dx, dy, dtSeconds) {
    if (dtSeconds <= 0 || Math.hypot(dx, dy) <= 1e-4) {
        return currentAngleRad;
    }

    const desiredAngle = Math.atan2(-dy, -dx);
    const maxStep = rad(TRAIL_MAX_TURN_RATE_DEG_PER_SEC) * dtSeconds;
    const delta = normalizeAngleRad(desiredAngle - currentAngleRad);

    return normalizeAngleRad(currentAngleRad + Math.max(-maxStep, Math.min(maxStep, delta)));
}

function groupIntoElbowRuns(points) {
    const runs = [];
    let current = [];
    let currentElbow = null;
    let skippedPoints = 0;

    for (const point of points) {
        if (currentElbow !== null && inverseKinematics(point.x, point.y, currentElbow)) {
            current.push(point);
            continue;
        }

        if (current.length > 0) {
            runs.push({ elbow: currentElbow, points: current });
        }

        current = [];
        currentElbow = null;

        const preferredElbow = point.x < 0;
        let elbow = preferredElbow;

        if (!inverseKinematics(point.x, point.y, elbow)) {
            elbow = !preferredElbow;

            if (!inverseKinematics(point.x, point.y, elbow)) {
                skippedPoints++;
                continue;
            }
        }

        currentElbow = elbow;
        current.push(point);
    }

    if (current.length > 0) {
        runs.push({ elbow: currentElbow, points: current });
    }

    return { runs, skippedPoints };
}

function overcutApproachPoint(points, elbow) {
    if (points.length < 2) return null;

    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const length = Math.hypot(dx, dy);

    if (length < 1e-6) return null;

    const unitX = dx / length;
    const unitY = dy / length;
    const fractions = [1, 0.5, 0.25, 0.125, 0.0625, 0.03, 0.015];

    for (const fraction of fractions) {
        const distanceMm = OVERCUT_RUNWAY_MM * fraction;
        const candidateX = points[0].x - unitX * distanceMm;
        const candidateY = points[0].y - unitY * distanceMm;

        if (inverseKinematics(candidateX, candidateY, elbow)) {
            return { x: candidateX, y: candidateY };
        }
    }

    return null;
}

function solveElbowRuns(topology) {
    let reference = HOME_J2_DEG;

    const solveOne = (point, elbow) => {
        const solved = inverseKinematics(point.x, point.y, elbow);
        const j2Unwrapped = reference + shortestJointDelta(solved.j2Deg, reference);
        reference = j2Unwrapped;
        return { j1: solved.j1Deg, j2: j2Unwrapped };
    };

    return topology.map(({ elbow, points }) => {
        const approachPoint = overcutApproachPoint(points, elbow);
        const approach = approachPoint ? solveOne(approachPoint, elbow) : null;
        return { approach, points: points.map(point => solveOne(point, elbow)) };
    });
}

function simulateBladeArrivals(runs, speedDegPerSec) {
    let simJ1 = HOME_J1_DEG;
    let simJ2 = HOME_J2_DEG;

    const homeForward = forwardKinematics(simJ1, simJ2);
    let simAngle = Math.atan2(homeForward.tip.y - homeForward.elbow.y, homeForward.tip.x - homeForward.elbow.x);
    let simLastPivot = homeForward.tip;

    function driveTo(target) {
        const startJ1 = simJ1;
        const startJ2 = simJ2;
        const distance = Math.max(Math.abs(target.j1 - startJ1), Math.abs(target.j2 - startJ2));
        const steps = stepCountFor(distance, speedDegPerSec);

        for (let step = 1; step <= steps; step++) {
            const fraction = step / steps;
            simJ1 = startJ1 + (target.j1 - startJ1) * fraction;
            simJ2 = startJ2 + (target.j2 - startJ2) * fraction;

            const pivot = forwardKinematics(simJ1, simJ2).tip;
            simAngle = advanceTrailAngle(simAngle, pivot.x - simLastPivot.x, pivot.y - simLastPivot.y, PHYSICS_DT);
            simLastPivot = pivot;
        }

        return {
            x: simLastPivot.x + TRAIL_BLADE_MM * Math.cos(simAngle),
            y: simLastPivot.y + TRAIL_BLADE_MM * Math.sin(simAngle)
        };
    }

    return runs.map(run => {
        if (run.approach) driveTo(run.approach);
        return run.points.map(target => driveTo(target));
    });
}

function computeBladeCompensatedPath(desiredPoints, speedDegPerSec) {
    const { runs: topology, skippedPoints } = groupIntoElbowRuns(desiredPoints);

    if (topology.length === 0) {
        return { runs: [], skippedPoints };
    }

    const state = topology.map(({ elbow, points }) => ({
        elbow,
        points: points.map((point, index) => {
            const previous = points[Math.max(0, index - 1)];
            const next = points[Math.min(points.length - 1, index + 1)];
            const dx = next.x - previous.x;
            const dy = next.y - previous.y;
            const length = Math.hypot(dx, dy);

            let x = point.x;
            let y = point.y;

            if (length >= 1e-6) {
                const candidateX = point.x + TRAIL_BLADE_MM * dx / length;
                const candidateY = point.y + TRAIL_BLADE_MM * dy / length;

                if (inverseKinematics(candidateX, candidateY, elbow)) {
                    x = candidateX;
                    y = candidateY;
                }
            }

            return { x, y, desiredX: point.x, desiredY: point.y };
        })
    }));

    const iterations = 6;
    const gain = 0.85;
    const asTopology = () => state.map(run => ({ elbow: run.elbow, points: run.points }));

    let jointRuns = solveElbowRuns(asTopology());

    for (let iteration = 0; iteration < iterations; iteration++) {
        const arrivals = simulateBladeArrivals(jointRuns, speedDegPerSec);

        for (let runIndex = 0; runIndex < state.length; runIndex++) {
            for (let pointIndex = 0; pointIndex < state[runIndex].points.length; pointIndex++) {
                const point = state[runIndex].points[pointIndex];
                const actual = arrivals[runIndex][pointIndex];

                const nextX = point.x + gain * (point.desiredX - actual.x);
                const nextY = point.y + gain * (point.desiredY - actual.y);

                if (inverseKinematics(nextX, nextY, state[runIndex].elbow)) {
                    point.x = nextX;
                    point.y = nextY;
                }
            }
        }

        jointRuns = solveElbowRuns(asTopology());
    }

    return { runs: jointRuns, skippedPoints };
}

export function init(root = document, onClose = null) {
    const canvas = root.getElementById('stage');
    const ctx = canvas.getContext('2d');
    const contentRoot = root.host || document.documentElement;

    const closeBtn = root.getElementById('btn-close');
    const drawBtn = root.getElementById('drawBtn');
    const cutBtn = root.getElementById('cutBtn');
    const repeatBtn = root.getElementById('repeatBtn');
    const stabilizeBtn = root.getElementById('stabilizeBtn');
    const stabilizeVal = root.getElementById('stabilizeVal');
    const statusText = root.getElementById('statusText');
    const bladeVal = root.getElementById('bladeVal');
    const j1ValEl = root.getElementById('j1Val');
    const j2ValEl = root.getElementById('j2Val');

    function setStatus(text) {
        statusText.textContent = text;
    }

    let disposed = false;
    let drawnPoints = [];
    let strokeStartMs = 0;
    let isDrawing = false;
    let isPlaying = false;
    let viewTransitioning = false;
    let stabilizationEnabled = false;
    let arm = { j1: HOME_J1_DEG, j2: HOME_J2_DEG };
    let bladeDown = false;
    let cuttingHeadDocked = false;
    let cuttingHeadWorldX = HEAD_REST_SCREEN.x;
    let cuttingHeadWorldY = HEAD_REST_SCREEN.y;
    let cuttingHeadWorldAngle = HEAD_REST_ANGLE;
    let trail = [];
    let trailBladeAngleRad = 0;
    let trailBladeLastPivot = null;
    let cutoutPolygons = [];

    let drawState = 'idle';
    let tracingHeadDocked = false;
    let tracingHeadWorldX = TRACE_HEAD_REST_SCREEN.x;
    let tracingHeadWorldY = TRACE_HEAD_REST_SCREEN.y;
    let tracingHeadWorldAngle = TRACE_HEAD_REST_ANGLE;
    let traceJ2Reference = HOME_J2_DEG;
    let traceCatchupStartMs = 0;
    let traceTargetX = 0;
    let traceTargetY = 0;

    let lastAction = null;

    function refreshRepeatButton() {
        repeatBtn.disabled = lastAction === null;
    }

    closeBtn.addEventListener('click', () => {
        if (onClose) {
            onClose();
        } else {
            window.location.href = '../index.html';
        }
    });

    const HOME_POSE_EPSILON_DEG = 0.5;

    function isArmAtHome() {
        return Math.abs(arm.j1 - HOME_J1_DEG) < HOME_POSE_EPSILON_DEG
            && Math.abs(shortestJointDelta(arm.j2, HOME_J2_DEG)) < HOME_POSE_EPSILON_DEG;
    }

    function trailingBladeTip(pivot) {
        return {
            x: pivot.x + TRAIL_BLADE_MM * Math.cos(trailBladeAngleRad),
            y: pivot.y + TRAIL_BLADE_MM * Math.sin(trailBladeAngleRad)
        };
    }

    function updateTrailingBlade(pivot) {
        if (trailBladeLastPivot === null) {
            trailBladeLastPivot = pivot;
            return;
        }

        const dx = pivot.x - trailBladeLastPivot.x;
        const dy = pivot.y - trailBladeLastPivot.y;
        trailBladeLastPivot = pivot;

        trailBladeAngleRad = advanceTrailAngle(trailBladeAngleRad, dx, dy, PHYSICS_DT);
    }

    function resetTrailingBlade() {
        const forward = forwardKinematics(arm.j1, arm.j2);
        trailBladeAngleRad = Math.atan2(forward.tip.y - forward.elbow.y, forward.tip.x - forward.elbow.x);
        trailBladeLastPivot = null;
    }

    function cssVariable(name) {
        return getComputedStyle(contentRoot).getPropertyValue(name).trim();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(cameraPanX, cameraPanY);
        ctx.scale(cameraZoom, cameraZoom);

        ctx.beginPath();
        reachBoundary.forEach((point, index) => {
            const screen = toScreen(point.r * Math.cos(point.phi), point.r * Math.sin(point.phi));
            if (index === 0) ctx.moveTo(screen.x, screen.y);
            else ctx.lineTo(screen.x, screen.y);
        });
        ctx.closePath();
        ctx.fillStyle = cssVariable('--workspace');
        ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';

        const deadzoneA = toScreen(homeArmSegment.ax, homeArmSegment.ay);
        const deadzoneB = toScreen(homeArmSegment.bx, homeArmSegment.by);

        ctx.lineWidth = HOME_DEADZONE_RADIUS_MM * 2 * scale;
        ctx.beginPath();
        ctx.moveTo(deadzoneA.x, deadzoneA.y);
        ctx.lineTo(deadzoneB.x, deadzoneB.y);
        ctx.stroke();

        const stationaryDeadzoneA = toScreen(stationaryArmSegment.ax, stationaryArmSegment.ay);
        const stationaryDeadzoneB = toScreen(stationaryArmSegment.bx, stationaryArmSegment.by);

        ctx.lineWidth = STATIONARY_ARM_DEADZONE_RADIUS_MM * 2 * scale;
        ctx.beginPath();
        ctx.moveTo(stationaryDeadzoneA.x, stationaryDeadzoneA.y);
        ctx.lineTo(stationaryDeadzoneB.x, stationaryDeadzoneB.y);
        ctx.stroke();
        ctx.restore();

        const basePlateA = toScreen(0, BASE_PLATE_TOP_MM);
        const basePlateB = toScreen(0, BASE_PLATE_TOP_MM - BASE_PLATE_LENGTH_MM);

        ctx.lineCap = 'round';
        ctx.lineWidth = BASE_PLATE_WIDTH;
        ctx.strokeStyle = BASE_PLATE_COLOR;
        ctx.beginPath();
        ctx.moveTo(basePlateA.x, basePlateA.y);
        ctx.lineTo(basePlateB.x, basePlateB.y);
        ctx.stroke();

        if (drawnPoints.length > 1) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = cssVariable('--black');

            ctx.beginPath();
            drawnPoints.forEach((point, index) => {
                const screen = toScreen(point.x, point.y);
                if (index === 0) ctx.moveTo(screen.x, screen.y);
                else ctx.lineTo(screen.x, screen.y);
            });
            ctx.stroke();
        }

        if (cutoutPolygons.length > 0) {
            ctx.save();
            ctx.shadowColor = CUTOUT_SHADOW_COLOR;
            ctx.shadowOffsetX = CUTOUT_SHADOW_OFFSET;
            ctx.shadowOffsetY = CUTOUT_SHADOW_OFFSET;
            ctx.shadowBlur = 0;
            ctx.fillStyle = CUTOUT_FILL_COLOR;

            cutoutPolygons.forEach(polygon => {
                ctx.beginPath();
                polygon.forEach((point, index) => {
                    const screen = toScreen(point.x, point.y);
                    if (index === 0) ctx.moveTo(screen.x, screen.y);
                    else ctx.lineTo(screen.x, screen.y);
                });
                ctx.closePath();
                ctx.fill();
            });

            ctx.restore();
        }

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#e0332f';

        trail.forEach(segment => {
            const start = toScreen(segment.x1, segment.y1);
            const end = toScreen(segment.x2, segment.y2);

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        });

        const { elbow, tip: pivot } = forwardKinematics(arm.j1, arm.j2);
        const bladeTip = trailingBladeTip(pivot);

        const base = toScreen(0, 0);
        const elbowScreen = toScreen(elbow.x, elbow.y);
        const pivotScreen = toScreen(pivot.x, pivot.y);
        const bladeTipScreen = toScreen(bladeTip.x, bladeTip.y);

        const linkDx = elbowScreen.x - base.x;
        const linkDy = elbowScreen.y - base.y;
        const linkLength = Math.hypot(linkDx, linkDy) || 1;
        const nx = linkDy / linkLength;
        const ny = -linkDx / linkLength;
        const linkAngle = Math.atan2(linkDy, linkDx);

        [0.3, 0.6].forEach(t => {
            drawBeltTensioner(ctx, base.x + linkDx * t + nx * 34, base.y + linkDy * t + ny * 34, linkAngle);
        });

        const pivotSegDx = pivotScreen.x - elbowScreen.x;
        const pivotSegDy = pivotScreen.y - elbowScreen.y;
        const pivotSegLen = Math.hypot(pivotSegDx, pivotSegDy) || 1;
        const upperArmVisualEndX = pivotScreen.x - (pivotSegDx / pivotSegLen) * UPPER_ARM_SHORTEN_PX;
        const upperArmVisualEndY = pivotScreen.y - (pivotSegDy / pivotSegLen) * UPPER_ARM_SHORTEN_PX;

        {
            const armLocalX = -UPPER_ARM_SHORTEN_PX;
            const headAngle = Math.atan2(pivotScreen.y - elbowScreen.y, pivotScreen.x - elbowScreen.x);

            if (cuttingHeadDocked) {
                cuttingHeadWorldX = pivotScreen.x;
                cuttingHeadWorldY = pivotScreen.y;
                cuttingHeadWorldAngle = headAngle;
            }
            if (tracingHeadDocked) {
                tracingHeadWorldX = pivotScreen.x;
                tracingHeadWorldY = pivotScreen.y;
                tracingHeadWorldAngle = headAngle;
            }

            const restLabelColor = cssVariable('--mid');
            drawRestSpot(ctx, HEAD_REST_SCREEN.x, HEAD_REST_SCREEN.y, CUTTING_HEAD_RADIUS, restLabelColor, 'Cutting Head');
            drawRestSpot(ctx, TRACE_HEAD_REST_SCREEN.x, TRACE_HEAD_REST_SCREEN.y, TRACING_HEAD_RADIUS, restLabelColor, 'Tracing Head');

            drawHead(
                ctx, cuttingHeadWorldX, cuttingHeadWorldY, cuttingHeadWorldAngle,
                armLocalX, CUTTING_HEAD_RADIUS, CUTTING_HEAD_STROKE_WIDTH,
                cuttingHeadDocked, true, true
            );
            drawHead(
                ctx, tracingHeadWorldX, tracingHeadWorldY, tracingHeadWorldAngle,
                armLocalX, TRACING_HEAD_RADIUS, CUTTING_HEAD_STROKE_WIDTH,
                tracingHeadDocked, false, false
            );
        }

        strokeBodySegment(ctx, base.x, base.y, elbowScreen.x, elbowScreen.y);
        strokeBodySegment(ctx, elbowScreen.x, elbowScreen.y, upperArmVisualEndX, upperArmVisualEndY);

        const stationaryBase = toScreen(stationaryArmSegment.ax, stationaryArmSegment.ay);
        const stationaryTip = toScreen(stationaryArmSegment.bx, stationaryArmSegment.by);

        strokeBodySegment(ctx, stationaryBase.x, stationaryBase.y, stationaryTip.x, stationaryTip.y);

        ctx.beginPath();
        ctx.arc(stationaryTip.x, stationaryTip.y, STATIONARY_BUTTON_LARGE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ARM_GREEN;
        ctx.fill();

        STATIONARY_BUTTON_SMALL_FRACTIONS.forEach(t => {
            const px = stationaryTip.x + (stationaryBase.x - stationaryTip.x) * t;
            const py = stationaryTip.y + (stationaryBase.y - stationaryTip.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, STATIONARY_BUTTON_SMALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = ARM_BODY_COLOR;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = STATIONARY_BUTTON_BORDER_COLOR;
            ctx.stroke();
        });

        {
            const stationaryDx = stationaryTip.x - stationaryBase.x;
            const stationaryDy = stationaryTip.y - stationaryBase.y;
            const stationaryLength = Math.hypot(stationaryDx, stationaryDy) || 1;
            const stationaryNx = -stationaryDy / stationaryLength;
            const stationaryNy = stationaryDx / stationaryLength;
            const stationaryAngle = Math.atan2(stationaryDy, stationaryDx);

            drawBeltTensioner(
                ctx,
                stationaryBase.x + stationaryDx * 0.5 + stationaryNx * 34,
                stationaryBase.y + stationaryDy * 0.5 + stationaryNy * 34,
                stationaryAngle
            );
        }

        if (cuttingHeadDocked) {
            ctx.lineWidth = 6;
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = cssVariable('--black');

            ctx.beginPath();
            ctx.moveTo(pivotScreen.x, pivotScreen.y);
            ctx.lineTo(bladeTipScreen.x, bladeTipScreen.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        {
            const pivotDx = pivotScreen.x - elbowScreen.x;
            const pivotDy = pivotScreen.y - elbowScreen.y;
            const pivotSegLength = Math.hypot(pivotDx, pivotDy) || 1;
            const nearPivotX = pivotScreen.x - (pivotDx / pivotSegLength) * PIVOT_MARKER_SETBACK;
            const nearPivotY = pivotScreen.y - (pivotDy / pivotSegLength) * PIVOT_MARKER_SETBACK;
            const pivotSegAngle = Math.atan2(pivotDy, pivotDx);

            drawLatchButton(ctx, nearPivotX, nearPivotY, pivotSegAngle);
        }

        if (cuttingHeadDocked) {
            ctx.beginPath();
            ctx.arc(bladeTipScreen.x, bladeTipScreen.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = bladeDown ? '#e0332f' : '#6b7280';
            ctx.fill();
        }

        ctx.restore();
        updateStats();
    }

    function updateStats() {
        j1ValEl.textContent = `${arm.j1.toFixed(1)}°`;
        j2ValEl.textContent = `${arm.j2.toFixed(1)}°`;
        bladeVal.textContent = bladeDown ? 'DOWN' : 'UP';
    }

    function pointerPos(event) {
        const rect = canvas.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return { px: (clientX - rect.left) * scaleX, py: (clientY - rect.top) * scaleY };
    }

    function applyTracingArmTarget(x, y, alpha) {
        const preferredElbow = x < 0;
        const solved = inverseKinematics(x, y, preferredElbow) || inverseKinematics(x, y, !preferredElbow);
        if (!solved) return;

        const j2Unwrapped = traceJ2Reference + shortestJointDelta(solved.j2Deg, traceJ2Reference);
        traceJ2Reference = j2Unwrapped;

        arm.j1 += (solved.j1Deg - arm.j1) * alpha;
        arm.j2 += (j2Unwrapped - arm.j2) * alpha;
    }

    function runTraceCatchup() {
        function frame(now) {
            if (disposed || !isDrawing || drawState !== 'armed') return;

            const elapsed = now - traceCatchupStartMs;
            if (elapsed >= TRACE_CATCHUP_MS) {
                applyTracingArmTarget(traceTargetX, traceTargetY, 1);
                render();
                return;
            }

            applyTracingArmTarget(traceTargetX, traceTargetY, TRACE_CATCHUP_ALPHA);
            render();
            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }

    function startDrawing(event) {
        if (drawState !== 'armed') return;

        isDrawing = true;
        setStatus('Drawing');
        drawnPoints = [];
        strokeStartMs = performance.now();
        traceJ2Reference = arm.j2;
        traceCatchupStartMs = performance.now();

        addPoint(event);
        runTraceCatchup();
    }

    function driveTracingArm(x, y) {
        traceTargetX = x;
        traceTargetY = y;

        if (performance.now() - traceCatchupStartMs < TRACE_CATCHUP_MS) return;

        applyTracingArmTarget(x, y, 1);
    }

    function addPoint(event) {
        if (viewTransitioning) return;

        const { px, py } = pointerPos(event);
        const raw = toMmView(px, py);
        const drawable = isPointDrawable(raw.x, raw.y);

        canvas.classList.toggle('drawable', drawable);

        if (!isDrawing || !drawable) return;

        driveTracingArm(raw.x, raw.y);

        const last = drawnPoints[drawnPoints.length - 1];

        if (!last || Math.hypot(raw.x - last.x, raw.y - last.y) > 3) {
            const time = (performance.now() - strokeStartMs) / 1000;
            drawnPoints.push({ x: raw.x, y: raw.y, t: time });
        }

        render();
        event.preventDefault();
    }

    function stopDrawing() {
        if (!isDrawing) return;

        isDrawing = false;
        endTrace();
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', addPoint);
    canvas.addEventListener('mouseleave', () => canvas.classList.remove('drawable'));
    window.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', addPoint, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    stabilizeBtn.addEventListener('click', () => {
        stabilizationEnabled = !stabilizationEnabled;
        stabilizeBtn.setAttribute('aria-pressed', String(stabilizationEnabled));
        stabilizeVal.textContent = stabilizationEnabled ? 'On' : 'Off';
    });

    function resetPath() {
        drawnPoints = [];
        trail = [];
        cutoutPolygons = [];
        cutBtn.disabled = true;
    }

    function animateTo(target, speedDegPerSec, traceTrail) {
        return new Promise(resolve => {
            const start = { j1: arm.j1, j2: arm.j2 };
            const distance = Math.max(Math.abs(target.j1 - start.j1), Math.abs(target.j2 - start.j2));
            const totalSteps = stepCountFor(distance, speedDegPerSec);

            let stepsDone = 0;
            let lastBladeTip = trailingBladeTip(forwardKinematics(arm.j1, arm.j2).tip);
            let accumulatorSeconds = 0;
            let lastNow = null;

            function substep() {
                stepsDone++;
                const fraction = stepsDone / totalSteps;

                arm.j1 = start.j1 + (target.j1 - start.j1) * fraction;
                arm.j2 = start.j2 + (target.j2 - start.j2) * fraction;

                const pivot = forwardKinematics(arm.j1, arm.j2).tip;
                updateTrailingBlade(pivot);
                const bladeTip = trailingBladeTip(pivot);

                if (traceTrail) {
                    trail.push({ x1: lastBladeTip.x, y1: lastBladeTip.y, x2: bladeTip.x, y2: bladeTip.y });
                }

                lastBladeTip = bladeTip;
            }

            function frame(now) {
                if (disposed) return;

                if (lastNow === null) lastNow = now;
                accumulatorSeconds = Math.min(accumulatorSeconds + (now - lastNow) / 1000, 0.25);
                lastNow = now;

                while (accumulatorSeconds >= PHYSICS_DT && stepsDone < totalSteps) {
                    substep();
                    accumulatorSeconds -= PHYSICS_DT;
                }

                render();

                if (stepsDone < totalSteps) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            }

            requestAnimationFrame(frame);
        });
    }

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function runInitialViewTransition() {
        if (VIEW_MODE !== 'desk') return;

        viewTransitioning = true;
        const startZoom = cameraZoom;
        const startPanX = cameraPanX;
        const startPanY = cameraPanY;
        let startTime = null;

        function frame(now) {
            if (disposed) return;

            if (startTime === null) startTime = now;
            const raw = Math.min(1, (now - startTime) / VIEW_TRANSITION_MS);
            const t = easeInOutQuad(raw);

            cameraZoom = startZoom + (DESK_ZOOM - startZoom) * t;
            cameraPanX = startPanX + (DESK_PAN_X - startPanX) * t;
            cameraPanY = startPanY + (DESK_PAN_Y - startPanY) * t;
            render();

            if (raw < 1) {
                requestAnimationFrame(frame);
            } else {
                viewTransitioning = false;
            }
        }

        requestAnimationFrame(frame);
    }

    function tweenWorld(fromX, fromY, fromAngle, toX, toY, toAngle, durationMs, onUpdate) {
        return new Promise(resolve => {
            let startTime = null;

            function frame(now) {
                if (disposed) return;

                if (startTime === null) startTime = now;
                const raw = Math.min(1, (now - startTime) / durationMs);
                const t = easeInOutQuad(raw);

                onUpdate(
                    fromX + (toX - fromX) * t,
                    fromY + (toY - fromY) * t,
                    fromAngle + (toAngle - fromAngle) * t
                );
                render();

                if (raw < 1) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            }

            requestAnimationFrame(frame);
        });
    }

    function setCuttingHeadWorld(x, y, angle) {
        cuttingHeadWorldX = x;
        cuttingHeadWorldY = y;
        cuttingHeadWorldAngle = angle;
    }

    function setTracingHeadWorld(x, y, angle) {
        tracingHeadWorldX = x;
        tracingHeadWorldY = y;
        tracingHeadWorldAngle = angle;
    }

    function computeArmGeometry() {
        const { elbow, tip: pivot } = forwardKinematics(arm.j1, arm.j2);
        const base = toScreen(0, 0);
        const elbowScreen = toScreen(elbow.x, elbow.y);
        const pivotScreen = toScreen(pivot.x, pivot.y);
        const headAngle = Math.atan2(pivotScreen.y - elbowScreen.y, pivotScreen.x - elbowScreen.x);
        return { base, elbowScreen, pivotScreen, headAngle };
    }

    async function cut() {
        if (drawState !== 'idle' || drawnPoints.length < 2) return;

        const sourcePoints = stabilizationEnabled
            ? smoothPathXY(drawnPoints, PRODUCT_SMOOTHING_MS, PRODUCT_MAX_DEVIATION_DEG)
            : drawnPoints;

        const speed = PLAYBACK_SPEED_DEG_PER_SEC;

        drawBtn.disabled = true;
        cutBtn.disabled = true;
        repeatBtn.disabled = true;
        stabilizeBtn.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 0));

        const { runs } = computeBladeCompensatedPath(sourcePoints, speed);

        if (runs.length === 0) {
            drawBtn.disabled = false;
            cutBtn.disabled = false;
            stabilizeBtn.disabled = false;
            refreshRepeatButton();
            return;
        }

        const armWasAtHome = isArmAtHome();

        isPlaying = true;
        setStatus('Cutting');
        trail = [];
        cutoutPolygons = [];
        bladeDown = false;

        resetTrailingBlade();
        render();

        if (armWasAtHome) {
            const firstPoint = sourcePoints[0];
            const introDirection = firstPoint && firstPoint.x < 0 ? 1 : -1;
            await animateTo({ j1: HOME_J1_DEG, j2: HOME_J2_DEG + introDirection * INTRO_EXTEND_DEG }, speed, false);
        }

        let geom = computeArmGeometry();
        let preDock = {
            x: geom.pivotScreen.x + Math.cos(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            y: geom.pivotScreen.y + Math.sin(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            angle: geom.headAngle
        };

        await tweenWorld(
            HEAD_REST_SCREEN.x, HEAD_REST_SCREEN.y, HEAD_REST_ANGLE,
            preDock.x, preDock.y, preDock.angle,
            HEAD_APPROACH_MS, setCuttingHeadWorld
        );
        await tweenWorld(
            preDock.x, preDock.y, preDock.angle,
            geom.pivotScreen.x, geom.pivotScreen.y, geom.headAngle,
            HEAD_DOCK_MS, setCuttingHeadWorld
        );

        cuttingHeadDocked = true;

        for (const run of runs) {
            if (run.approach) {
                await animateTo(run.approach, speed, false);
            }

            await animateTo(run.points[0], speed, false);

            bladeDown = true;
            render();

            for (let index = 1; index < run.points.length; index++) {
                await animateTo(run.points[index], speed, true);
            }

            bladeDown = false;
            render();
        }

        cutoutPolygons = computeCutoutPolygons(flattenTrail(trail));
        render();

        await wait(BLADE_TOGGLE_PAUSE_MS);
        cuttingHeadDocked = false;

        geom = computeArmGeometry();
        preDock = {
            x: geom.pivotScreen.x + Math.cos(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            y: geom.pivotScreen.y + Math.sin(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            angle: geom.headAngle
        };

        await tweenWorld(
            cuttingHeadWorldX, cuttingHeadWorldY, cuttingHeadWorldAngle,
            preDock.x, preDock.y, preDock.angle,
            HEAD_DOCK_MS, setCuttingHeadWorld
        );
        await tweenWorld(
            preDock.x, preDock.y, preDock.angle,
            HEAD_REST_SCREEN.x, HEAD_REST_SCREEN.y, HEAD_REST_ANGLE,
            HEAD_APPROACH_MS, setCuttingHeadWorld
        );

        lastAction = 'cut';

        isPlaying = false;
        setStatus('');
        drawBtn.disabled = false;
        cutBtn.disabled = false;
        stabilizeBtn.disabled = false;
        refreshRepeatButton();
        render();
    }

    async function armTracingHead() {
        if (isPlaying || drawState !== 'idle') return;

        drawState = 'docking';
        setStatus('Docking');
        drawBtn.disabled = true;
        cutBtn.disabled = true;
        repeatBtn.disabled = true;
        stabilizeBtn.disabled = true;

        resetPath();
        lastAction = null;
        refreshRepeatButton();

        const armWasAtHome = isArmAtHome();

        resetTrailingBlade();
        render();

        if (armWasAtHome) {
            await animateTo({ j1: HOME_J1_DEG, j2: HOME_J2_DEG - INTRO_EXTEND_DEG }, PLAYBACK_SPEED_DEG_PER_SEC, false);
        }

        const geom = computeArmGeometry();
        const preDock = {
            x: geom.pivotScreen.x + Math.cos(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            y: geom.pivotScreen.y + Math.sin(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            angle: geom.headAngle
        };

        await tweenWorld(
            TRACE_HEAD_REST_SCREEN.x, TRACE_HEAD_REST_SCREEN.y, TRACE_HEAD_REST_ANGLE,
            preDock.x, preDock.y, preDock.angle,
            HEAD_APPROACH_MS, setTracingHeadWorld
        );
        await tweenWorld(
            preDock.x, preDock.y, preDock.angle,
            geom.pivotScreen.x, geom.pivotScreen.y, geom.headAngle,
            HEAD_DOCK_MS, setTracingHeadWorld
        );

        tracingHeadDocked = true;
        traceJ2Reference = arm.j2;
        drawState = 'armed';
        setStatus('Armed');
        drawBtn.disabled = false;
        render();
    }

    async function endTrace() {
        if (drawState !== 'armed') return;

        drawState = 'undocking';
        setStatus('Finishing');
        drawBtn.disabled = true;

        const geom = computeArmGeometry();
        const preDock = {
            x: geom.pivotScreen.x + Math.cos(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            y: geom.pivotScreen.y + Math.sin(geom.headAngle) * HEAD_PRE_DOCK_OFFSET,
            angle: geom.headAngle
        };

        tracingHeadDocked = false;

        await tweenWorld(
            tracingHeadWorldX, tracingHeadWorldY, tracingHeadWorldAngle,
            preDock.x, preDock.y, preDock.angle,
            HEAD_DOCK_MS, setTracingHeadWorld
        );
        await tweenWorld(
            preDock.x, preDock.y, preDock.angle,
            TRACE_HEAD_REST_SCREEN.x, TRACE_HEAD_REST_SCREEN.y, TRACE_HEAD_REST_ANGLE,
            HEAD_APPROACH_MS, setTracingHeadWorld
        );

        drawState = 'idle';
        setStatus('');
        drawBtn.disabled = false;
        cutBtn.disabled = drawnPoints.length < 2;
        stabilizeBtn.disabled = false;
        refreshRepeatButton();
    }

    cutBtn.addEventListener('click', cut);
    drawBtn.addEventListener('click', () => {
        if (drawState === 'idle') {
            armTracingHead();
        } else if (drawState === 'armed') {
            endTrace();
        }
    });
    repeatBtn.addEventListener('click', () => {
        if (lastAction === 'cut') {
            cut();
        }
    });

    resetTrailingBlade();
    render();
    runInitialViewTransition();

    return function cleanup() {
        disposed = true;
        window.removeEventListener('mouseup', stopDrawing);
    };
}
