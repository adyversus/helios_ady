import { describe, expect, it } from 'vitest';
import { curtainMaxDepthM, windowSillHeight } from '../src/core/config/helios-config';
import {
    centeredWindowOnFacade,
    schematicWindowOnFacade,
    calculateCurtainClosedFraction,
    curtainOverlayCorners,
    evaluateWindowSunExposure,
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
        expect(centeredWindowOnFacade([[0, 0], [4, 0], [4, 4], [0, 4]], 3, 225)).toBeNull();
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
});

describe('calculateCurtainClosedFraction', () =>
{
    it('matches the 61.5% closed calculation example', () =>
    {
        const window = {
            edgeIndex: 0,
            azimuthDeg: 270,
            corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1.5], [0, 0, 1.5]] as [number, number, number][],
        };
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
            corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1.5], [0, 0, 1.5]] as [number, number, number][],
        };
        const overlay = curtainOverlayCorners(window, 0.6153);

        expect(overlay).not.toBeNull();
        expect(overlay?.[0][2]).toBeCloseTo(0.577, 2);
        expect(overlay?.[2][2]).toBeCloseTo(1.5);
        expect(curtainOverlayCorners(window, 0)).toBeNull();
    });
});