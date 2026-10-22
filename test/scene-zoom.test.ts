import { describe, it, expect } from 'vitest';
import { sceneZoom, showHorizonCompass } from '../src/core/config/helios-config';
import { SceneCamera } from '../src/scene/projection';
import { layoutHorizonCompass, projectHorizonCompass } from '../src/scene/horizon-compass';
import { METRES_PER_DEGREE } from '../src/core/config/constants';
import { refreshHud, type HudHost, type SunScene } from '../src/hud/hud';

describe('compass HUD refresh', () =>
{
    it('preserves equal scenes but updates compass movement, identity, removal and terrain-only changes', () =>
    {
        let scene: SunScene = {
            arc: [], sun: { x: 0, y: 0, irradiance: 0, altitude: -10, azimuth: 0, nearness: 0 },
            home: { x: 400, y: 300 }, daylight: 0, ridge: [],
            compass: [{ direction: 'N', x: 400, y: 100 }], sunrise: null, sunset: null,
        };
        const host = {
            _engine: {
                isViewportReady: () => true,
                projectHomeLabelLayout: () => null,
                projectSunScene: () => scene,
                projectMoonScene: () => null,
                projectDayCurve: () => null,
                projectArrayScene: () => null,
            },
            _selectedTime: null, _now: new Date(), _sunScene: null,
            _labelLayout: null, _moonScene: null, _dayCurveScene: null, _arrayScene: null,
        } as unknown as HudHost;
        refreshHud(host);
        const first = host._sunScene;
        scene = { ...scene, compass: scene.compass.map(label => ({ ...label })) };
        refreshHud(host);
        expect(host._sunScene).toBe(first);
        scene = { ...scene, compass: [{ direction: 'N', x: 410, y: 100 }] };
        refreshHud(host);
        expect(host._sunScene).toBe(scene);
        scene = { ...scene, compass: [{ direction: 'E', x: 410, y: 100 }] };
        refreshHud(host);
        expect(host._sunScene).toBe(scene);
        scene = { ...scene, compass: [] };
        refreshHud(host);
        expect(host._sunScene).toBe(scene);
        scene = { ...scene, ridge: [{ x: 10, y: 20 }] };
        refreshHud(host);
        expect(host._sunScene).toBe(scene);
        scene = { ...scene, ridge: [{ x: 10, y: 40 }] };
        refreshHud(host);
        expect(host._sunScene).toBe(scene);
    });
});

describe('horizon compass projection', () =>
{
    function project(bearing = 0, altitude = 0)
    {
        const camera = new SceneCamera();
        camera.pxPerMetre = 3;
        camera.setPose(bearing, 0);
        camera.setViewport(800, 600);
        return projectHorizonCompass(0, 0, 1, () => altitude,
            (lon, lat, up) => camera.project3(lon * METRES_PER_DEGREE, lat * METRES_PER_DEGREE, up));
    }

    it('projects geographic north, east, south and west around the home', () =>
    {
        const [north, east, south, west] = project();
        expect([north.direction, east.direction, south.direction, west.direction]).toEqual(['N', 'E', 'S', 'W']);
        expect(north.x).toBeCloseTo(400);
        expect(north.y).toBeLessThan(300);
        expect(east.x).toBeGreaterThan(400);
        expect(south.y).toBeGreaterThan(300);
        expect(west.x).toBeLessThan(400);
        expect(project(90)[0].x).toBeGreaterThan(400);
        expect(project(0, 20)[0].y).not.toBeCloseTo(project()[0].y);
    });

    it('rejects invalid and behind-camera projections', () =>
    {
        expect(projectHorizonCompass(0, 0, 1, () => 0, () => null)).toEqual([]);
        expect(projectHorizonCompass(0, 0, 1, () => 0, () => ({ x: NaN, y: 0, depth: 0 }))).toEqual([]);
        expect(projectHorizonCompass(0, 0, 1, () => 0, () => ({ x: 0, y: 0, depth: Infinity }))).toEqual([]);
    });

    it('keeps the same horizon gap instead of moving letters inward at viewport edges', () =>
    {
        const home = { x: 200, y: 200 };
        const north = layoutHorizonCompass([{ direction: 'N', x: 200, y: 100 }], home, 400, 400);
        expect(north).toEqual([{ direction: 'N', x: 200, y: 86 }]);
        const nearEdge = layoutHorizonCompass([{ direction: 'E', x: 380, y: 200 }], home, 400, 400);
        expect(nearEdge).toEqual([]);
    });

    it('keeps every label at the same fixed distance from its anchor during a full rotation', () =>
    {
        for (let bearing = 0; bearing < 360; bearing += 15)
        {
            const labels = project(bearing);
            const placed = layoutHorizonCompass(labels, { x: 400, y: 300 }, 800, 600);
            expect(placed).toHaveLength(4);
            for (const [index, label] of placed.entries())
            {
                const anchor = labels[index];
                expect(label.direction).toBe(anchor.direction);
                expect(Math.hypot(label.x - anchor.x, label.y - anchor.y)).toBeCloseTo(14);
                expect(Math.hypot(label.x - 400, label.y - 300)).toBeCloseTo(
                    Math.hypot(anchor.x - 400, anchor.y - 300) + 14);
            }
        }
    });

    it('does not reposition nearby letters to avoid each other', () =>
    {
        const labels = project();
        const placed = layoutHorizonCompass(labels, { x: 400, y: 300 }, 800, 600);
        expect(placed).toHaveLength(4);
        expect(placed[0].y).toBeLessThan(labels[0].y);
        const nearby = layoutHorizonCompass([
            { direction: 'N', x: 400, y: 200 },
            { direction: 'E', x: 402, y: 200 },
        ], { x: 400, y: 300 }, 800, 600);
        expect(nearby.map(label => label.direction)).toEqual(['N', 'E']);
        expect(nearby[0].y).toBe(186);
        expect(nearby[1].y).toBeCloseTo(186, 1);
        expect(layoutHorizonCompass(labels, { x: 400, y: 300 }, 20, 20)).toEqual([]);
    });
});

