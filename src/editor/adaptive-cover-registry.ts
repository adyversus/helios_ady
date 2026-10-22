export interface AdaptiveCoverRegistryEntity
{
    entityId:       string;
    configEntryId:  string | null;
    deviceId:       string | null;
    areaId:         string | null;
    name:           string;
    domain:         string;
    entityCategory: string | null;
}

export interface AdaptiveCoverRegistryCategory
{
    key:      'controls' | 'position' | 'parameters' | 'diagnostics' | 'other';
    entities: AdaptiveCoverRegistryEntity[];
}

export interface AdaptiveCoverRegistryInstance
{
    configEntryId: string;
    roomName:      string;
    name:          string;
    entities:      AdaptiveCoverRegistryEntity[];
    categories:    AdaptiveCoverRegistryCategory[];
}

export interface AdaptiveCoverDeviceMetadata
{
    name:    string | null;
    areaId:  string | null;
}

function nonEmptyString(value: unknown): string | null
{
    if (typeof value !== 'string')
    {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function parseAdaptiveCoverRegistry(response: unknown): AdaptiveCoverRegistryEntity[]
{
    if (!Array.isArray(response))
    {
        return [];
    }

    const byEntityId = new Map<string, AdaptiveCoverRegistryEntity>();
    for (const value of response)
    {
        if (!value || typeof value !== 'object')
        {
            continue;
        }
        const row = value as Record<string, unknown>;
        if (row['platform'] !== 'adaptive_cover_pro')
        {
            continue;
        }
        const entityId = nonEmptyString(row['entity_id']);
        if (!entityId)
        {
            continue;
        }

        byEntityId.set(entityId, {
            entityId,
            configEntryId: nonEmptyString(row['config_entry_id']),
            deviceId: nonEmptyString(row['device_id']),
            areaId: nonEmptyString(row['area_id']),
            name: nonEmptyString(row['name']) ?? nonEmptyString(row['original_name']) ?? entityId,
            domain: entityId.split('.', 1)[0],
            entityCategory: nonEmptyString(row['entity_category']),
        });
    }

    return [...byEntityId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.entityId.localeCompare(b.entityId));
}

export function parseAdaptiveCoverDeviceNames(response: unknown): Map<string, AdaptiveCoverDeviceMetadata>
{
    const devices = new Map<string, AdaptiveCoverDeviceMetadata>();
    if (!Array.isArray(response))
    {
        return devices;
    }
    for (const value of response)
    {
        if (!value || typeof value !== 'object')
        {
            continue;
        }
        const row = value as Record<string, unknown>;
        const id = nonEmptyString(row['id']);
        const name = nonEmptyString(row['name_by_user']) ?? nonEmptyString(row['name']);
        if (id)
        {
            devices.set(id, { name, areaId: nonEmptyString(row['area_id']) });
        }
    }
    return devices;
}

export function parseAdaptiveCoverAreaNames(response: unknown): Map<string, string>
{
    const areas = new Map<string, string>();
    if (!Array.isArray(response))
    {
        return areas;
    }
    for (const value of response)
    {
        if (!value || typeof value !== 'object')
        {
            continue;
        }
        const row = value as Record<string, unknown>;
        const id = nonEmptyString(row['area_id']) ?? nonEmptyString(row['id']);
        const name = nonEmptyString(row['name']);
        if (id && name)
        {
            areas.set(id, name);
        }
    }
    return areas;
}

function inferredRoomName(deviceName: string): string | null
{
    const roomName = deviceName.replace(/\s*(?:-|:)\s*(?:roller\s+)?shutter(?:\s+switch)?\s+\d+$/i, '').trim();
    if (!roomName || roomName === deviceName)
    {
        return null;
    }
    const words = roomName.split(/\s+/);
    if (words.length > 1 && words.at(-1)?.toLowerCase() === words.at(-2)?.toLowerCase())
    {
        words.pop();
    }
    return words.join(' ');
}

function inferredShutterNumber(entities: readonly AdaptiveCoverRegistryEntity[]): string | null
{
    for (const entity of entities)
    {
        const match = entity.entityId.match(/(?:switch|shutter)[_-](\d+)(?:[_-]|$)/i);
        if (match)
        {
            return match[1];
        }
    }
    return null;
}

function entityCategory(entity: AdaptiveCoverRegistryEntity): AdaptiveCoverRegistryCategory['key']
{
    const description = `${entity.name} ${entity.entityId}`.toLowerCase();
    if (entity.entityCategory === 'config' || entity.domain === 'number'
        || /automatic control|integration enabled|manual override detection|return to default|outside temperature|climate mode|sun tracking/.test(description))
    {
        return 'parameters';
    }
    if (/position/.test(description) && !/apply calculated position|managed my position/.test(description))
    {
        return 'position';
    }
    if (entity.entityCategory === 'diagnostic' || /status|trace|forecast|mismatch|sun|occupancy|temperature/.test(description))
    {
        return 'diagnostics';
    }
    if (entity.domain === 'cover' || entity.domain === 'button'
        || /control|stop|apply calculated|reset manual override/.test(description))
    {
        return 'controls';
    }
    if (entity.domain === 'switch')
    {
        return 'controls';
    }
    return 'other';
}

export function groupAdaptiveCoverRegistry(
    entities: readonly AdaptiveCoverRegistryEntity[],
    devices: ReadonlyMap<string, AdaptiveCoverDeviceMetadata>,
    areaNames: ReadonlyMap<string, string>,
    fallbackLabel: string,
    unassignedRoomLabel: string,
    multipleAreasLabel: string,
    shutterLabel: string,
): AdaptiveCoverRegistryInstance[]
{
    const byConfigEntry = new Map<string, AdaptiveCoverRegistryEntity[]>();
    for (const entity of entities)
    {
        if (!entity.configEntryId)
        {
            continue;
        }
        const group = byConfigEntry.get(entity.configEntryId) ?? [];
        group.push(entity);
        byConfigEntry.set(entity.configEntryId, group);
    }

    return [...byConfigEntry.entries()].map(([configEntryId, groupEntities]) =>
    {
        const deviceMetadata = [...new Set(groupEntities.map(entity => entity.deviceId).filter((id): id is string => !!id))]
            .map(id => devices.get(id))
            .filter((device): device is AdaptiveCoverDeviceMetadata => !!device);
        const deviceLabels = [...new Set(deviceMetadata.map(device => device.name).filter((name): name is string => !!name))];
        const assignedAreas = [...new Set(groupEntities
            .map(entity =>
            {
                const areaId = entity.areaId ?? (entity.deviceId ? devices.get(entity.deviceId)?.areaId : null);
                return areaId ? areaNames.get(areaId) : undefined;
            })
            .filter((name): name is string => !!name))];
        const inferredRooms = [...new Set(deviceLabels.map(inferredRoomName).filter((name): name is string => !!name))];
        const roomNames = assignedAreas.length > 0 ? assignedAreas : inferredRooms;
        const roomName = roomNames.length > 1 ? multipleAreasLabel : roomNames[0] ?? unassignedRoomLabel;
        const shutterNumber = inferredShutterNumber(groupEntities) ?? configEntryId.slice(-4);
        const deviceName = deviceLabels.join(' / ');
        const instanceName = !deviceName || deviceName.toLowerCase() === roomName.toLowerCase()
            ? `${roomName === unassignedRoomLabel ? fallbackLabel : roomName} - ${shutterLabel} ${shutterNumber}`
            : deviceName;
        const byCategory = new Map<AdaptiveCoverRegistryCategory['key'], AdaptiveCoverRegistryEntity[]>();
        for (const entity of groupEntities)
        {
            const key = entityCategory(entity);
            const category = byCategory.get(key) ?? [];
            category.push(entity);
            byCategory.set(key, category);
        }

        return {
            configEntryId,
            roomName,
            name: instanceName,
            entities: groupEntities,
            categories: [...byCategory.entries()].map(([key, categoryEntities]) => ({ key, entities: categoryEntities })),
        };
    }).sort((a, b) => a.roomName.localeCompare(b.roomName) || a.name.localeCompare(b.name) || a.configEntryId.localeCompare(b.configEntryId));
}