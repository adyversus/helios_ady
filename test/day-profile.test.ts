import { describe, expect, it } from 'vitest';
import { buildDayProfile } from '../src/data/period-totals/day-profile';
import { CURTAIN_COLOR } from '../src/scene/window-markers';
import type { PeriodHost } from '../src/data/period-totals/period-totals';
import { DAY_MS, HOUR_MS } from '../src/core/config/constants';

const dayStart = new Date(2024, 5, 1).getTime();
const store = {
    storeStartMs: dayStart,
    storeEndMs: dayStart + DAY_MS,
    bucketsPerHour: 1,
    bucketsPerDay: 24,
    bucketsTotal: 24,
    stepMs: HOUR_MS,
    builtAtMs: dayStart,
    dataVersion: 'test',
    humidity: new Array<number | null>(24).fill(50),
};

function profileHost(): PeriodHost
{
    return {
        config: { 'display-update-frequency-per-hour': 1 },
        _timelineMode: 'today',
        _timeRange: { start: new Date(dayStart), end: new Date(dayStart + DAY_MS) },
        _unifiedStore: store,
        _engine: { getCurtainOpenPercent: () => 72 },
    } as unknown as PeriodHost;
}

describe('day profile target colors', () =>
{
    it('uses the humidity token for humidity and the Curtain color for Curtain', () =>
    {
        const host = profileHost();
        const humidity = buildDayProfile(host, 'humidity', dayStart, dayStart + DAY_MS);
        const curtain = buildDayProfile(host, 'curtain', dayStart, dayStart + DAY_MS);

        expect(humidity[0]?.colour).toEqual({ kind: 'token', token: 'humidity' });
        expect(curtain[0]?.colour).toEqual({ kind: 'literal', color: CURTAIN_COLOR });
    });
});