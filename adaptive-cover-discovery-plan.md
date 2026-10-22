# Plan: Adaptive Cover Pro Entity Registry Discovery

## Goal

Add a dedicated **Adaptive Cover Pro Entity Registry** section to the Helios card configuration editor. It follows the existing one-open-at-a-time accordion pattern alongside the current configuration sections. The section discovers Adaptive Cover Pro entities, groups them by config entry, and lets the user select one shutter instance for this card. Entity rows are secondary, expandable technical details.

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
3. Fetch Home Assistant's area registry and group selectable shutter instances under collapsible room headings. Resolve an entity's explicit area first, then its device's area; label missing assignments as unassigned. Display one selectable row per `config_entry_id`, preferring a device/user-assigned name and falling back to a shortened config-entry ID. Show entity/category counts; expand to view underlying entities grouped into controls, position, configuration, and diagnostics.
4. Persist the selected config-entry ID in an optional `HeliosConfig` key, `adaptive-cover-pro-config-entry-id`. Use the editor's existing config update path (`_update` / `_commit`) so `config-changed` behavior remains consistent. Preserve the selection when refreshing; flag an ID no longer present instead of silently deleting it.
5. Do not automatically enable shading when an entity is selected. Entity binding and any future shading toggle are independent settings.

## Discovery Flow

1. Start discovery when `hass` becomes available, not only in `firstUpdated`; the editor may receive `hass` after its first render. Avoid a request on every render. Refresh explicitly on user request and when the HA connection context changes.
2. Call `hass.callWS` with `{ type: 'config/entity_registry/list' }`. `callWS` manages the WebSocket request ID; do not supply a raw protocol `id`.
3. Fetch `config/device_registry/list` for optional device/user-assigned names and device area assignments, plus `config/area_registry/list` for area IDs and labels. Discovery should still show entities if the optional device/area lookup fails.
4. Treat all responses as untrusted data. Confirm they are arrays and validate each row's required strings before using it.
5. Filter using the Adaptive Cover Pro integration domain (`platform === 'adaptive_cover_pro'`) and valid `entity_id`. Preserve entity/device area IDs, config entry, domain, and entity category for grouping and detail presentation.
6. Resolve room from entity area, then device area; keep separate config entries as separate shutter rows under the same collapsible area heading. Prefer a matched device's `name_by_user`, then `name`, then a shortened config-entry ID for the instance label.
7. Handle authorization failures and unavailable WebSocket calls with an actionable message and retry. Do not log sensitive registry contents.

## Configuration and Compatibility

- Add the selected config-entry ID to `HeliosConfig` in `src/core/config/helios-config.ts`, documenting its shape and allowing it to be absent for existing dashboards.
- Validate the selected value at the point it is consumed: accept only a non-empty string. No migration is needed for old configs.
- Keep entity discovery separate from the card's existing `windows`, `curtain-max-depth`, and `shadows-enabled` options. A later shading feature must define how discovered entities map to window geometry before adding render settings.
- Add localized labels, status text, and accessible radio/expand controls through the existing editor translations.

## Tests and Acceptance Criteria

- The new section opens and closes like existing editor sections; switching sections preserves existing editor behavior.
- A registry response containing multiple entities for a config entry produces one selectable instance row, with entities visible only when its details are expanded.
- Device/user-assigned names are preferred; missing device metadata falls back to a shortened config-entry ID.
- Other platforms, malformed rows, and rows without valid entity IDs are excluded.
- Empty results, request rejection, permission failure, loading, and retry are distinguishable in the tab.
- Late `hass` assignment and a connection-context change trigger discovery; ordinary editor updates do not repeatedly query the registry.
- Selecting an instance updates only the config-entry ID key and preserves unrelated card settings; the no-selection option clears it.
- A previously selected config entry remains visible as unavailable if it disappears from the registry.
- Existing configuration sections, config values, and editor behavior continue to work unchanged.