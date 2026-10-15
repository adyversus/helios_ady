# Window Definition Specification

## Purpose

Define multiple exterior windows with independent azimuths, geometry, curtain simulation, telemetry, and details. A window is a physical scene object attached to a building facade; it is not a screen-space marker or a Home Assistant cover entity.

This document defines the behavior contract for the multi-window implementation, including compatibility with the legacy implicit home window.

## Configuration

Windows are configured as an ordered list. Each entry has a stable configuration ID, a building target, and an outward-facing azimuth.

```yaml
type: custom:helios-ady-card
window-sill-height: 0.8
windows:
  - id: living-room
    label: LR
    building: home
    azimuth: 180
    length: 1.6
    width: 1.1
    along-facade: -1.2
    curtain-max-depth: 2.0
  - id: bedroom-rom
    label: BR
    building: home
    azimuth: 104
    azimuth-mode: requested
    length: 1.2
    width: 0.9
```

### Fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique, stable key within this card. Used to associate rendered state, telemetry, and detail views with this window. |
| `label` | no | Short user-facing name shown on the curtain button and in details, for example `LR`. If omitted, derive a readable name from `id`. Labels do not need to be unique. |
| `building` | yes | `home` in the initial implementation. Targeting other mapped buildings is deferred until stable source IDs are preserved through interpretation and merging. |
| `azimuth` | yes | Desired outward-facing bearing in degrees, clockwise from north. `0` is north, `90` east, `180` south, and `270` west. Values are normalized into `[0, 360)`. |
| `azimuth-mode` | no | `facade` (default) uses the resolved wall azimuth for calculations and arrow direction; `requested` uses the configured azimuth for calculations and arrow direction. The pane remains on the resolved facade in both modes. The previous `arrow-direction` key is accepted as a compatibility alias. |
| `length` | no | Horizontal span along the facade, in metres. Defaults to `1.2`. |
| `width` | no | Vertical glass height, in metres. Defaults to `0.9`. |
| `along-facade` | no | Signed horizontal displacement from the facade midpoint, in metres. Positive follows the selected outer-ring edge direction; defaults to `0`. Each window is positioned independently; its distance to neighboring windows determines the gap, so no separate gap field is required. |
| `curtain-max-depth` | no | Maximum simulated indoor sunlight depth for this window, in metres. Falls back to global `curtain-max-depth`, then `1`. |

All dimensions are metres in YAML. The editor converts displayed lengths to the Home Assistant user's configured unit and stores metres.

Raw YAML is normalized at the configuration boundary: `core/config/helios-config.ts` reads the `windows` key, applies field defaults, normalizes finite azimuths, and returns typed window definitions plus per-entry configuration errors. The config layer must not import scene code. Geometry-dependent validity is checked by the window calculation module after the home footprint is available.

### Compatibility and precedence

- If `windows` is absent, retain the existing single home-window behavior, including the default azimuth and global sill/curtain settings.
- If `windows` is present as an empty list, render no windows.
- If `windows` contains entries, those entries replace the implicit legacy window; do not also render the legacy window.
- Render one curtain button per supported definition (maximum 16): one for the legacy implicit window when `windows` is absent, one per configured entry up to the limit, and none for `windows: []`. For lists longer than 16, keep the first 16 for processing and show one aggregate overflow diagnostic/button for the remainder.
- All windows on the home use the shared global `window-sill-height`; `curtain-max-depth` may be overridden per window.
- The existing `window-azimuth-arrow` setting remains a global visibility toggle. When enabled, render an arrow for every configured window, pointing along that window's resolved outward facade normal.

## Geometry and Facade Resolution

- Match each configured azimuth to an exterior edge on the target building's outer footprint ring. Courtyard rings are not candidates.
- Select the exterior edge with the smallest circular angular difference between its outward normal and the configured azimuth. Always use the nearest edge when an exterior edge exists, even if the difference exceeds 30 degrees.
- Treat a difference greater than 30 degrees as a direction-mismatch warning, not a geometry failure: render on the nearest wall and expose the configured and resolved azimuths plus their angular difference in the button/details.
- Each window resolves its wall independently from its own azimuth. Windows on opposite sides of the same building (for example, `180` south and `0` north) must render on their respective opposite exterior walls while remaining at the shared sill height.
- Azimuth selects the building wall only; it must not change the window's vertical position. All windows on the home use the shared `window-sill-height` and remain aligned across facades. The glass extends upward from that sill by `width`.
- The glass remains planar on the selected wall. Do not rotate it off the facade to match a non-exact azimuth.
- Center the window on the edge plus `along-facade`. The complete glass rectangle must fit inside the edge and the building height.
- If the building has no usable exterior edge, dimensions do not fit, the target is invalid, or geometry is invalid, do not render a misplaced window. Preserve a per-window resolution error for editor diagnostics and details. A large azimuth difference alone is a warning and does not suppress rendering.
- Multiple windows may use different facades on one building, including opposite facades. Windows on the same facade may be adjacent (their edges touch, giving a `0 m` gap) or separated by any positive gap. Determine spacing from each window's center (`along-facade`) and `length`; do not require a separate gap field.
- Reject only actual overlap on a shared facade. For each window, compare the interval from `along-facade - length / 2` to `along-facade + length / 2`; touching interval endpoints are valid. Report overlaps rather than silently drawing one window over another.
- Initial targeting is limited to `building: home`, so source IDs for other mapped buildings are not required in v1. When non-home targets are introduced, preserve stable source keys through raw parsing, caching, interpretation, and merging; a target on an internal/merged-away wall is invalid because it has no exterior facade to host the window.
- The synthetic fallback home may resolve `building: home`, but its facade is only a visual proxy and must be identified as such in diagnostics.

