import { describe, it, expect } from 'vitest';
import {
    renderBuildings,
    renderShadows,
    shapesSvg,
    shadowLayerSvg,
    type Building,
    type ScenePalette,
    type HomeAppearance,
} from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';
import { resolveWindowDefinitions } from '../src/core/config/helios-config';
import { evaluateWindowGeometries, resolveWindowGeometries } from '../src/scene/window-markers';

function evaluatedWindows(
    building: Building,
    sunAzimuth: number,
    sunAltitude: number,
    sillHeightM = 0,
    curtainMaxDepthM = 1,
    specs?: unknown[]
)
{
    const definitions = resolveWindowDefinitions({
        'curtain-max-depth': curtainMaxDepthM,
        ...(specs === undefined ? {} : { windows: specs }),
    });
    const geometry = resolveWindowGeometries(definitions, building.footprint, building.height, sillHeightM);
    return evaluateWindowGeometries(
        geometry,
        [{ footprint: building.footprint, holes: building.holes, height: building.height }],
        sunAzimuth,
        sunAltitude
    );
}

//Characterization snapshot: pins the exact SVG output of the buildings + shadows painters for a fixed scene, so the
//painters' output reaching the DOM as persistent nodes (scene-dom.ts) provably changed not a single path.
//Deterministic: the painters are pure projection, no randomness.
function scene(): {
    cam: SceneCamera;
    buildings: Building[];
    palette: ScenePalette;
    home: HomeAppearance;
    sun: { azimuth: number; altitude: number };
}
{
    const cam = new SceneCamera();
    cam.setPose(35, 62);
    cam.setViewport(640, 420);
    const buildings: Building[] = [
        { footprint: [[-4, -4], [4, -4], [4, 4], [-4, 4]] as [number, number][], height: 6, isHome: true,  centerX: 0,   centerY: 0 },
        { footprint: [[10, 8], [18, 8], [18, 16], [10, 16]] as [number, number][], height: 8, isHome: false, centerX: 14,  centerY: 12 },
        { footprint: [[-22, 4], [-12, 4], [-12, 14], [-22, 14]] as [number, number][], height: 5, isHome: false, centerX: -17, centerY: 9 },
    ];
    const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
    const home: HomeAppearance = { color: '#e0a020', growth: 1 };
    const sun = { azimuth: 135, altitude: 40 };
    return { cam, buildings, palette, home, sun };
}

