import type { ClipRect, Point } from '../core/render-kit/geometry';
import { clipPolygon, pointsAttr } from '../core/render-kit/geometry';
import { DEG } from '../core/config/constants';
import type { SceneShape } from './buildings';
import { curtainOverlayCorners, windowPointAt, type EvaluatedWindowGeometry } from './window-markers';
import type { SceneCamera } from './projection';

function projectWindowPoints(
    cam: SceneCamera, corners: readonly [number, number, number][], verticalScale: number
): Point[]
{
    return corners.map(([east, north, up]) =>
    {
        const projected = cam.project3(east, north, up * verticalScale);
        return [projected.x, projected.y];
    });
}

//One shape path for every window. Geometry/exposure are calculated upstream; this function only projects,
//clips, and paints the shared pane, shading cells, curtain, frame, and optional azimuth arrow.
export function renderWindow(
    cam: SceneCamera,
    clipRect: ClipRect,
    window: EvaluatedWindowGeometry,
    showAzimuthArrow: boolean,
    verticalScale = 1,
    selected = false
): SceneShape[]
{
    const geometry = window.geometry;
    const evaluation = window.evaluation;
    const displayGeometry = window.displayGeometry ?? geometry;
    if (!geometry || !displayGeometry || !evaluation)
    {
        return [];
    }

    const shapes: SceneShape[] = [];
    for (const cell of evaluation.exposure.cells)
    {
        const displayCell = [
            windowPointAt(displayGeometry, cell.u0, cell.v0),
            windowPointAt(displayGeometry, cell.u1, cell.v0),
            windowPointAt(displayGeometry, cell.u1, cell.v1),
            windowPointAt(displayGeometry, cell.u0, cell.v1),
        ];
        const projectedCell = projectWindowPoints(cam, displayCell, verticalScale);
        const clippedCell = clipPolygon(projectedCell, clipRect);
        if (clippedCell.length < 3)
        {
            continue;
        }
        const fill = evaluation.exposure.state === 'NO_DIRECT_SUN'
            ? 'rgba(111, 128, 138, 0.88)'
            : cell.sunlit ? 'rgba(255, 198, 92, 0.96)' : 'rgba(43, 58, 70, 0.96)';
        shapes.push({
            tag: 'polygon',
            geom: pointsAttr(clippedCell),
            fill,
            stroke: 'none',
            strokeWidth: '0',
        });
    }

    const curtainCorners = curtainOverlayCorners(displayGeometry, evaluation.curtainClosedFraction);
    if (curtainCorners)
    {
        const clippedCurtain = clipPolygon(projectWindowPoints(cam, curtainCorners, verticalScale), clipRect);
        if (clippedCurtain.length >= 3)
        {
            shapes.push({
                tag: 'polygon',
                geom: pointsAttr(clippedCurtain),
                fill: 'rgba(255, 255, 255, 0.96)',
                stroke: 'rgba(128, 138, 148, 0.92)',
                strokeWidth: '0.8',
            });
        }
    }

    const clippedFrame = clipPolygon(projectWindowPoints(cam, displayGeometry.corners, verticalScale), clipRect);
    if (clippedFrame.length >= 3)
    {
        shapes.push({
            tag: 'polygon',
            geom: pointsAttr(clippedFrame),
            fill: 'none',
            stroke: selected ? '#ffeb3b' : 'rgba(228, 247, 252, 0.95)',
            strokeWidth: selected ? '2.8' : '1.2',
        });
    }

    if (!showAzimuthArrow)
    {
        return shapes;
    }

    const center = displayGeometry.corners.reduce(
        (sum, corner) => [sum[0] + corner[0] / 4, sum[1] + corner[1] / 4, sum[2] + corner[2] / 4],
        [0, 0, 0] as [number, number, number]
    );
    const [arrowEast, arrowNorth] = window.arrowDirection ?? displayGeometry.arrowDirection;
    const start = cam.project3(center[0], center[1], center[2] * verticalScale);
    const end = cam.project3(
        center[0] + arrowEast * 1.2,
        center[1] + arrowNorth * 1.2,
        center[2] * verticalScale
    );
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let screenLength = Math.hypot(dx, dy);
    if (screenLength <= 0.5)
    {
        const bearing = cam.bearingDeg * DEG;
        const tilt = cam.tiltDeg * DEG;
        dx = arrowEast * Math.cos(bearing) + arrowNorth * Math.sin(bearing);
        dy = (arrowEast * Math.sin(bearing) - arrowNorth * Math.cos(bearing)) * Math.cos(tilt);
        screenLength = Math.hypot(dx, dy);
    }
    if (screenLength > 0.5)
    {
        const ux = dx / screenLength;
        const uy = dy / screenLength;
        const arrowLength = Math.max(26, screenLength);
        const endX = start.x + ux * arrowLength;
        const endY = start.y + uy * arrowLength;
        const headLength = Math.min(8, arrowLength * 0.4);
        const headWidth = headLength * 0.55;
        const headBaseX = endX - ux * headLength;
        const headBaseY = endY - uy * headLength;
        const sideX = -uy * headWidth;
        const sideY = ux * headWidth;
        shapes.push({
            tag: 'path',
            geom: `M${start.x.toFixed(1)},${start.y.toFixed(1)}L${endX.toFixed(1)},${endY.toFixed(1)}M${(headBaseX + sideX).toFixed(1)},${(headBaseY + sideY).toFixed(1)}L${endX.toFixed(1)},${endY.toFixed(1)}L${(headBaseX - sideX).toFixed(1)},${(headBaseY - sideY).toFixed(1)}`,
            fill: 'none',
            stroke: '#ffb84d',
            strokeWidth: '2',
        });
    }
    return shapes;
}