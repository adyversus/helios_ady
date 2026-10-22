import { describe, expect, it } from 'vitest';
import { parseAdaptiveCoverRegistry } from '../src/editor/adaptive-cover-registry';

describe('parseAdaptiveCoverRegistry', () =>
{
    it('filters by platform and keeps distinct entities within a config entry', () =>
    {
        expect(parseAdaptiveCoverRegistry([
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.office_geometry', config_entry_id: 'entry-1', name: 'Office geometry' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.office_trace', config_entry_id: 'entry-1', name: 'Office trace' },
            { platform: 'other', entity_id: 'sensor.other', config_entry_id: 'entry-2', name: 'Other' },
        ])).toEqual([
            { entityId: 'sensor.office_geometry', configEntryId: 'entry-1', name: 'Office geometry' },
            { entityId: 'sensor.office_trace', configEntryId: 'entry-1', name: 'Office trace' },
        ]);
    });

    it('uses a readable fallback name and ignores malformed rows', () =>
    {
        expect(parseAdaptiveCoverRegistry([
            null,
            { platform: 'adaptive_cover_pro', entity_id: '', original_name: 'Ignored' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.window', original_name: '  Window  ' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.unnamed' },
        ])).toEqual([
            { entityId: 'sensor.unnamed', configEntryId: null, name: 'sensor.unnamed' },
            { entityId: 'sensor.window', configEntryId: null, name: 'Window' },
        ]);
    });

    it('deduplicates repeated entity IDs and rejects non-array responses', () =>
    {
        expect(parseAdaptiveCoverRegistry([
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.window', name: 'First' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.window', name: 'Updated' },
        ])).toEqual([{ entityId: 'sensor.window', configEntryId: null, name: 'Updated' }]);
        expect(parseAdaptiveCoverRegistry({ entities: [] })).toEqual([]);
    });
});