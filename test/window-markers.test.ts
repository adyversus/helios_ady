import { describe, expect, it } from 'vitest';
import { curtainMaxDepthM, windowAzimuthArrowEnabled, resolveWindowDefinitions, windowSillHeight } from '../src/core/config/helios-config';
import {
    centeredWindowOnFacade,
    resolveWindowGeometries,
    evaluateWindowGeometries,
    schematicWindowOnFacade,
    calculateCurtainClosedFraction,
    curtainOverlayCorners,
    evaluateWindowSunExposure,
    WindowEvaluationCache,
    type CenteredWindow,
    DEFAULT_WINDOW_AZIMUTH_DEG,
} from '../src/scene/window-markers';

describe('centeredWindowOnFacade', () =>
{
    it('centers a bounded window on the facade nearest the default azimuth and offsets it outward', () =>
    {
        const window = centeredWindowOnFacade([
            [-4, -4], [4, -4], [4, 4], [-4, 4],
        ], 6);

        expect(window).not.toBeNull();
        expect(DEFAULT_WINDOW_AZIMUTH_DEG).toBe(272);
        expect(window?.edgeIndex).toBe(3);
        expect(window?.corners[0][0]).toBeCloseTo(-4.025);
        expect(window?.corners[1][0]).toBeCloseTo(-4.025);
        expect(window?.corners[0][1]).toBeCloseTo(0.6);
        expect(window?.corners[1][1]).toBeCloseTo(-0.6);
        expect(window?.corners[0][2]).toBeCloseTo(0);
        expect(window?.corners[2][2]).toBeCloseTo(0.9);
    });

    it('centers the schematic marker independently of the physical sill height', () =>
    {
        const physicalWindow = centeredWindowOnFacade([
            [-4, -4], [4, -4], [4, 4], [-4, 4],
        ], 6, DEFAULT_WINDOW_AZIMUTH_DEG, 1.2);
        const schematicWindow = schematicWindowOnFacade([
            [-4, -4], [4, -4], [4, 4], [-4, 4],
        ], 6);

        expect(physicalWindow?.corners[0][2]).toBeCloseTo(1.2);
        expect(schematicWindow?.corners[0][2]).toBeCloseTo(2.55);
        expect(schematicWindow?.corners[2][2]).toBeCloseTo(3.45);
        expect(schematicWindow?.edgeIndex).toBe(physicalWindow?.edgeIndex);
    });

    it('keeps glass height independent from the configured sill height', () =>
    {
        const window = centeredWindowOnFacade([
            [-4, -4], [4, -4], [4, 4], [-4, 4],
        ], 6, DEFAULT_WINDOW_AZIMUTH_DEG, 1.2);

        expect(window?.corners[0][2]).toBeCloseTo(1.2);
        expect(window?.corners[2][2]).toBeCloseTo(2.1);
        expect(centeredWindowOnFacade([
            [-4, -4], [4, -4], [4, 4], [-4, 4],
        ], 6, DEFAULT_WINDOW_AZIMUTH_DEG, 5.2)).toBeNull();
    });

    it('clamps dimensions to short walls and low buildings', () =>
    {
        const window = centeredWindowOnFacade([
            [0, 0], [1, 0], [1, 1], [0, 1],
        ], 1.2);

        expect(window).not.toBeNull();
        expect(Math.hypot(
            window!.corners[1][0] - window!.corners[0][0],
            window!.corners[1][1] - window!.corners[0][1]
        )).toBeCloseTo(0.6);
        expect(window!.corners[2][2] - window!.corners[1][2]).toBeCloseTo(0.9);
    });

    it('rejects degenerate footprints and invalid building heights', () =>
    {
        expect(centeredWindowOnFacade([[0, 0], [1, 0]], 3)).toBeNull();
        expect(centeredWindowOnFacade([[0, 0], [1, 0], [0, 1]], 0)).toBeNull();
        expect(centeredWindowOnFacade([[0, 0], [1, 0], [0, 1]], Number.NaN)).toBeNull();
        const nearest = centeredWindowOnFacade([[0, 0], [4, 0], [4, 4], [0, 4]], 3, 225);
        expect(nearest?.azimuthDeg).toBe(180);
        expect(nearest?.azimuthDifferenceDeg).toBe(45);
    });
});

