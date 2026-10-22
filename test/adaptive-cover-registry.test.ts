import { describe, expect, it } from 'vitest';
import {
    groupAdaptiveCoverRegistry,
    parseAdaptiveCoverAreaNames,
    parseAdaptiveCoverRegistry,
} from '../src/editor/adaptive-cover-registry';

describe('parseAdaptiveCoverRegistry', () =>
{
    it('filters by platform and keeps distinct entities within a config entry', () =>
    {
        expect(parseAdaptiveCoverRegistry([
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.office_geometry', config_entry_id: 'entry-1', name: 'Office geometry' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.office_trace', config_entry_id: 'entry-1', name: 'Office trace' },
            { platform: 'other', entity_id: 'sensor.other', config_entry_id: 'entry-2', name: 'Other' },
        ])).toEqual([
            { entityId: 'sensor.office_geometry', configEntryId: 'entry-1', deviceId: null, areaId: null, name: 'Office geometry', domain: 'sensor', entityCategory: null },
            { entityId: 'sensor.office_trace', configEntryId: 'entry-1', deviceId: null, areaId: null, name: 'Office trace', domain: 'sensor', entityCategory: null },
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
            { entityId: 'sensor.unnamed', configEntryId: null, deviceId: null, areaId: null, name: 'sensor.unnamed', domain: 'sensor', entityCategory: null },
            { entityId: 'sensor.window', configEntryId: null, deviceId: null, areaId: null, name: 'Window', domain: 'sensor', entityCategory: null },
        ]);
    });

    it('deduplicates repeated entity IDs and rejects non-array responses', () =>
    {
        expect(parseAdaptiveCoverRegistry([
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.window', name: 'First' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.window', name: 'Updated' },
        ])).toEqual([{
            entityId: 'sensor.window', configEntryId: null, deviceId: null, areaId: null,
            name: 'Updated', domain: 'sensor', entityCategory: null,
        }]);
        expect(parseAdaptiveCoverRegistry({ entities: [] })).toEqual([]);
    });

    it('groups entities by config entry and uses device names with functional categories', () =>
    {
        const entities = parseAdaptiveCoverRegistry([
            { platform: 'adaptive_cover_pro', entity_id: 'button.office_apply', config_entry_id: 'entry-1', device_id: 'device-1', name: 'Apply calculated position' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.office_position', config_entry_id: 'entry-1', device_id: 'device-1', name: 'Target position' },
            { platform: 'adaptive_cover_pro', entity_id: 'sensor.office_trace', config_entry_id: 'entry-1', device_id: 'device-1', name: 'Decision trace' },
            { platform: 'adaptive_cover_pro', entity_id: 'number.office_limit', config_entry_id: 'entry-1', device_id: 'device-1', name: 'Maximum close' },
        ]);
        const instances = groupAdaptiveCoverRegistry(
            entities,
            new Map([['device-1', { name: 'Office roller shutter 1', areaId: 'area-office' }]]),
            new Map([['area-office', 'Office']]),
            'Shutter',
            'Unassigned room',
            'Multiple rooms',
            'Roller shutter',
        );

        expect(instances).toHaveLength(1);
        expect(instances[0].roomName).toBe('Office');
        expect(instances[0].name).toBe('Office roller shutter 1');
        expect(instances[0].entities).toHaveLength(4);
        expect(instances[0].categories.map(category => category.key).sort()).toEqual([
            'controls', 'diagnostics', 'parameters', 'position',
        ]);
    });

    it('prefers an entity area assignment over its device area', () =>
    {
        const entities = parseAdaptiveCoverRegistry([
            {
                platform: 'adaptive_cover_pro', entity_id: 'sensor.office_position',
                config_entry_id: 'entry-1', device_id: 'device-1', area_id: 'area-bedroom', name: 'Position',
            },
        ]);
        const instances = groupAdaptiveCoverRegistry(
            entities,
            new Map([['device-1', { name: 'Office shutter 1', areaId: 'area-office' }]]),
            new Map([['area-bedroom', 'Bedroom'], ['area-office', 'Office']]),
            'Shutter', 'Unassigned room', 'Multiple rooms', 'Roller shutter',
        );

        expect(instances[0].roomName).toBe('Bedroom');
    });

    it('parses area registry IDs and names for room grouping', () =>
    {
        expect(parseAdaptiveCoverAreaNames([
            { area_id: 'area-bedroom', name: 'Bedroom' },
            { id: 'area-office', name: 'Office' },
            { area_id: '', name: 'Ignored' },
        ])).toEqual(new Map([
            ['area-bedroom', 'Bedroom'],
            ['area-office', 'Office'],
        ]));
    });
});