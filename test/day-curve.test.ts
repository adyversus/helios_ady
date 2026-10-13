import { describe, expect, it } from 'vitest';
import { splineSpan } from '../src/scene/day-curve';

describe('bounded day-curve spans', () =>
{
    it('prevents a bounded strand spline from overshooting below its endpoint range', () =>
    {
        const points: [number, number][] = [[0, 0], [1, 0], [2, 100], [3, 0]];
        const ordinary = splineSpan(points, 0, true);
        const bounded = splineSpan(points, 0, true, undefined, true);

        expect(ordinary).toContain('-16.67');
        expect(bounded).not.toContain('-16.67');
        expect(bounded).toContain('0.00, 1.00 0.00');
    });
});