## Rendering and Runtime Model

### Calculation Ownership

All window-domain calculations have one owner: a pure scene window-calculation module. The existing `src/scene/window-markers.ts` may own this responsibility or be replaced by a dedicated module, but the formulas and rules must not be duplicated across the engine, building painter, card, or detail panel. Raw YAML parsing, schema checks, scalar defaults, and azimuth normalization remain in `core/config/helios-config.ts`; the scene module consumes typed definitions and does not parse `unknown` config values.

The scene module owns azimuth-to-facade resolution and mismatch calculation, same-facade placement and overlap checks, world-space glass and arrow geometry, sun-exposure sampling, and curtain calculations. Geometry resolution and time-dependent evaluation may be separate functions/stages, but both remain within this single calculation owner.

Expose one canonical per-window result keyed by `id`. Its resolved geometry includes the host wall, configured/resolved azimuth, mismatch state, glass corners, arrow direction, and validation diagnostics. Its time-dependent evaluation includes the selected-time instant, exposure state and cells, sunlit fraction, curtain closed/open values, and any sunlight-depth value used for rendering.

### Cache and Invalidation

- Cache resolved world-space geometry by explicit building-geometry and normalized-window-config revisions. Reuse the host wall, selected edge, azimuth result, glass corners, and arrow direction until one of those inputs changes. Do not serialize or hash complete geometry/config objects on each frame.
- Cache time-dependent evaluation separately, keyed by window `id`, evaluation time, and revisions for inputs that affect the result: location, resolved window geometry, sun/horizon inputs, occluders, and curtain settings. Keep the cache bounded so timeline scrubbing cannot grow memory without limit.
- Camera bearing, pitch, zoom, viewport size, and pointer position are not exposure inputs and must not invalidate geometry or exposure/curtain evaluation caches.
- On camera or viewport changes, project and draw from the cached world-space geometry and evaluation using the current camera. Projection and shape generation still run when needed to keep the scene aligned.
- Invalidate only affected cache stages: window/config or building changes invalidate geometry and evaluations; sun/time/horizon/occluder/curtain changes invalidate evaluations; camera-only changes invalidate neither.
- V1 supports at most 16 usable window definitions. Keep the first 16 entries and show one aggregate overflow diagnostic/button for any excess entries; do not resolve/evaluate/render the excess. Disable the editor's Add action at 16. Before raising this limit, benchmark 1, 4, 8, and 16 windows against the maximum building count on target devices.

The building renderer consumes those results and is responsible for building-level ordering and occlusion. It must not redo facade selection, sun-exposure sampling, or curtain math. The curtain buttons and details consume the same evaluation result and only format/display its values; they must not independently recalculate percentages or states.

All window drawing is implemented in one reusable window-rendering function/module, such as `renderWindow` or `renderWindows`. That shared path accepts the resolved geometry, canonical evaluation result, scene camera, and clip bounds, then projects/clips and creates the pane, shading cells, curtain overlay, frame, and optional arrow. Every window uses this same renderer; differences come only from that window's input data. In particular, render every azimuth arrow through this same arrow-drawing path using the resolved direction supplied for that window. The global arrow toggle controls visibility for all windows. Do not implement window-shape or azimuth-arrow drawing separately inside the building painter or branch on individual window IDs.

`renderBuildings()` groups windows by host wall, invokes the shared window renderer for each one, and inserts the returned shapes immediately after that wall in its existing depth slot. This preserves wall attachment and occlusion while keeping the per-window drawing logic in one place.

### Rendering and Runtime Model

Resolve each definition into a render model keyed by window `id`. The model contains the home render building, selected edge, configured and resolved facade azimuths, angular difference/warning state, 3D glass corners at the shared sill height, and any validation result.

For each scene update:

1. Reuse resolved geometry while the building geometry/configuration is unchanged; do not re-run facade search for every paint.
2. Group resolved windows by their host building and edge.
3. Evaluate each window once for the current sun, horizon, occluders, curtain settings, and selected time. Reuse that result wherever the same window state is rendered or displayed; camera bearing/pitch, viewport size, and scene zoom alone must not trigger exposure or curtain recalculation.
4. For each window hosted by the wall, call the same window-rendering function with its resolved geometry and evaluation result; insert the returned shapes in that wall's existing depth slot.
5. On every camera or viewport redraw, project and draw the cached window geometry/evaluation through the current camera. Keep every window attached to its wall and preserve far-to-near building ordering so nearer buildings can occlude the whole window.
6. Recompute the shared evaluation when an input affecting exposure or curtain state changes, including sun position, terrain horizon, occluders, per-window curtain settings, or selected time.

