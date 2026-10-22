# Terrain Horizon Compass: Analysis and Plan

## Scope and Status

Add standard cardinal letters N, E, S, and W around the terrain horizon, with a settings toggle controlling their visibility. The initial implementation is complete; the design analysis and implementation sequence below record its intended behavior.

Implemented: default-off `show-horizon-compass`, independent ridge visibility, shared horizon projection, upright SVG letters, localized settings/accessibility strings, flat-terrain fallback, and fixed 14-pixel outward spacing with viewport clipping only. Collision-driven repositioning and suppression were removed so position and distance remain consistent during camera movement.

Verification: focused config/geometry/HUD-cache tests, full regression suite, typecheck, lint, and production build. Browser checks covered all four toggle combinations, editor save/reload, missing terrain at night, and desktop/mobile letter bounds and screenshots.

Recommendation: use the existing celestial-horizon projection and SVG HUD, with an independent, default-off `show-horizon-compass` option. No new rendering library or external data source is needed.

## Current Implementation

- [src/scene/sun-arc.ts](src/scene/sun-arc.ts) provides `horizonSpherePoint`, shared with the celestial geometry. Its azimuth convention is clockwise from geographic north, using local east/north/up coordinates.
- [src/scene/helios-engine.ts](src/scene/helios-engine.ts) projects the terrain ridge in `projectSunScene` as a closed 360-degree ring, sampled every 5 degrees. It uses `_sunArcScale`, `_horizonAt`, and `_projectScenePoint`.
- The ridge is empty when `show-horizon-line` is false or the terrain peak is below `HORIZON_MIN_PEAK_DEG`. A missing profile resolves to a flat horizon. Therefore, a ridge polyline is not a reliable prerequisite for compass labels.
- [src/hud/hud.ts](src/hud/hud.ts) defines `SunScene` and its equality comparison. [src/hud/scene-hud-controller.ts](src/hud/scene-hud-controller.ts) renders the ridge through SVG and caches its point string by scene reference.
- [src/scene/projection.ts](src/scene/projection.ts) owns camera bearing, tilt, perspective, and viewport projection. The compass must use this projection, not fixed screen-edge positions or a second bearing formula.
- [src/core/config/helios-config.ts](src/core/config/helios-config.ts) resolves `show-horizon-line`; [src/helios-card.ts](src/helios-card.ts) forwards it to the engine. [src/editor/editor.ts](src/editor/editor.ts) exposes the existing terrain-horizon toggle and color picker together.

## Feasibility and Local Hypothesis

The feature fits the current architecture: four world-space anchors can be projected alongside the ridge and rendered as upright SVG text. The expected incremental cost is four projections and at most four text nodes per scene update, with no additional network requests.

Falsifiable hypothesis: cardinal anchors produced with `horizonSpherePoint` and the same scale/projection as the ridge stay geographically aligned through bearing, pitch, zoom, and viewport changes without changing the renderer or terrain-fetch pipeline.

Cheapest discriminating check: project N/E/S/W with the existing `SceneCamera` at a flat horizon, bearing 0, and pitch 0. N must be above the home, E right, S below, and W left. Repeat after a 90-degree bearing change and compare with the camera transform, not an assumed screen compass convention. Then compare one anchor with the ridge's point at the same azimuth and terrain elevation.

This establishes geometric feasibility, not visual legibility. A live desktop/mobile check is still required for clipping, label collisions, and low-pitch compression.

## Proposed Behavior

| Letter | Geographic Azimuth |
| --- | --- |
| N | 0 degrees |
| E | 90 degrees |
| S | 180 degrees |
| W | 270 degrees |

- Directions refer to geographic north, not magnetic north. Keep the exact standard letters N/E/S/W in every language; translate settings and accessible direction names only.
- Anchors rotate with the world during manual rotation, auto-rotation, and selected-window camera focus. The text itself remains upright, never rotated or perspective-scaled with the ground plane.
- Use the same radius/scale as the ridge. At each cardinal azimuth, use the local terrain elevation when available, otherwise 0 degrees.
- Position the text at a fixed 14-pixel screen-space offset away from the projected home. Never vary the gap for nearby controls, other letters, or viewport edges. Do not change the underlying azimuth or enlarge the celestial dome to fit the text.
- Keep compass visibility independent of `show-horizon-line`. Hiding the ridge must not hide enabled letters. With no terrain data or flat terrain, letters use the flat celestial-horizon ring.
- Do not wait for terrain retrieval to display enabled letters. Reproject them when the profile arrives, using the same refresh path as the ridge.
- Labels are orientation information only: no click behavior, map rotation command, sensor subscription, sun gate change, shading change, or production calculation change.

## Settings Contract

Proposed YAML option:

```yaml
show-horizon-compass: true
```

- Default: `false`, preserving existing dashboards. Resolve only explicit boolean `true` as enabled, consistent with existing opt-in resolvers.
- Add a visual-editor toggle named "Show compass letters" beside the terrain-horizon controls. Keep it enabled even when the ridge-line toggle is off.
- Store the same key for YAML and editor changes. Toggling must update the current card immediately and survive dashboard save/reload.
- Wire changes through the existing visual-config refresh path. They must not re-fetch terrain/buildings or reset camera pose, selected window, or chart state.
- No separate font, size, color, language, or individual-direction controls in the initial version.