describe('windowSillHeight config', () =>
{
    it('defaults to zero and clamps numeric config to 0-50 metres', () =>
    {
        expect(windowSillHeight(undefined)).toBe(0);
        expect(windowSillHeight({ 'window-sill-height': 1.2 })).toBe(1.2);
        expect(windowSillHeight({ 'window-sill-height': 0 })).toBe(0);
        expect(windowSillHeight({ 'window-sill-height': -1 })).toBe(0);
        expect(windowSillHeight({ 'window-sill-height': 60 })).toBe(50);
        expect(windowSillHeight({ 'window-sill-height': 'not a number' })).toBe(0);
    });
});

describe('curtainMaxDepthM config', () =>
{
    it('defaults to one metre and clamps numeric config to 0-50 metres', () =>
    {
        expect(curtainMaxDepthM(undefined)).toBe(1);
        expect(curtainMaxDepthM({ 'curtain-max-depth': 2.5 })).toBe(2.5);
        expect(curtainMaxDepthM({ 'curtain-max-depth': -1 })).toBe(0);
        expect(curtainMaxDepthM({ 'curtain-max-depth': 60 })).toBe(50);
        expect(curtainMaxDepthM({ 'curtain-max-depth': 'invalid' })).toBe(1);
    });
});

describe('windowDefinitions config', () =>
{
    it('adapts legacy config, preserves an explicit empty list, and reports invalid entries', () =>
    {
        const [legacy] = resolveWindowDefinitions(undefined);
        expect(legacy.definition).toMatchObject({
            id: 'legacy-window',
            building: 'home',
            azimuthDeg: DEFAULT_WINDOW_AZIMUTH_DEG,
            lengthM: 1.2,
            widthM: 0.9,
            alongFacadeM: 0,
            curtainMaxDepthM: 1,
        });
        expect(resolveWindowDefinitions({ windows: [] })).toEqual([]);

        const entries = resolveWindowDefinitions({
            windows: [
                { id: 'south', label: 'LR', building: 'home', azimuth: 540, length: 1.5 },
                { id: 'bad', building: 'home', azimuth: 'south', length: -1 },
            ],
        });
        expect(entries[0].definition).toMatchObject({ id: 'south', label: 'LR', azimuthDeg: 180, lengthM: 1.5 });
        expect(entries[0].errors).toEqual([]);
        expect(entries[1].definition).toBeNull();
        expect(entries[1].errors.length).toBeGreaterThan(0);

        const tooMany = resolveWindowDefinitions({
            windows: Array.from({ length: 1000 }, (_, index) => ({
                id: `window-${index + 1}`, building: 'home', azimuth: 180,
            })),
        });
        expect(tooMany).toHaveLength(17);
        expect(tooMany[15].definition).not.toBeNull();
        expect(tooMany[16].definition).toBeNull();
        expect(tooMany[16].label).toBe('984 extra windows');
        expect(tooMany[16].errors.join(' ')).toContain('supported limit of 16');
    });
});

