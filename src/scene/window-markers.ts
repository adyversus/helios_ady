import type { Point } from '../core/render-kit/geometry';
import {
    DEFAULT_WINDOW_AZIMUTH_DEG, DEFAULT_WINDOW_SILL_HEIGHT_M, DEFAULT_WINDOW_LENGTH_M,
    DEFAULT_WINDOW_HEIGHT_M, DEG, MAX_DISPLAY_RADIUS_M,
} from '../core/config/constants';
import { pointInPolygon } from '../core/render-kit/geometry';
import type { WindowDefinitionEntry } from '../core/config/helios-config';

export { DEFAULT_WINDOW_AZIMUTH_DEG } from '../core/config/constants';
export { DEFAULT_WINDOW_LENGTH_M, DEFAULT_WINDOW_HEIGHT_M };

export interface CenteredWindow
{
    edgeIndex:            number;
    azimuthDeg:           number;
    configuredAzimuthDeg: number;
    azimuthDifferenceDeg: number;
    edgeLengthM:          number;
    alongFacadeM:         number;
    arrowDirection:       Point;
    corners:              [number, number, number][];
}

export interface ResolvedWindowGeometry extends WindowDefinitionEntry
{
    geometry:        CenteredWindow | null;
    displayGeometry: CenteredWindow | null;
    arrowDirection:  Point | null;
    warnings:        string[];
}

export interface WindowEvaluation
{
    exposure:                WindowSunExposure;
    calculationAzimuthDeg:   number;
    curtainClosedFraction:   number;
    openPercent:             number;
}

export interface EvaluatedWindowGeometry extends ResolvedWindowGeometry
{
    evaluation: WindowEvaluation | null;
}

export type WindowSunState = 'NO_DIRECT_SUN' | 'SUNLIT' | 'PARTIALLY_SHADED' | 'FULLY_SHADED';

export interface WindowSunCell
{
    corners: [number, number, number][];
    sunlit:  boolean;
    u0:      number;
    u1:      number;
    v0:      number;
    v1:      number;
}

export interface WindowSunExposure
{
    state:          WindowSunState;
    sunlitFraction: number;
    cells:          WindowSunCell[];
}

export interface WindowOccluder
{
    footprint: Point[];
    holes?:    Point[][];
    height:    number;
}

export const CURTAIN_COLOR = '#607d8b';
const WALL_OFFSET_M = 0.025;

export function centeredWindowOnFacade(
    footprint: Point[],
    buildingHeight: number,
    azimuthDeg = DEFAULT_WINDOW_AZIMUTH_DEG,
    sillHeightM = DEFAULT_WINDOW_SILL_HEIGHT_M,
    lengthM?: number,
    heightM?: number,
    alongFacadeM = 0
): CenteredWindow | null
{
    if (footprint.length < 3 || !Number.isFinite(buildingHeight) || buildingHeight <= 0
        || !Number.isFinite(azimuthDeg) || !Number.isFinite(sillHeightM) || sillHeightM < 0
        || (lengthM !== undefined && (!Number.isFinite(lengthM) || lengthM <= 0))
        || (heightM !== undefined && (!Number.isFinite(heightM) || heightM <= 0))
        || !Number.isFinite(alongFacadeM))
    {
        return null;
    }

    const configuredAzimuthDeg = ((azimuthDeg % 360) + 360) % 360;
    let edgeIndex = -1;
    let edgeLength = 0;
    let smallestAzimuthDifference = Infinity;
    for (let edge = 0; edge < footprint.length; edge++)
    {
        const start = footprint[edge];
        const end = footprint[(edge + 1) % footprint.length];
        const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
        if (length === 0)
        {
            continue;
        }
        // Footprints are counter-clockwise, so the right-hand normal is the outward facade direction.
        const outwardX = (end[1] - start[1]) / length;
        const outwardY = -(end[0] - start[0]) / length;
        const outwardAzimuth = (Math.atan2(outwardX, outwardY) / DEG + 360) % 360;
        const delta = ((outwardAzimuth - configuredAzimuthDeg + 540) % 360) - 180;
        const azimuthDifference = Math.abs(delta);
        if (azimuthDifference < smallestAzimuthDifference)
        {
            edgeIndex = edge;
            edgeLength = length;
            smallestAzimuthDifference = azimuthDifference;
        }
    }
    if (edgeIndex < 0 || edgeLength <= 0)
    {
        return null;
    }

    const start = footprint[edgeIndex];
    const end = footprint[(edgeIndex + 1) % footprint.length];
    const tangentX = (end[0] - start[0]) / edgeLength;
    const tangentY = (end[1] - start[1]) / edgeLength;
    // Footprints are counter-clockwise, so the right-hand normal points outside the building.
    const outwardX = tangentY;
    const outwardY = -tangentX;
    const length = lengthM ?? Math.min(DEFAULT_WINDOW_LENGTH_M, edgeLength * 0.6);
    const height = heightM ?? Math.min(DEFAULT_WINDOW_HEIGHT_M, buildingHeight);
    const bottom = sillHeightM;
    if (length > edgeLength || Math.abs(alongFacadeM) + length / 2 > edgeLength / 2
        || bottom + height > buildingHeight)
    {
        return null;
    }
    const centerX = (start[0] + end[0]) / 2 + tangentX * alongFacadeM + outwardX * WALL_OFFSET_M;
    const centerY = (start[1] + end[1]) / 2 + tangentY * alongFacadeM + outwardY * WALL_OFFSET_M;
    const halfLength = length / 2;

    const leftX = centerX - tangentX * halfLength;
    const leftY = centerY - tangentY * halfLength;
    const rightX = centerX + tangentX * halfLength;
    const rightY = centerY + tangentY * halfLength;

    return {
        edgeIndex,
        azimuthDeg: (Math.atan2(outwardX, outwardY) / DEG + 360) % 360,
        configuredAzimuthDeg,
        azimuthDifferenceDeg: smallestAzimuthDifference,
        edgeLengthM: edgeLength,
        alongFacadeM,
        arrowDirection: [outwardX, outwardY],
        corners: [
            [leftX, leftY, bottom],
            [rightX, rightY, bottom],
            [rightX, rightY, bottom + height],
            [leftX, leftY, bottom + height],
        ],
    };
}

