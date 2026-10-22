# Plan: Adaptive Cover Pro Entity Registry Discovery

## Goal

Add a dedicated **Adaptive Cover Pro Entity Registry** section to the Helios card configuration editor. It follows the existing one-open-at-a-time accordion pattern alongside the current configuration sections. The section discovers Adaptive Cover Pro entities from Home Assistant, presents their entity IDs and names, and lets the user choose which entities this card should bind to.

This plan covers registry discovery and per-card entity selection. Shading calculations, mesh rendering, and cover control are later work and must not be implied by discovery alone.

## Repository Integration Points

- Editor section and state: `src/editor/editor.ts`. Add the registry as a peer to the existing one-open-at-a-time accordion sections; do not restructure the editor into global tabs.
- Card config type: `src/core/config/helios-config.ts` (`HeliosConfig`). It has an index signature and uses optional, validated keys; there is no `src/types.ts` or `src/utils.ts` in this project.
- Home Assistant boundary: `src/core/ha-types.ts` (`HassLike.callWS`). Keep the `hass` boundary typed rather than introducing `any`.
- Editor styles: `src/css/helios-card-editor-css.ts`.
- Localized editor labels and states: `src/core/i18n/`.
- Focused behavior tests: `test/`, following the existing Vitest conventions.

## Registry Section Behavior

1. Add a top-level accordion section titled **Adaptive Cover Pro Entity Registry**, matching the existing section structure, styling, and open/close behavior. Keep the current sections unchanged.
2. In the registry section, provide a refresh action and distinct loading, success, empty, permission/error, and stale-selection states. Do not present a failed request as an empty registry.
3. Display every matching entity, grouped by `config_entry_id` where available. Each row shows a human-readable name and the actual `entity_id`; the config-entry ID is group metadata, not the selected entity identifier.
4. Persist selected `entity_id` values in a new optional `HeliosConfig` key, for example `adaptive-cover-pro-entity-ids`. Use the editor's existing config update path (`_update` / `_commit`) so `config-changed` behavior remains consistent. Preserve existing selections when refreshing; flag IDs no longer present instead of silently deleting them.
5. Do not automatically enable shading when an entity is selected. Entity binding and any future shading toggle are independent settings.

## Discovery Flow

1. Start discovery when `hass` becomes available, not only in `firstUpdated`; the editor may receive `hass` after its first render. Avoid a request on every render. Refresh explicitly on user request and when the HA connection context changes.
2. Call `hass.callWS` with `{ type: 'config/entity_registry/list' }`. `callWS` manages the WebSocket request ID; do not supply a raw protocol `id`.
3. Treat the response as untrusted data. Confirm it is an array and validate each row's required strings before using it.
4. Filter using the Adaptive Cover Pro integration domain (`platform === 'adaptive_cover_pro'`) and valid `entity_id`. Preserve `config_entry_id` when present for grouping and diagnostics.
5. Keep separate entities separate even when they share one config entry. Prefer `name`, then `original_name`, then `entity_id` for display. Do not remove sensor suffixes with a global regular expression because that can make distinct entities look identical.
6. Handle authorization failures and unavailable WebSocket calls with an actionable message and retry. Do not log sensitive registry contents.

## Configuration and Compatibility

- Add the selected entity ID list to `HeliosConfig` in `src/core/config/helios-config.ts`, documenting its shape and allowing it to be absent for existing dashboards.
- Validate the list at the point it is consumed: accept only non-empty strings and ignore malformed values. No migration is needed for old configs.
- Keep entity discovery separate from the card's existing `windows`, `curtain-max-depth`, and `shadows-enabled` options. A later shading feature must define how discovered entities map to window geometry before adding render settings.
- Add localized labels, status text, and accessible tab names through the existing editor translations.

## Tests and Acceptance Criteria

- The new section opens and closes like existing editor sections; switching sections preserves existing editor behavior.
- A registry response containing Adaptive Cover Pro entities displays each entity with its own `entity_id`, grouped by config entry without collapsing rows.
- Other platforms, malformed rows, and rows without valid entity IDs are excluded.
- Empty results, request rejection, permission failure, loading, and retry are distinguishable in the tab.
- Late `hass` assignment and a connection-context change trigger discovery; ordinary editor updates do not repeatedly query the registry.
- Selecting and deselecting entities updates only the entity ID config key and preserves unrelated card settings.
- Previously saved entity IDs remain visible as unavailable if they disappear from the registry.
- Existing configuration sections, config values, and editor behavior continue to work unchanged.