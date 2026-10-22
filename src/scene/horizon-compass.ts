import { horizonSpherePoint } from './sun-arc';
import { PERSPECTIVE, NEAR_PLANE } from './projection';

export interface HorizonCompassLabel
{
    direction: 'N' | 'E' | 'S' | 'W';
    x: number;
    y: number;
}

export function projectHorizonCompass(
    homeLat: number,
    homeLon: number,
    scale: number,
    altitudeAt: (azimuth: number) => number,
    project: (lon: number, lat: number, altitudeM: number) => { x: number; y: number; depth: number } | null,
): HorizonCompassLabel[]
{
    const directions = ['N', 'E', 'S', 'W'] as const;
    const labels: HorizonCompassLabel[] = [];
    for (const [index, direction] of directions.entries())
    {
        const point = horizonSpherePoint(homeLat, homeLon, scale, index * 90, altitudeAt(index * 90));
        const screen = project(point.lon, point.lat, point.altitudeM);
        if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)
            && Number.isFinite(screen.depth) && screen.depth < PERSPECTIVE * (1 - NEAR_PLANE))
        {
            labels.push({ direction, x: screen.x, y: screen.y });
        }
    }
    return labels;
}

export function layoutHorizonCompass(
    labels: readonly HorizonCompassLabel[],
    home: { x: number; y: number },
    width: number,
    height: number,
): HorizonCompassLabel[]
{
    const placed: HorizonCompassLabel[] = [];
    for (const label of labels)
    {
        const dx = label.x - home.x;
        const dy = label.y - home.y;
        const distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance) || distance < 1)
        {
            continue;
        }
        const x = label.x + dx / distance * 14;
        const y = label.y + dy / distance * 14;
        if (x - 10 < 4 || y - 11 < 4 || x + 10 > width - 4 || y + 11 > height - 4)
        {
            continue;
        }
        placed.push({ direction: label.direction, x, y });
    }
    return placed;
}