export function schematicWindowOnFacade(
    footprint: Point[], buildingHeight: number, azimuthDeg = DEFAULT_WINDOW_AZIMUTH_DEG
): CenteredWindow | null
{
    const height = Math.min(DEFAULT_WINDOW_HEIGHT_M, buildingHeight);
    return centeredWindowOnFacade(footprint, buildingHeight, azimuthDeg, (buildingHeight - height) / 2);
}

//Resolve every typed definition through the same facade/placement path. Geometry failures stay associated with
//their ID for diagnostics; overlap invalidates both windows rather than letting paint order hide one.
export function resolveWindowGeometries(
    entries: readonly WindowDefinitionEntry[], footprint: Point[], buildingHeight: number, sillHeightM: number
): ResolvedWindowGeometry[]
{
    const resolved = entries.map((entry): ResolvedWindowGeometry =>
    {
        const errors = [...entry.errors];
        const warnings: string[] = [];
        const definition = entry.definition;
        if (!definition)
        {
            return { ...entry, errors, geometry: null, displayGeometry: null, arrowDirection: null, warnings };
        }
        const geometry = centeredWindowOnFacade(
            footprint,
            buildingHeight,
            definition.azimuthDeg,
            sillHeightM,
            definition.lengthM,
            definition.widthM,
            definition.alongFacadeM
        );
        if (!geometry)
        {
            errors.push('window does not fit on a usable exterior facade');
        }
        else if (geometry.azimuthDifferenceDeg > FACADE_WARNING_DEG)
        {
            warnings.push(`requested azimuth differs from facade by ${Math.round(geometry.azimuthDifferenceDeg)} degrees`);
        }
        const displayGeometry = geometry
            ? centeredWindowOnFacade(
                footprint,
                buildingHeight,
                definition.azimuthDeg,
                (buildingHeight - definition.widthM) / 2,
                definition.lengthM,
                definition.widthM,
                definition.alongFacadeM
            )
            : null;
        const requestedAzimuth = definition.azimuthDeg * DEG;
        const arrowDirection = geometry
            ? definition.azimuthMode === 'requested'
                ? [Math.sin(requestedAzimuth), Math.cos(requestedAzimuth)] as Point
                : geometry.arrowDirection
            : null;
        return { ...entry, errors, geometry, displayGeometry, arrowDirection, warnings };
    });

    const overlaps = new Map<number, string[]>();
    for (let i = 0; i < resolved.length; i++)
    {
        const first = resolved[i];
        const firstGeometry = first.geometry;
        if (!firstGeometry || !first.definition)
        {
            continue;
        }
        for (let j = i + 1; j < resolved.length; j++)
        {
            const second = resolved[j];
            if (!second.geometry || !second.definition || firstGeometry.edgeIndex !== second.geometry.edgeIndex)
            {
                continue;
            }
            const firstStart = first.definition.alongFacadeM - first.definition.lengthM / 2;
            const firstEnd = first.definition.alongFacadeM + first.definition.lengthM / 2;
            const secondStart = second.definition.alongFacadeM - second.definition.lengthM / 2;
            const secondEnd = second.definition.alongFacadeM + second.definition.lengthM / 2;
            if (Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart) > 1e-6)
            {
                const firstOverlaps = overlaps.get(i) ?? [];
                firstOverlaps.push(second.id);
                overlaps.set(i, firstOverlaps);
                const secondOverlaps = overlaps.get(j) ?? [];
                secondOverlaps.push(first.id);
                overlaps.set(j, secondOverlaps);
            }
        }
    }
    for (const [index, windowIds] of overlaps)
    {
        const entry = resolved[index];
        entry.geometry = null;
        entry.displayGeometry = null;
        entry.errors.push(`overlaps window${windowIds.length === 1 ? '' : 's'} ${windowIds.join(', ')} on the same facade`);
    }
    return resolved;
}