| Ridge Setting | Compass Setting | Expected Result |
| --- | --- | --- |
| On | Off | Existing ridge behavior only |
| On | On | Ridge when terrain qualifies, plus compass letters |
| Off | On | Compass letters without the ridge |
| Off | Off | Neither visual; terrain still affects existing sun visibility |

## Rendering and Layout

Use SVG text in the scene HUD rather than canvas text, map markers, or a CSS-transformed ground child. This reuses the current overlay coordinate system and keeps lettering crisp and upright.

- Extend `SunScene` with a typed cardinal-label collection containing identity and projected screen coordinates. Generate an empty collection when disabled.
- Generate anchors independently of the ridge's visibility/peak threshold branch. Avoid an early return tied to ridge availability or sun-path visibility.
- Include cardinal identity, coordinates, and collection length in scene equality so toggling, camera movement, and terrain refresh cannot leave stale labels behind a stable scene reference.
- Render labels in a dedicated non-interactive SVG group, separate from the ridge's `showRidge` condition. Keep their layer below interactive HUD chips and do not inherit solar daylight opacity: directions remain useful at night.
- Reuse existing theme typography with a modest fixed CSS-pixel size and contrast outline/halo. Do not use badges, pills, or decorative compass artwork.
- Give the group an accessible compass name and labels full direction names. Disable pointer events so map gestures and existing hit testing are unchanged.
- Validate projection before rendering. Do not display non-finite or near-plane-invalid anchors. Account for the measured text bounds when checking viewport margins.
- Preserve geographic positions: hide a clipped label instead of clamping it to an unrelated screen edge. All four labels should appear when the projected ring and their bounds fit the usable viewport; not every pose can guarantee this.
- Do not suppress or reposition letters for collisions or reserve an artificial timeline exclusion area. Foreground controls retain their existing layer order and may cover compass text; fixed geographic placement takes priority over collision avoidance.

## Implementation Sequence

### 1. Config and Editor

Add `show-horizon-compass` to `HeliosConfig`, an explicit-true resolver, and a default-off engine visibility setter following the ridge toggle pattern. Forward it from the card during visual updates. Add the editor toggle and translated settings/accessibility strings using the existing i18n interface and locale conventions.

First add focused tests for absent/false/true/invalid values and editor persistence. Verify the new toggle is not disabled by `show-horizon-line: false`.

### 2. Geometry and Update Contract

Add the four cardinal samples beside ridge projection, reusing `horizonSpherePoint`, terrain interpolation, scale, and camera projection. Keep direction data constant; extract a small pure helper only if needed to test this logic cleanly.

Extend `SunScene`, equality checks, and affected fixtures together. Test cardinal mapping, camera transforms, terrain elevation, flat fallback, independent toggles, and updates after a profile refresh. Reuse existing scene test helpers where practical; create one focused compass test file only if existing files have no suitable home.

### 3. HUD and Styling

Render the cardinal collection in the HUD with upright text, theme-aware contrast, accessible names, and no pointer capture. Keep layout/culling logic deterministic and test it independently where feasible. Use [src/css/helios-card-scene-css.ts](src/css/helios-card-scene-css.ts) for scene styling.

Add focused render checks for exactly four labels in a fitting viewport, no labels when disabled, visibility without a ridge, night visibility, stale-node removal, fixed spacing through rotation, and viewport clipping without repositioning.

### 4. Documentation and Integration

Document the new key, default, editor location, geographic convention, independent ridge behavior, flat fallback, and constrained-viewport behavior in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

Run focused tests after each behavior slice. At final integration, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Inspect browser screenshots at desktop and mobile sizes before declaring the rendering complete.

## Acceptance Checks

- An unchanged configuration shows no new letters.
- Enabling the setting shows standard N/E/S/W at the correct azimuths when space permits; disabling removes them immediately.
- YAML and editor changes agree and persist across reload.
- Ridge and compass toggles work in all four combinations above.
- Missing, failed, delayed, and flat terrain data do not prevent compass display.
- Rotation, auto-rotation, focus animation, supported pitch/zoom levels, and resize preserve geographic alignment and upright lettering.
- Home-location and terrain-profile updates refresh positions; solar date/time and day/night transitions never incorrectly hide the compass.
- Desktop/mobile checks show readable contrast, fixed horizon spacing, and no blocked gestures or controls. Viewport clipping is predictable; control or letter collisions must never reposition compass text.
- Terrain fetching, sun visibility, energy values, window/shading calculations, and existing camera state remain unchanged.

## Tradeoffs and Open Decisions

The default-off behavior and independent visibility are recommendations, not existing application behavior. They prioritize compatibility and orientation even when users hide the ridge.

Terrain-following anchors visually associate each direction with the local skyline but can move vertically when terrain data arrives. A fixed zero-altitude ring would be steadier but detach the letters from elevated relief; prefer terrain-following for this request.

The four-point geometry is low risk. Readability at compressed pitch and correct scene-equality invalidation are the main implementation risks. The fixed 14-pixel gap deliberately prioritizes stable placement over avoiding collisions with foreground controls.

## Out of Scope

Intercardinal letters, degree ticks, compass roses, magnetic declination, draggable labels, clickable navigation, new terrain APIs, and changes to shading or forecasting.