Each window's arrow follows the resolved wall normal, not the configured azimuth when the nearest wall has a different bearing.

## Curtain Telemetry

Curtain values are independent per window. One window's sun exposure, obstruction, or max-depth setting must not overwrite another window's telemetry.

For each window and selected time, expose:

- `state`: `NO_DIRECT_SUN`, `SUNLIT`, `PARTIALLY_SHADED`, or `FULLY_SHADED`.
- `sunlit-fraction`: fraction of sampled glass receiving direct sunlight, in `[0, 1]`.
- `curtain-closed-fraction`: simulated covered fraction of the glass, in `[0, 1]`.
- `curtain-open-percent`: `100 * (1 - curtain-closed-fraction)`.
- `azimuth`: configured and resolved facade bearings, plus angular difference when they differ.
- `as-of`: selected timeline instant used to calculate the values.

These values are simulations derived from sun position, terrain horizon, building occlusion, window geometry, and curtain max depth. They are not physical sensor readings, do not imply a real curtain position, and never call a cover service.

## Window Details UI

- Give every window definition its own curtain button, keyed by its stable `id`. Display its configured `label` (for example, `LR`) followed by that window's simulated open percentage and current state. If `label` is omitted, derive a readable name from the `id`. Labels do not need to be unique; never use the display label as the state key. Do not combine multiple windows into one global curtain button.
- Create all curtain buttons through one reusable button component/template. Generate the button list from the window definitions and pass each window's `id`, label, evaluation values, availability, and activation handler as data; do not write separate button markup or behavior for individual windows.
- Each button preserves the existing curtain chip behavior: show that window's displayed name and simulated values and, when activated, open the same timeline/detail experience for that window. Select the window by `id` so its curtain chart and details cannot show another window's values.
- Each button also shows its current selected-time state; values must not be aggregated across windows.
- Show one button for each of the first 16 definitions, including a disabled/unavailable button for each invalid entry; do not fabricate telemetry. For further entries, show only one disabled aggregate overflow button. The legacy implicit window gets one button; an explicitly empty list gets none.
- The detail view for the selected window shows its target, configured/resolved azimuth and mismatch warning when applicable, dimensions, shared sill height, current state, sunlit fraction, curtain closed/open values, and max sunlight depth.
- Details follow the card's selected timeline time. Historical and forecast values are recalculated from the corresponding scene inputs; do not present modeled values as recorded sensor history.
- Keep the selected window keyed by `id` across reordering and live config updates. If that ID is removed, clear the selection or select the first remaining valid window deterministically.
- Keep the curtain buttons informational and navigational like the current chip; they do not move a real curtain or call a Home Assistant cover service.
- The existing global arrow toggle controls arrows only; it does not disable window buttons, exposure calculations, or curtain details.

## Validation

Reject or report, per entry:

- Missing/empty or duplicate `id`.
- Missing building target or azimuth, a non-home target in v1, non-finite numbers, invalid dimensions, invalid shared sill height, or out-of-range curtain depth.
- Missing host geometry, no usable exterior edge, or insufficient facade/building dimensions. A nearest-wall azimuth difference above 30 degrees is a warning, not an error.
- Actual overlap with another window on the same resolved facade. Exact edge-to-edge adjacency and positive gaps are valid.

The `core/config` resolver reports malformed entries and normalizes finite azimuths modulo `360`. The scene calculation module reports geometry-specific failures and mismatch warnings. Clamp only fields whose existing public config contract explicitly promises clamping; do not silently coerce invalid window geometry into a different facade or size.

## Implementation and Test Gates

- Add typed parsing/resolution at the configuration boundary and include `windows` in live visual-config updates.
- Limit v1 targets to the home; preserve stable building source identity before adding non-home targets in a later phase.
- Add geometry tests for azimuth wraparound, nearest-wall selection both within and beyond 30 degrees, mismatch warnings, opposite-facade windows, same-facade placement with touching windows and positive gaps, actual overlap rejection, fit, and failure diagnostics.
- Add render tests proving multiple windows on different and opposite edges use the shared renderer, render their distinct evaluated states, and remain in their host walls' depth slots.
- Add an azimuth-arrow test proving the same rendering path points arrows in different resolved directions for windows with different facades.
- Add telemetry tests proving two windows at different azimuths can independently report different sun states and curtain values at the same instant.
- Add an integration test proving the scene renderer and window details expose the same per-window evaluation values, rather than calculating them separately.
- Add cache tests proving camera-only changes reuse resolved geometry and exposure/curtain evaluations, relevant input changes invalidate the correct cache stages, and the evaluation cache remains bounded.
- Benchmark 1, 4, 8, and 16 windows against the maximum building count on target devices before raising the V1 limit of 16.
- Add UI/state tests proving button count matches the first 16 definitions plus at most one overflow diagnostic, each valid button opens its own timeline/details, and selection remains associated with its ID after list reordering.
- Keep the legacy implicit-window behavior covered until migration compatibility is deliberately removed.