//Canonical time-dependent calculation. Scene rendering and UI read this exact result rather than re-running
//exposure sampling or deriving a second curtain percentage.
export function evaluateWindowGeometries(
    geometries: readonly ResolvedWindowGeometry[],
    occluders: readonly WindowOccluder[],
    sunAzimuthDeg: number,
    sunAltitudeDeg: number,
    horizonAltitudeDeg = 0
): EvaluatedWindowGeometry[]
{
    return geometries.map((entry): EvaluatedWindowGeometry =>
    {
        const { geometry, definition } = entry;
        if (!geometry || !definition)
        {
            return { ...entry, evaluation: null };
        }
        const calculationAzimuthDeg = definition.azimuthMode === 'requested'
            ? definition.azimuthDeg : geometry.azimuthDeg;
        const calculationGeometry = calculationAzimuthDeg === geometry.azimuthDeg
            ? geometry : { ...geometry, azimuthDeg: calculationAzimuthDeg };
        const exposure = evaluateWindowSunExposure(
            calculationGeometry, occluders, sunAzimuthDeg, sunAltitudeDeg, horizonAltitudeDeg
        );
        const curtainClosedFraction = calculateCurtainClosedFraction(
            calculationGeometry, exposure, sunAzimuthDeg, sunAltitudeDeg, definition.curtainMaxDepthM
        );
        return {
            ...entry,
            evaluation: {
                exposure,
                calculationAzimuthDeg,
                curtainClosedFraction,
                openPercent: Math.round((1 - curtainClosedFraction) * 100),
            },
        };
    });
}

export interface WindowEvaluationCacheKey
{
    timeMs:           number;
    geometryRevision: number;
    sunAzimuth:       number;
    sunAltitude:      number;
    horizonAltitude:  number;
}

export class WindowEvaluationCache
{
    private readonly _entries = new Map<number, {
        key: WindowEvaluationCacheKey;
        value: EvaluatedWindowGeometry[];
    }>();
    private readonly _capacity: number;

    constructor(capacity = 256)
    {
        this._capacity = Number.isFinite(capacity) ? Math.max(1, Math.floor(capacity)) : 256;
    }

    public get size(): number
    {
        return this._entries.size;
    }

    public clear(): void
    {
        this._entries.clear();
    }

    public getOrCompute(
        key: WindowEvaluationCacheKey, calculate: () => EvaluatedWindowGeometry[]
    ): EvaluatedWindowGeometry[]
    {
        const cached = this._entries.get(key.timeMs);
        if (cached && cached.key.geometryRevision === key.geometryRevision
            && cached.key.sunAzimuth === key.sunAzimuth && cached.key.sunAltitude === key.sunAltitude
            && cached.key.horizonAltitude === key.horizonAltitude)
        {
            this._entries.delete(key.timeMs);
            this._entries.set(key.timeMs, cached);
            return cached.value;
        }

        this._entries.delete(key.timeMs);
        while (this._entries.size >= this._capacity)
        {
            const oldest = this._entries.keys().next().value;
            if (oldest === undefined)
            {
                break;
            }
            this._entries.delete(oldest);
        }
        const value = calculate();
        this._entries.set(key.timeMs, { key: { ...key }, value });
        return value;
    }
}