describe('showHorizonCompass', () =>
{
    it('enables compass letters only for an explicit boolean true', () =>
    {
        expect(showHorizonCompass(undefined)).toBe(false);
        expect(showHorizonCompass({})).toBe(false);
        expect(showHorizonCompass({ 'show-horizon-compass': false })).toBe(false);
        expect(showHorizonCompass({ 'show-horizon-compass': 'true' })).toBe(false);
        expect(showHorizonCompass({ 'show-horizon-compass': true, 'show-horizon-line': false })).toBe(true);
    });
});

describe('sceneZoom', () =>
{
    it('defaults to 1 with no config, an unknown value, or a bad type', () =>
    {
        expect(sceneZoom(undefined)).toBe(1);
        expect(sceneZoom({} as any)).toBe(1);
        expect(sceneZoom({ 'scene-zoom': 3 } as any)).toBe(1);
        expect(sceneZoom({ 'scene-zoom': 'big' } as any)).toBe(1);
        expect(sceneZoom({ 'scene-zoom': null } as any)).toBe(1);
    });

    it('accepts the five levels as numbers or as the editor\'s strings', () =>
    {
        expect(sceneZoom({ 'scene-zoom': 0.5 } as any)).toBe(0.5);
        expect(sceneZoom({ 'scene-zoom': 0.75 } as any)).toBe(0.75);
        expect(sceneZoom({ 'scene-zoom': 1.5 } as any)).toBe(1.5);
        expect(sceneZoom({ 'scene-zoom': 2 } as any)).toBe(2);
        expect(sceneZoom({ 'scene-zoom': '0.5' } as any)).toBe(0.5);
        expect(sceneZoom({ 'scene-zoom': '0.75' } as any)).toBe(0.75);
        expect(sceneZoom({ 'scene-zoom': '1.5' } as any)).toBe(1.5);
        expect(sceneZoom({ 'scene-zoom': '2' } as any)).toBe(2);
        expect(sceneZoom({ 'scene-zoom': '1' } as any)).toBe(1);
    });
});

describe('SceneCamera under a zoom', () =>
{
    function cam(zoom: number): SceneCamera
    {
        const c = new SceneCamera();
        c.pxPerMetre = 2 * zoom;
        c.zoom = zoom;
        c.setPose(0, 0);
        c.setViewport(800, 600);
        return c;
    }

    it('projects ground offsets proportionally to the zoomed px-per-metre', () =>
    {
        const a = cam(1).project3(10, 0, 0);
        const b = cam(2).project3(10, 0, 0);
        expect(b.x - 400).toBeCloseTo(2 * (a.x - 400), 6);
    });

    it('leaves the default ground transform string untouched at zoom 1', () =>
    {
        const t = cam(1).groundTransform(100, 100).transform;
        expect(t).not.toContain('scale(');
    });

    it('appends the matching scale() innermost at zoom 1.5 / 2', () =>
    {
        expect(cam(1.5).groundTransform(100, 100).transform.endsWith(' scale(1.5)')).toBe(true);
        expect(cam(2).groundTransform(100, 100).transform.endsWith(' scale(2)')).toBe(true);
    });
});