describe('buildings / shadows render (characterization)', () =>
{
    it('renders the default-azimuth window on the synthetic home facade when that side is visible', () =>
    {
        const footprint: [number, number][] = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
        const building: Building = {
            footprint,
            height: 6,
            isHome: true,
            centerX: 0,
            centerY: 0,
            placeholder: true,
        };
        const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
        const windows = evaluatedWindows(building, 180, 40);
        let windowRendered = false;

        for (const bearing of [0, 90, 180, 270])
        {
            const cam = new SceneCamera();
            cam.setPose(bearing, 45);
            cam.setViewport(640, 420);
            const shapes = renderBuildings(cam, [building], 40, palette, 1, 0.25, {}, 180, windows);
            if (shapes.some((shape) => shape.strokeWidth === '1.2'))
            {
                windowRendered = true;
                break;
            }
        }

        expect(windowRendered).toBe(true);
    });

    it('draws the simulated curtain when direct sun exceeds the configured floor depth', () =>
    {
        const building: Building = {
            footprint: [[-4, -4], [4, -4], [4, 4], [-4, 4]],
            height: 6,
            isHome: true,
            centerX: 0,
            centerY: 0,
            placeholder: true,
        };
        const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
        const windows = evaluatedWindows(building, 270, 40, 1.2, 1, [
            { id: 'window', building: 'home', azimuth: 270, length: 1.2, width: 0.9, 'curtain-max-depth': 1 },
        ]);
        let curtainRendered = false;

        for (const bearing of [0, 90, 180, 270])
        {
            const cam = new SceneCamera();
            cam.setPose(bearing, 45);
            cam.setViewport(640, 420);
            const shapes = renderBuildings(cam, [building], 40, palette, 1, 0.25, {}, 270, windows);
            if (shapes.some((shape) => shape.fill === 'rgba(255, 255, 255, 0.96)'))
            {
                curtainRendered = true;
                break;
            }
        }

        expect(curtainRendered).toBe(true);
    });

    it('renders independently evaluated windows on opposite home facades through the shared renderer', () =>
    {
        const building: Building = {
            footprint: [[-4, -4], [4, -4], [4, 4], [-4, 4]],
            height: 6,
            isHome: true,
            centerX: 0,
            centerY: 0,
        };
        const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
        const windows = evaluatedWindows(building, 180, 40, 0.8, 1, [
            { id: 'south', label: 'S', building: 'home', azimuth: 180 },
            { id: 'north', label: 'N', building: 'home', azimuth: 0 },
        ]);
        let sunlitFacadeSeen = false;
        let shadedFacadeSeen = false;
        let arrowSeen = false;
        let selectedPerimeterSeen = false;

        for (const bearing of [0, 90, 180, 270])
        {
            const cam = new SceneCamera();
            cam.setPose(bearing, 45);
            cam.setViewport(640, 420);
            const shapes = renderBuildings(cam, [building], 40, palette, 1, 0.25, {}, 180, windows, true, 'south');
            sunlitFacadeSeen ||= shapes.some((shape) => shape.fill === 'rgba(255, 198, 92, 0.96)');
            shadedFacadeSeen ||= shapes.some((shape) => shape.fill === 'rgba(111, 128, 138, 0.88)');
            arrowSeen ||= shapes.some((shape) => shape.stroke === '#ffb84d');
            selectedPerimeterSeen ||= shapes.some((shape) => shape.stroke === '#ffeb3b' && shape.strokeWidth === '2.8');
        }

        expect(sunlitFacadeSeen).toBe(true);
        expect(shadedFacadeSeen).toBe(true);
        expect(arrowSeen).toBe(true);
        expect(selectedPerimeterSeen).toBe(true);
    });

    it('draws an outward azimuth arrow only when enabled', () =>
    {
        const building: Building = {
            footprint: [[-4, -4], [4, -4], [4, 4], [-4, 4]],
            height: 6,
            isHome: true,
            centerX: 0,
            centerY: 0,
            placeholder: true,
        };
        const cam = new SceneCamera();
        cam.setPose(270, 45);
        cam.setViewport(640, 420);
        const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
        const windows = evaluatedWindows(building, 180, 40);
        const defaultShapes = renderBuildings(cam, [building], 40, palette, 1);
        const arrowShapes = renderBuildings(cam, [building], 40, palette, 1, 0.25, {}, 180, windows, true);
        const arrow = arrowShapes.find((shape) => shape.stroke === '#ffb84d');
        const shaft = arrow?.geom.match(/^M(-?[\d.]+),(-?[\d.]+)L(-?[\d.]+),(-?[\d.]+)/);

        expect(defaultShapes.some((shape) => shape.stroke === '#ffb84d')).toBe(false);
        expect(arrow).toBeDefined();
        expect(shaft).not.toBeNull();
        expect(Math.hypot(Number(shaft?.[3]) - Number(shaft?.[1]), Number(shaft?.[4]) - Number(shaft?.[2]))).toBeGreaterThanOrEqual(25);
    });

    it('renderBuildings output is stable for a fixed scene', () =>
    {
        const { cam, buildings, palette, home, sun } = scene();
        const windows = evaluatedWindows(buildings[0], sun.azimuth, sun.altitude);
        expect(shapesSvg(renderBuildings(cam, buildings, sun.altitude, palette, 1, 0.25, home, sun.azimuth, windows))).toMatchSnapshot();
    });

    it('renderShadows output is stable for a fixed scene', () =>
    {
        const { cam, buildings, sun } = scene();
        expect(shadowLayerSvg(renderShadows(cam, buildings, sun, '#101014', 0.35))).toMatchSnapshot();
    });

    it('a neighbour nearer the camera than the home paints on top of it (#413)', () =>
    {
        const cam = new SceneCamera();
        cam.setPose(35, 62);
        cam.setViewport(640, 420);
        const homeFootprint: [number, number][] = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
        //Nearer than every home corner (checked against cam.project3: home's own nearest corner sits at
        //depth 4.92, this footprint's nearest corner at 9.84), and overlapping the home in screen space, so
        //an un-depth-sorted renderer (paint neighbours as one block, then the home on top regardless) would
        //visibly fail this the same way #413 reported it.
        const nearNeighbor: [number, number][] = [[4, -8], [8, -8], [8, -4], [4, -4]];
        const buildings: Building[] = [
            { footprint: homeFootprint, height: 6, isHome: true,  centerX: 0, centerY: 0 },
            { footprint: nearNeighbor,  height: 4, isHome: false, centerX: 6, centerY: -6 },
        ];
        const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
        const home: HomeAppearance = { color: '#e0a020', growth: 1 };
        const svg = shapesSvg(renderBuildings(cam, buildings, 40, palette, 1, 0.25, home, 135));

        //Home's fill is the palette gold (#e0a020 -> rgb 224,160,32); the neighbour's is the palette grey
        //(#8a8f98 -> rgb 138,143,152, this scene's wall shade before the ambient/lit mix darkens it further,
        //so match on the shared rgb prefix the walls and roof both carry: "120,124,133" is the wall tone,
        //present on every neighbour face regardless of which wall). Every neighbour face must land AFTER
        //every home face once the nearer building is free to interleave.
        const lastHome = svg.lastIndexOf('rgba(190,135,27');
        const firstNeighbor = svg.indexOf('rgba(120,124,133');
        expect(lastHome).toBeGreaterThan(-1);
        expect(firstNeighbor).toBeGreaterThan(-1);
        expect(firstNeighbor).toBeGreaterThan(lastHome);
    });
});