const WINDOW_SAMPLE_COLUMNS = 5;
const WINDOW_SAMPLE_ROWS = 3;
const WINDOW_RAY_MAX_M = MAX_DISPLAY_RADIUS_M * 2 + 10;
const FACADE_WARNING_DEG = 30;

export function evaluateWindowSunExposure(
    window: CenteredWindow,
    occluders: readonly WindowOccluder[],
    sunAzimuthDeg: number,
    sunAltitudeDeg: number,
    horizonAltitudeDeg = 0
): WindowSunExposure
{
    const directSun = Number.isFinite(sunAzimuthDeg) && Number.isFinite(sunAltitudeDeg)
        && sunAltitudeDeg > Math.max(0, horizonAltitudeDeg)
        && Math.cos((sunAzimuthDeg - window.azimuthDeg) * DEG) > 0;
    const sunAz = sunAzimuthDeg * DEG;
    const sunAlt = sunAltitudeDeg * DEG;
    const sunDirection: [number, number, number] = [
        Math.cos(sunAlt) * Math.sin(sunAz),
        Math.cos(sunAlt) * Math.cos(sunAz),
        Math.sin(sunAlt),
    ];
    const cells: WindowSunCell[] = [];
    let sunlitCount = 0;

    for (let row = 0; row < WINDOW_SAMPLE_ROWS; row++)
    {
        for (let column = 0; column < WINDOW_SAMPLE_COLUMNS; column++)
        {
            const u0 = column / WINDOW_SAMPLE_COLUMNS;
            const u1 = (column + 1) / WINDOW_SAMPLE_COLUMNS;
            const v0 = row / WINDOW_SAMPLE_ROWS;
            const v1 = (row + 1) / WINDOW_SAMPLE_ROWS;
            const corners = [
                windowPointAt(window, u0, v0),
                windowPointAt(window, u1, v0),
                windowPointAt(window, u1, v1),
                windowPointAt(window, u0, v1),
            ];
            const sample = windowPointAt(window, (u0 + u1) / 2, (v0 + v1) / 2);
            const sunlit = directSun && !sunRayBlocked(sample, sunDirection, occluders);
            if (sunlit)
            {
                sunlitCount++;
            }
            cells.push({ corners, sunlit, u0, u1, v0, v1 });
        }
    }

    const sunlitFraction = sunlitCount / cells.length;
    const state: WindowSunState = !directSun ? 'NO_DIRECT_SUN'
        : sunlitCount === 0 ? 'FULLY_SHADED'
            : sunlitCount === cells.length ? 'SUNLIT'
                : 'PARTIALLY_SHADED';
    return { state, sunlitFraction, cells };
}

export function calculateCurtainClosedFraction(
    window: CenteredWindow,
    exposure: WindowSunExposure,
    sunAzimuthDeg: number,
    sunAltitudeDeg: number,
    maxDepthM: number
): number
{
    if (exposure.state === 'NO_DIRECT_SUN' || exposure.state === 'FULLY_SHADED'
        || exposure.sunlitFraction <= 0 || !Number.isFinite(sunAzimuthDeg)
        || !Number.isFinite(sunAltitudeDeg) || !Number.isFinite(maxDepthM) || maxDepthM < 0)
    {
        return 0;
    }

    const delta = ((sunAzimuthDeg - window.azimuthDeg + 540) % 360) - 180;
    const cosDelta = Math.cos(delta * DEG);
    const tanAltitude = Math.tan(sunAltitudeDeg * DEG);
    if (cosDelta <= 0 || tanAltitude <= 0)
    {
        return 0;
    }

    const sillHeightM = window.corners[0][2];
    const glassHeightM = window.corners[3][2] - sillHeightM;
    if (glassHeightM <= 0)
    {
        return 0;
    }

    const allowedTopHeightM = maxDepthM * tanAltitude / cosDelta;
    const allowedOpenHeightM = Math.max(0, Math.min(glassHeightM, allowedTopHeightM - sillHeightM));
    return 1 - allowedOpenHeightM / glassHeightM;
}

