
# Multi-Window Implementation Plan

## Scope

Implement the behavior in [window-definition-spec.md](window-definition-spec.md): multiple configurable windows on the home building, each with independent azimuth, facade placement, curtain evaluation, button, and details. Keep one shared calculation path, one shared window renderer, and one reusable curtain-button component.

V1 targets `building: home` only. All windows use the global `window-sill-height`, so they share one vertical level. A missing `windows` key adapts the current implicit window into the same pipeline; an explicit empty list means no windows.

## Architecture Contracts

- `core/config/helios-config.ts` normalizes raw YAML into typed window definitions and reports config errors; one pure scene calculation module owns facade resolution, geometry, overlap, exposure, curtain values, and world-space arrow direction.
- A single reusable window renderer projects, clips, and draws every window. `renderBuildings()` groups windows by host wall and inserts returned shapes into that wall's existing depth slot.
- A single reusable curtain-button component is generated from window definitions. Every button shows only its window's label and telemetry and selects details by stable window `id`.
- Scene rendering and the UI consume the same per-window evaluation result; neither may independently recompute window values.
- Preserve the current painter ordering and occlusion: windows stay attached to their host wall and nearer buildings can cover them.

## Implementation Sequence

### 1. Lock Existing Behavior

- Preserve current single-window output as a characterization baseline: facade attachment, clipping, occlusion, exposure colors, curtain overlay, arrow, and camera behavior.
- Record legacy behavior for `window-sill-height`, `curtain-max-depth`, and `window-azimuth-arrow`.

**Gate:** Focused existing window and building-render tests pass before refactoring.

### 2. Define and Normalize Window Inputs

- Add typed `WindowDefinition` parsing and defaults in `core/config/helios-config.ts`; include optional `id`, `label`, `building: 'home'`, azimuth, dimensions, `along-facade`, and per-window curtain depth.
- Convert absent `windows` to the legacy default and preserve an explicit empty list as no windows.
- Bound parsing and editor rendering to the first 16 definitions plus one aggregate overflow diagnostic; preserve excess raw entries until the user explicitly removes them.
- Validate IDs and values at the config boundary; keep all YAML dimensions in metres and convert only in editor controls.
- Include `windows` in `VISUAL_CONFIG_KEYS` and add editor controls for label, azimuth, dimensions, placement, and curtain depth. Target `home` only in V1.

**Gate:** Parser/config tests cover legacy fallback, empty list, defaults, duplicate IDs, invalid values, and live updates.

### 3. Centralize Window Calculations

- Keep one authoritative pure scene calculation module for facade resolution, placement/overlap, world-space geometry, exposure, curtain values, arrow direction, and geometry diagnostics.
- Resolve each azimuth to its nearest exterior edge, including opposite sides; report differences over 30 degrees as warnings rather than omitting the window.
- Use the shared global sill height. Allow same-facade windows to touch or have positive gaps; reject actual overlap and geometry that cannot fit.
- Return resolved geometry and evaluations keyed by stable window ID for both scene rendering and UI.

**Gate:** Pure tests cover opposite facades, north wraparound, mismatch warnings, shared elevation, touching/gapped/overlapping placement, fit, and independent telemetry.

### 4. Cache Geometry and Evaluation

- Cache world-space geometry by explicit building-geometry and normalized-window-config revisions; do not serialize full inputs per frame.
- Cache time-dependent evaluations by window ID, evaluation time, and relevant input revisions. Keep the evaluation cache bounded.
- Camera pose, viewport, zoom, and pointer changes must not invalidate geometry or sun/curtain calculations; projection and drawing still use the current camera.
- Invalidate geometry plus dependent evaluations on building/window-definition changes. Invalidate evaluations on sun/time, horizon, occluder, sill, or curtain-setting changes.
- V1 supports at most 16 usable windows; excess entries remain diagnosable but are not rendered. Benchmark 1, 4, 8, and 16 windows against the maximum building count on target devices before raising this limit.

**Gate:** Cache tests cover camera-only reuse, correct invalidation, and bounded retention. Record target-device benchmark results before increasing the V1 window limit of 16.

### 5. Add One Reusable Window Renderer

- Implement one `renderWindow`/`renderWindows` path taking resolved geometry, canonical evaluation, camera, clip bounds, and arrow visibility.
- Move pane, exposure cells, curtain overlay, frame, and arrow shape construction into that shared path; do not branch on window IDs.
- Have `renderBuildings()` group windows by host wall and insert returned shapes in that wall's existing depth slot.
- Preserve culling, clipping, depth order, nearby-building occlusion, and stable SVG node updates.

**Gate:** Render tests cover multiple/opposite facades, direction-specific arrows, host-wall ordering, and occlusion.

### 6. Wire Per-Window Curtain Telemetry and Details

- Query the canonical evaluation by window ID and selected time; do not keep a separate global calculation for configured windows.
- Generate one curtain button per definition through one reusable component. Keep labels, values, and selection keyed by ID.
- Preserve current curtain-chip activation behavior while opening the selected window's timeline/details. Buttons remain informational and never actuate a cover.
- Show configured/resolved azimuth, mismatch, dimensions, shared sill height, exposure, curtain values, and max depth.

**Gate:** UI tests cover button count, value isolation, selection, time updates, invalid entries, reorder/removal, legacy behavior, and empty-list behavior.

### 7. Document and Integrate

- Update `docs/CONFIGURATION.md` with schema, defaults, shared sill level, mismatch warnings, labels, and legacy/empty-list behavior.
- Verify live config edits update the renderer without re-fetching building data or restarting the engine.

**Gate:** Full tests, `npm run typecheck`, lint, and production build pass. Verify a south/north multi-window scene, buttons, arrows, and per-window details in the dev preview.

## Current Code Ownership

- Config types and visual update keys: `src/core/config/helios-config.ts`, `src/card/init.ts`
- Window geometry/exposure helpers: `src/scene/window-markers.ts`
- Building interpretation, face ordering, and window insertion point: `src/scene/buildings.ts`
- Camera projection and scene painting: `src/scene/projection.ts`, `src/scene/renderer.ts`, `src/scene/scene-dom.ts`
- Engine time/config flow: `src/scene/helios-engine.ts`
- Curtain chip and details UI: `src/helios-card.ts`, `src/hud/detail-panel.ts`, `src/charts/charts-generic.ts`
- Editor: `src/editor/editor.ts`
- Existing tests to extend: `test/window-markers.test.ts`, `test/buildings-render.characterization.test.ts`

## Out of Scope for V1

- Targeting arbitrary mapped buildings. The current render model merges footprints and lacks stable source IDs; add that identity pipeline before exposing non-home targets.
- Physical curtain entities or cover-service calls.
- Per-window sill levels; all V1 windows share the global sill height.
- Silently omitting a window only because its requested azimuth is more than 30 degrees from the selected wall. Always use the nearest wall and surface the mismatch.

