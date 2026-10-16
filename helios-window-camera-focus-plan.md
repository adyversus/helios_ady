# Selected-Window Camera Focus Plan

## Scope

Add an opt-in behavior that turns the camera to face a selected home window. When selection changes, the camera smoothly rotates to the exterior side of that window's resolved facade while keeping the home at the viewport center. Preserve the current pitch and scene zoom.

This is a camera-bearing change, not a camera pan: the window is brought into view by facing its wall, but is not promised to sit at the exact viewport center. Default the option to off so existing window selection, chart, and camera behavior remains unchanged.

## Behavior Contract

- Add `focus-window-on-select`, a boolean config option defaulting to `false`, exposed both in YAML and as a visual-editor toggle.
- Place the visual-editor toggle in the existing UI/map settings beside auto-rotate and camera lock. Use the same config key for both editor and YAML so they cannot disagree.
- Focus only when a different window becomes selected. Re-clicking the selected window keeps its current day-curve toggle behavior and does not restart the camera animation.
- Use the resolved physical facade azimuth (`geometry.azimuthDeg`), not an unresolved requested azimuth. Given the `SceneCamera` world-axis convention, the bearing that places the camera outside the facade is `(180 - azimuthDeg + 360) % 360`.
- Animate along the shortest wrapped bearing difference; do not change pitch or zoom.
- A real manual rotate gesture cancels focus immediately and takes control. A page-scroll touch does not cancel focus.
- If window geometry is unavailable, leave the camera unchanged.
- `camera-locked` remains authoritative: selection must not move a locked camera or silently unlock it.
- Treat focus as user activity so an enabled idle auto-rotate waits its normal inactivity interval before resuming. Re-sync the orbit from the focused bearing to avoid a snap.
- Persist the completed camera pose through the existing per-card camera-pose storage. Do not persist intermediate animation frames.
- Retain the existing selected-window ID and UI-state persistence behavior.

## TDD Principles

- Work in small behavior slices. For each slice, first add the smallest test that expresses the required behavior and confirm it fails for the expected reason; then implement the minimum production change to pass it; refactor only while the tests remain green.
- Keep bearing-target and shortest-angle calculations in a pure, directly testable unit. Test observable inputs and outputs rather than private implementation details.
- Test selection integration at the behavior boundary: changed selection may request focus, repeated selection must not, and disabled/locked focus must leave camera pose unchanged.
- Make animation tests deterministic with a controllable animation-frame clock or equivalent scheduler. Cover interpolation, shortest-path wraparound, replacement/cancellation, completion persistence, and teardown without wall-clock sleeps.
- Add regression tests for every discovered edge case before fixing it. Keep the existing behavior tests green, especially repeated-window selection and day-curve toggling.
- Run the narrow test for each red/green cycle. Run typecheck, lint, the full test suite, and production build at the final integration gate.

## Implementation Sequence

### 1. Config and Selection Trigger

- **Red:** Add config tests for default-off and explicit opt-in, editor tests for toggle rendering/change persistence, and selection behavior tests proving that only a changed ID requests focus. Confirm they fail before changing production code.
- **Green:** Add `focus-window-on-select` to `HeliosConfig`, expose it beside auto-rotate and camera lock in the editor, add localized label/help strings using the existing i18n pattern, document YAML and editor behavior in `docs/CONFIGURATION.md`, and connect the selection-change path to focus only when enabled.
- Keep the existing repeated-selection day-curve toggle untouched. Include the key in the visual-config update path only if needed for live edits; changing the option must not re-fetch building data or invalidate window geometry.
- **Refactor:** Remove test scaffolding or duplicated branching while keeping the behavior tests green.

**Gate:** Config tests verify the default-off behavior and explicit opt-in. Selection tests verify only a changed ID requests focus and repeated selection retains its current behavior.

### 2. Camera Focus API and Animation

- **Red:** Add pure tests for cardinal facade-to-bearing mapping, shortest signed delta across 0/360, and preserving pitch. Add deterministic animation tests for progress, replacement/cancellation, and completion; confirm failures are specific to the missing behavior.
- **Green:** Add a narrow engine API for focusing a resolved window, using its physical facade azimuth and current renderer bearing. Keep camera animation ownership in the engine/renderer camera path, not in the card or window renderer.
- Animate to the target with bounded duration and easing. Cancel or replace an in-flight focus when another window is selected. A manual rotate gesture cancels focus; the drag-end path persists the user's pose.
- On pause or card detach, cancel the animation and persist the frozen current pose once, not every intermediate frame. On resume, leave that pose in place rather than restarting an old target.
- Return without moving for a locked camera or a window with no resolved geometry. Integrate auto-rotate inactivity and pose persistence at animation completion; do not write every animation frame to local storage.
- **Refactor:** Consolidate animation lifecycle handling only after the focused tests pass; keep the camera API narrow.

**Gate:** Unit tests cover cardinal facade-to-bearing mapping, wraparound/shortest-path cases, preserving pitch, lock/no-geometry no-ops, and cancellation/replacement behavior.

### 3. Rendering and Lifecycle Integration

- **Red:** Add behavior-level integration tests proving each animation frame updates the camera and projected overlays, and that disable/config changes, teardown, and pause stop future frames. Confirm the tests fail against the unintegrated path.
- **Green:** Route each animation frame through the existing camera pose setter and standard coalesced renderer redraw, keeping the basemap and SVG overlays aligned. Use the HUD's existing map-transform callback to refresh projected overlays during motion.
- Ensure disable/config changes, card teardown, and renderer pause do not leave an animation frame running.
- **Refactor:** Remove redundant redraw or lifecycle wiring if tests show the existing renderer/engine hooks already provide it.

**Gate:** Renderer/engine tests verify redraw and transform callbacks during focus, and no callbacks after teardown.

### 4. Documentation and Verification

- Add the option to the camera section of `docs/CONFIGURATION.md`, stating that it faces the selected window but keeps the home centered.
- Verify the option off leaves selection behavior unchanged; verify focus on a window change; verify same-window re-click does not refocus; verify lock and auto-rotate semantics. Each requirement must have an automated test before the full suite is run.
- Run focused camera/window tests, then typecheck, lint, the full test suite, and production build.
- Check a live multi-window scene for south, north, east, and west facades, including a rapid sequence of window selections.

**Gate:** All automated checks pass and the live scene remains visually aligned through the camera animation.

## Current Code Ownership

- Config schema and resolvers: `src/core/config/helios-config.ts`
- Window selection and click semantics: `src/helios-card.ts`
- Window geometry and resolved facade direction: `src/scene/window-markers.ts`, `src/scene/helios-engine.ts`
- Camera pose, renderer redraw, and projection: `src/scene/helios-engine.ts`, `src/scene/renderer.ts`, `src/scene/projection.ts`
- Camera documentation: `docs/CONFIGURATION.md`
- Existing focused tests: `test/window-markers.test.ts`, `test/scene-zoom.test.ts`

## Out of Scope

- Panning the camera target so the selected window itself lands at the viewport center. The current projection anchors the home at viewport center; target translation must be designed across the basemap, buildings, shadows, HUD, and hit testing as a separate feature.
- Changing pitch or zoom automatically.
- Moving a locked camera or changing camera-lock configuration.
- Changing window selection, curtain evaluation, chart selection, or physical curtain controls.