export function curtainOverlayCorners(window: CenteredWindow, closedFraction: number): [number, number, number][] | null
{
    const coverage = Math.max(0, Math.min(1, closedFraction));
    if (coverage <= 0)
    {
        return null;
    }
    const openFraction = 1 - coverage;
    return [
        windowPointAt(window, 0, openFraction),
        windowPointAt(window, 1, openFraction),
        windowPointAt(window, 1, 1),
        windowPointAt(window, 0, 1),
    ];
}

    export function windowPointAt(window: CenteredWindow, u: number, v: number): [number, number, number]
{
    const bottomLeft = window.corners[0];
    const bottomRight = window.corners[1];
    const topRight = window.corners[2];
    const topLeft = window.corners[3];
    const bottom: [number, number, number] = [
        bottomLeft[0] + (bottomRight[0] - bottomLeft[0]) * u,
        bottomLeft[1] + (bottomRight[1] - bottomLeft[1]) * u,
        bottomLeft[2] + (bottomRight[2] - bottomLeft[2]) * u,
    ];
    const top: [number, number, number] = [
        topLeft[0] + (topRight[0] - topLeft[0]) * u,
        topLeft[1] + (topRight[1] - topLeft[1]) * u,
        topLeft[2] + (topRight[2] - topLeft[2]) * u,
    ];
    return [
        bottom[0] + (top[0] - bottom[0]) * v,
        bottom[1] + (top[1] - bottom[1]) * v,
        bottom[2] + (top[2] - bottom[2]) * v,
    ];
}

function sunRayBlocked(
    origin: [number, number, number],
    direction: [number, number, number],
    occluders: readonly WindowOccluder[]
): boolean
{
    if (direction[2] <= 0)
    {
        return false;
    }
    const maxDistance = Math.min(WINDOW_RAY_MAX_M, (MAX_DISPLAY_RADIUS_M * 2 + 10));
    for (const building of occluders)
    {
        //Overlapping map footprints can cover a window attached to a different host. Such a polygon contains the
        //ray's source point, so it is not an external blocker for sunlight entering that window.
        if (building.footprint.length < 3 || pointInsideBuilding(origin[0], origin[1], building))
        {
            continue;
        }
        const topDistance = (building.height - origin[2]) / direction[2];
        const endDistance = Math.min(maxDistance, topDistance);
        if (endDistance <= 0)
        {
            continue;
        }
        if (rayCrossesBuilding(origin, direction, building, endDistance))
        {
            return true;
        }
    }
    return false;
}

function rayCrossesBuilding(
    origin: [number, number, number],
    direction: [number, number, number],
    building: WindowOccluder,
    maxDistance: number
): boolean
{
    const horizontalLength = Math.hypot(direction[0], direction[1]);
    if (horizontalLength < 1e-9)
    {
        return pointInsideBuilding(origin[0], origin[1], building);
    }

    const intersections = [0, maxDistance];
    for (let edge = 0; edge < building.footprint.length; edge++)
    {
        const start = building.footprint[edge];
        const end = building.footprint[(edge + 1) % building.footprint.length];
        const edgeX = end[0] - start[0];
        const edgeY = end[1] - start[1];
        const offsetX = start[0] - origin[0];
        const offsetY = start[1] - origin[1];
        const denominator = direction[0] * edgeY - direction[1] * edgeX;
        if (Math.abs(denominator) < 1e-9)
        {
            continue;
        }
        const distance = (offsetX * edgeY - offsetY * edgeX) / denominator;
        const edgeFraction = (offsetX * direction[1] - offsetY * direction[0]) / denominator;
        if (distance > 0 && distance < maxDistance && edgeFraction >= 0 && edgeFraction <= 1)
        {
            intersections.push(distance);
        }
    }

    intersections.sort((a, b) => a - b);
    const unique: number[] = [];
    for (const distance of intersections)
    {
        if (unique.length === 0 || distance - unique[unique.length - 1] > 1e-7)
        {
            unique.push(distance);
        }
    }
    for (let interval = 0; interval + 1 < unique.length; interval++)
    {
        const distance = (unique[interval] + unique[interval + 1]) / 2;
        const east = origin[0] + direction[0] * distance;
        const north = origin[1] + direction[1] * distance;
        const altitude = origin[2] + direction[2] * distance;
        if (altitude >= 0 && altitude <= building.height && pointInsideBuilding(east, north, building))
        {
            return true;
        }
    }
    return false;
}

function pointInsideBuilding(east: number, north: number, building: WindowOccluder): boolean
{
    return pointInPolygon(east, north, building.footprint)
        && !(building.holes ?? []).some((hole) => pointInPolygon(east, north, hole));
}