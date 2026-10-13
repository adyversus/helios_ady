# Window Rendering Implementation Plan

## Goal

Draw a window as a physical detail on the exterior facade of a selected Helios building. Deliver it in two stages: first a centered window with internal default dimensions and a configurable sill height; then configurable length, width, and azimuth.

## Design Decisions

- A window is a 3D rectangle attached to a building wall, not a screen-space HUD element.
- In Stage 1, the selected target is the home prism identified by `Building.isHome`. If mapped geometry is unavailable, the synthetic rectangle remains a visual proxy; it is not claimed to represent the real building's position or footprint. Selecting arbitrary neighboring buildings is deferred because the current model has no stable building ID.
- `length` means horizontal span along the facade. `width` means vertical glass height. `azimuth` is the outward-facing direction, clockwise from north.
- Stage 1 centers the window horizontally on its selected facade. Its bottom edge is set by `window-sill-height`, defaulting to floor level; glass height remains an independent internal default.
- Stage 1 exposes `window-sill-height` from 0 to 50 m, measured from the floor to the bottom edge of the glass. Config/YAML values are metres; the editor displays metres for metric HA users and inches for imperial users.
- Stage 1 exposes `curtain-max-depth` from 0 to 50 m (default 1 m) and shows a read-only `Curtain` chip from 0% open to 100% open. It simulates cover position only; it never calls a cover service.
- Stage 1 uses a fixed default azimuth of `272°` to select the nearest matching exterior facade on the outer ring. Courtyard rings are not candidates; walls more than 30° away do not receive a window.
- Stage 2 uses azimuth to select the exterior wall whose outward normal most closely matches the configured direction. It does not rotate a window away from the wall plane.
- Along-facade offset and adjustable glass height are out of scope initially; facade-center placement remains the default.

## Stage 1: Centered Default Window

1. **Resolve the target.** Use the home prism identified by `isHome`. When the home is synthetic, use its rectangle strictly as a visual facade proxy.
2. **Add sill configuration.** Add a meter-based `window-sill-height` value, default 0 and clamped to 0-50 m. The editor shows metres or inches according to HA's length system; conversion happens at the editor boundary.
3. **Build facade geometry.** Use a pure geometry helper to choose the outer-ring wall nearest the fixed `272°` outward azimuth and return a centered window plane in local east/north/up metres. Keep sill height independent from glass height; omit the window if the fixed glass height cannot fit above the sill.
4. **Render with the building.** Integrate the projected window into `renderBuildings()` in `src/scene/buildings.ts`. Project its corners with the same `SceneCamera` as the wall, clip it to the card bounds, and attach its shape immediately after its host wall in the existing far-to-near face ordering. This keeps the wall behind the window and nearer buildings in front of it.
5. **Style the detail.** Draw a contrasting glass pane with a light frame. Apply a very small outward wall offset to avoid z-fighting; do not append new SVG nodes per frame.
6. **Test the prototype.** Add unit tests for azimuth selection, facade midpoint, dimension clamping, sill placement, outward offset, and camera projection. Update the building-render characterization test for the added home-wall detail.

### Stage 1 Acceptance Criteria

- Exactly one window is rendered on the mapped home building's exterior wall.
- It is centered on the wall, remains attached while zooming and rotating, and is hidden when its host wall is back-facing or occluded.
- Nearby buildings can still occlude it; it does not paint over a closer facade.
- Changing sill height moves the glass bottom without changing glass height, and invalid values resolve safely within 0-50 m.
- If no mapped home footprint is available, the window still renders on the synthetic rectangle, with no claim of geographic facade accuracy.

## Stage 2: Configurable Window Geometry

1. Preserve stable source IDs from OpenFreeMap through `RawBuilding` and interpreted/merged building geometry, so Stage 2 can identify non-home targets without relying on array order.
2. Add a typed `windows` config entry in `src/core/config/helios-config.ts` with a building key and `length`, `width`, and `azimuth` values. Keep validation/coercion at the config boundary, matching current Helios conventions.
3. Include the windows config in `VISUAL_CONFIG_KEYS` in `src/card/init.ts`, so edits update the live renderer without rebuilding unrelated data.
4. Add editor controls for adding/removing a window and editing its target, length, width, and azimuth. Keep the centered placement from Stage 1 unless optional placement controls are introduced later.
5. Match azimuth against exterior-edge outward normals using angular distance. Define a tolerance; if no facade matches or the window does not fit, report the issue and do not render a misplaced window.
6. Document the YAML form and units in `docs/CONFIGURATION.md`.
7. Add config validation tests, azimuth-to-facade tests (including north wraparound), fit/error tests, and editor/live-update coverage. Verify multiple windows on one building and windows on separate buildings.

### Stage 2 Acceptance Criteria

- Configured `length` and `width` update the rendered window dimensions in metres.
- `azimuth` selects a matching exterior facade and the window remains planar on that facade.
- Invalid values, missing building keys, non-matching facades, and oversized windows are handled visibly and never render inside the building.
- Live config edits update windows without refetching building footprints or restarting the engine.

## Existing Code Paths

- Config schema and resolvers: `src/core/config/helios-config.ts`
- Raw/interpreted footprints and depth-sorted wall shapes: `src/scene/buildings.ts`
- Scene projection and camera zoom: `src/scene/projection.ts`
- Stable SVG node updates: `src/scene/scene-dom.ts`
- Engine building fetch and interpretation: `src/scene/helios-engine.ts`
- Visual-config update signature: `src/card/init.ts`
- Visual editor: `src/editor/editor.ts`
- Existing building render tests: `test/buildings-render.characterization.test.ts`

## Risks To Resolve During Stage 1

- The current `Building` model stores a footprint and height but not a stable ID or facade. Stage 1 avoids this limitation by targeting `isHome`; Stage 2 must not rely on array indices, since sorting, filtering, and merging can change them.
- Concave footprints and simplified collinear edges need tests so azimuth matching is deterministic and does not use a courtyard edge.
- An untagged/fallback home has a synthetic footprint; it can support a demo window, but the editor should distinguish it from a real mapped building.