export interface AdaptiveCoverRegistryEntity
{
    entityId:       string;
    configEntryId:  string | null;
    name:           string;
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
            name: nonEmptyString(row['name']) ?? nonEmptyString(row['original_name']) ?? entityId,
        });
    }

    return [...byEntityId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.entityId.localeCompare(b.entityId));
}