describe('resolveWindowGeometries', () =>
{
    const footprint: [number, number][] = [[-4, -4], [4, -4], [4, 4], [-4, 4]];

    it('resolves opposite facades independently at the shared sill height', () =>
    {
        const entries = resolveWindowDefinitions({
            windows: [
                { id: 'south', building: 'home', azimuth: 180 },
                { id: 'north', building: 'home', azimuth: 0 },
            ],
        });
        const resolved = resolveWindowGeometries(entries, footprint, 6, 0.8);

        expect(resolved.map((entry) => entry.geometry?.edgeIndex)).toEqual([0, 2]);
        expect(resolved.every((entry) => entry.errors.length === 0)).toBe(true);
        expect(resolved.map((entry) => entry.geometry?.corners[0][2])).toEqual([0.8, 0.8]);
    });

    it('keeps the displayed pane vertically centered independently of the physical sill', () =>
    {
        const entries = resolveWindowDefinitions({
            windows: [{ id: 'living-room', building: 'home', azimuth: 180, width: 0.9 }],
        });
        const [resolved] = resolveWindowGeometries(entries, footprint, 6, 1.2);

        expect(resolved.geometry?.corners[0][2]).toBeCloseTo(1.2);
        expect(resolved.displayGeometry?.corners[0][2]).toBeCloseTo(2.55);
        expect(resolved.displayGeometry?.corners[2][2]).toBeCloseTo(3.45);
    });

    it('allows touching windows and gaps but rejects actual overlap on one facade', () =>
    {
        const makeEntries = (left: number, right: number) => resolveWindowDefinitions({
            windows: [
                { id: 'left', building: 'home', azimuth: 180, length: 1.2, 'along-facade': left },
                { id: 'right', building: 'home', azimuth: 180, length: 1.2, 'along-facade': right },
            ],
        });
        const touching = resolveWindowGeometries(makeEntries(-0.6, 0.6), footprint, 6, 0.8);
        const gap = resolveWindowGeometries(makeEntries(-1, 1), footprint, 6, 0.8);
        const overlap = resolveWindowGeometries(makeEntries(0, 0.5), footprint, 6, 0.8);

        expect(touching.every((entry) => entry.geometry && entry.errors.length === 0)).toBe(true);
        expect(gap.every((entry) => entry.geometry && entry.errors.length === 0)).toBe(true);
        expect(overlap.every((entry) => entry.geometry === null && entry.errors.length > 0)).toBe(true);
    });

    it('invalidates every window in a chained overlap', () =>
    {
        const entries = resolveWindowDefinitions({
            windows: [
                { id: 'left', building: 'home', azimuth: 180, length: 1.2, 'along-facade': 0 },
                { id: 'middle', building: 'home', azimuth: 180, length: 1.2, 'along-facade': 0.8 },
                { id: 'right', building: 'home', azimuth: 180, length: 1.2, 'along-facade': 1.6 },
            ],
        });
        const resolved = resolveWindowGeometries(entries, footprint, 6, 0.8);

        expect(resolved.map((entry) => entry.geometry)).toEqual([null, null, null]);
        expect(resolved[0].errors.join(' ')).toContain('middle');
        expect(resolved[1].errors.join(' ')).toContain('left');
        expect(resolved[1].errors.join(' ')).toContain('right');
        expect(resolved[2].errors.join(' ')).toContain('middle');
    });
});

describe('evaluateWindowGeometries', () =>
{
    it('returns independent exposure and curtain telemetry for opposite-facing windows', () =>
    {
        const entries = resolveWindowDefinitions({
            windows: [
                { id: 'south', building: 'home', azimuth: 180 },
                { id: 'north', building: 'home', azimuth: 0 },
            ],
        });
        const geometry = resolveWindowGeometries(
            entries, [[-4, -4], [4, -4], [4, 4], [-4, 4]], 6, 0.8
        );
        const evaluated = evaluateWindowGeometries(geometry, [], 180, 40, 0);

        expect(evaluated.map((entry) => entry.evaluation?.exposure?.state)).toEqual(['SUNLIT', 'NO_DIRECT_SUN']);
        expect(evaluated[0].evaluation?.openPercent).toBeLessThan(100);
        expect(evaluated[1].evaluation?.openPercent).toBe(100);
    });
});

describe('WindowEvaluationCache', () =>
{
    it('reuses matching evaluations, invalidates changed sun inputs, and stays bounded', () =>
    {
        const cache = new WindowEvaluationCache(2);
        let calculations = 0;
        const calculate = () =>
        {
            calculations++;
            return [];
        };
        const key = {
            timeMs: 1,
            geometryRevision: 1,
            sunAzimuth: 180,
            sunAltitude: 40,
            horizonAltitude: 0,
        };

        const first = cache.getOrCompute(key, calculate);
        expect(cache.getOrCompute(key, calculate)).toBe(first);
        expect(calculations).toBe(1);
        cache.getOrCompute({ ...key, sunAltitude: 39 }, calculate);
        cache.getOrCompute({ ...key, timeMs: 2 }, calculate);

        expect(calculations).toBe(3);
        expect(cache.size).toBe(2);
    });
});

