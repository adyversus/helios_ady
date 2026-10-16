# Window Button Progress Indicator Plan

## Goal

Show each runtime window's curtain-closed percentage as a compact progress indicator inside its existing button, and remove the numeric percentage from visible button and tooltip text. Preserve the button's current interactions and retain the open percentage in its accessible label.

## Proposed Appearance

- Keep the window label visible; remove the visible `N% open` suffix and numeric percentage from the tooltip.
- Add a thin progress track along the inside bottom edge of each available window button.
- Fill the track according to the closed portion (100% minus the open percentage): empty at 100% open, partially filled for intermediate values, and full at 0% open.
- Keep unavailable windows' existing visible unavailable text and do not show a misleading progress value.
- Use a decorative CSS `::before` pseudo-element driven by a clamped CSS custom property. This avoids extra per-chip DOM and does not add a text row or increase grid height.
- Match the temperature and humidity chips' compact dimensions: 106 px wide with the same natural height and shared padding. The responsive grid adjusts column count to the card's available width and caps at four columns.
- Place a 2 px progress track against the inside bottom edge of the button. It overlays the bottom inset without adding padding or increasing the chip height.

## Implementation Steps

1. **Update the runtime chip content**
   - In `src/helios-card.ts`, pass the complement of the numeric open percentage (the closed portion) to the shared corner-chip renderer as a window-specific CSS custom property.
   - Show only the window label for available windows; preserve the existing unavailable message.
   - Set a progress-specific class/property only when the window has a valid definition, geometry, and evaluation percentage.
   - Clamp the visual fill to the 0–100 range. Window evaluations currently produce an integer percentage; do not recompute curtain state in the UI.

2. **Preserve accessible information and current behavior**
   - Keep the percentage and exposure in the chip's accessible label, but remove the numeric percentage from the visible tooltip and button text.
   - Treat the pseudo-element as decorative; do not add a nested progressbar role inside the existing button.
   - Preserve click, chart-selection, details, keyboard, selected-state, exposure-icon, and unavailable-state behavior.

3. **Style the progress track**
   - Add window-specific styles in `src/css/helios-card-scene-css.ts` without changing cost, temperature, or humidity chips.
   - Use the window chip color for the filled portion and a muted theme-aware color for the remainder of the track.
   - Anchor the slim track at the inner bottom edge of the compact chip, in the space below the centered icon/text. Avoid adding a second content row or increasing chip height.
   - Keep the window chips the same height as temperature/humidity chips for visual consistency; check that the track does not overlap the label or icons.
   - Keep the fill update immediate rather than animating it, so the visual value cannot appear stale.

## Risks and Considerations

- An empty track at 0% must remain distinguishable from an unavailable window, which should have no progress track and retains its unavailable status text.
- The visible percentage disappears, so the accessible label must continue to report the numeric value. The tooltip should no longer display a percentage.
- A second text row or unconditional button-height increase could make the top controls cover too much of the scene, especially on narrow cards or with many windows; prefer a bottom-edge track and check the 16-window case.
- Long labels must continue truncating cleanly without being covered by the progress track or status icon.
- The compact matching size reduces the window button hit area from its previous 44 px minimum to the weather-chip height; verify it remains usable on touch screens.
- The chip already uses `::after` for its active glow; use `::before` for the track and avoid changing the glow or selected-state styling.

## Validation

- Verify 0%, partial, and 100% open states have inverse fill widths: 100% open is empty, while 0% open is full.
- Verify unavailable or unevaluated windows show no progress track and keep their unavailable message.
- Verify the visible button text and tooltip no longer contain the percentage, while the accessible label still includes the percentage and exposure.
- Verify the existing button click, keyboard, chart selection, details, selected-state, and hidden-chip behavior is unchanged.
- Verify one, eight, and sixteen windows at desktop and phone widths; check for text/bar overlap, excessive scene coverage, and horizontal overflow.
- Run the focused UI tests, typecheck, lint, and production build.