describe('evaluateWindowSunExposure', () =>
{
    const window = centeredWindowOnFacade([
        [-4, -4], [4, -4], [4, 4], [-4, 4],
    ], 6, DEFAULT_WINDOW_AZIMUTH_DEG, 1.2)!;

    it('distinguishes direct sun from sun-away and horizon states', () =>
    {
        const sunlit = evaluateWindowSunExposure(window, [], 270, 40);
        expect(sunlit.state).toBe('SUNLIT');
        expect(sunlit.sunlitFraction).toBe(1);

        expect(evaluateWindowSunExposure(window, [], 90, 40).state).toBe('NO_DIRECT_SUN');
        expect(evaluateWindowSunExposure(window, [], 270, 40, 45).state).toBe('NO_DIRECT_SUN');
    });

    it('distinguishes partial and full building obstruction', () =>
    {
        const fullBlocker = {
            footprint: [[-10, -3], [-7, -3], [-7, 3], [-10, 3]] as [number, number][],
            height: 6,
        };
        const partialBlocker = {
            footprint: [[-10, 0], [-7, 0], [-7, 3], [-10, 3]] as [number, number][],
            height: 6,
        };

        const fullyShaded = evaluateWindowSunExposure(window, [fullBlocker], 270, 40);
        expect(fullyShaded.state).toBe('FULLY_SHADED');
        expect(fullyShaded.sunlitFraction).toBe(0);

        const partiallyShaded = evaluateWindowSunExposure(window, [partialBlocker], 270, 40);
        expect(partiallyShaded.state).toBe('PARTIALLY_SHADED');
        expect(partiallyShaded.sunlitFraction).toBeGreaterThan(0);
        expect(partiallyShaded.sunlitFraction).toBeLessThan(1);
    });

    it('ignores an overlapping footprint that contains the window sample origin', () =>
    {
        const overlappingBuilding = {
            footprint: [[-6, -6], [6, -6], [6, 6], [-6, 6]] as [number, number][],
            height: 6,
        };

        const exposure = evaluateWindowSunExposure(window, [overlappingBuilding], 270, 40);

        expect(exposure.state).toBe('SUNLIT');
        expect(exposure.sunlitFraction).toBe(1);
    });
});

describe('calculateCurtainClosedFraction', () =>
{
    it('matches the 61.5% closed calculation example', () =>
    {
        const window = {
            edgeIndex: 0,
            azimuthDeg: 270,
            configuredAzimuthDeg: 270,
            azimuthDifferenceDeg: 0,
            edgeLengthM: 1,
            alongFacadeM: 0,
            arrowDirection: [1, 0] as [number, number],
            corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1.5], [0, 0, 1.5]] as [number, number, number][],
        } satisfies CenteredWindow;
        const exposure = {
            state: 'SUNLIT' as const,
            sunlitFraction: 1,
            cells: [],
        };

        expect(calculateCurtainClosedFraction(window, exposure, 270, 30, 1)).toBeCloseTo(0.6153, 3);
    });

    it('includes sill height and leaves the curtain open when no direct sun reaches the glass', () =>
    {
        const window = centeredWindowOnFacade([
            [-4, -4], [4, -4], [4, 4], [-4, 4],
        ], 6, DEFAULT_WINDOW_AZIMUTH_DEG, 1.2)!;
        const sunlit = { state: 'SUNLIT' as const, sunlitFraction: 1, cells: [] };
        const noSun = { state: 'NO_DIRECT_SUN' as const, sunlitFraction: 0, cells: [] };

        expect(calculateCurtainClosedFraction(window, sunlit, 272, 30, 1)).toBe(1);
        expect(calculateCurtainClosedFraction(window, noSun, 272, 30, 1)).toBe(0);
    });
});

describe('curtainOverlayCorners', () =>
{
    it('covers the simulated fraction from the top of the window down', () =>
    {
        const window = {
            edgeIndex: 0,
            azimuthDeg: 270,
            configuredAzimuthDeg: 270,
            azimuthDifferenceDeg: 0,
            edgeLengthM: 1,
            alongFacadeM: 0,
            arrowDirection: [1, 0] as [number, number],
            corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1.5], [0, 0, 1.5]] as [number, number, number][],
        } satisfies CenteredWindow;
        const overlay = curtainOverlayCorners(window, 0.6153);

        expect(overlay).not.toBeNull();
        expect(overlay?.[0][2]).toBeCloseTo(0.577, 2);
        expect(overlay?.[2][2]).toBeCloseTo(1.5);
        expect(curtainOverlayCorners(window, 0)).toBeNull();
    });
});

describe('windowAzimuthArrowEnabled config', () =>
{
    it('is disabled unless explicitly enabled', () =>
    {
        expect(windowAzimuthArrowEnabled(undefined)).toBe(false);
        expect(windowAzimuthArrowEnabled({ 'window-azimuth-arrow': false })).toBe(false);
        expect(windowAzimuthArrowEnabled({ 'window-azimuth-arrow': true })).toBe(true);
    });
});