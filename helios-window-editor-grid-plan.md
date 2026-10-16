# Runtime Window Button Placement Plan

## Goal

Move the existing per-window curtain buttons from the bottom chip row to the top of the runtime card. Preserve the buttons' current labels, telemetry, selection, details, and click behavior. Leave the editor controls and all window forms unchanged.

## Layout

- Place runtime window buttons in a grid at the top of the card, clear of the top-right scene controls.
- Use four columns on wider cards, producing two rows for the common configuration of eight windows.
- Use two columns on narrow cards to keep labels and touch targets usable.
- Continue rendering every configured window up to the existing limit; do not introduce paging or remove button actions.
- Keep cost, temperature, and humidity chips in their existing bottom position.

## Implementation

1. Render window chips in their own top-positioned container, separate from the bottom cost/weather chip row.
2. Reuse the existing per-window curtain-chip renderer so click, selection, status, and accessibility behavior stay the same.
3. Add responsive runtime-card styles for the grid and keep button targets at least 44 px tall.
4. Do not change editor window forms, configuration shape, window limit, or scene calculations.

## Validation

- Verify all configured window chips appear at the top and are absent from the bottom chip row.
- Verify chip activation still selects the same window and opens the same chart/details behavior.
- Verify the common eight-window layout uses four columns and two rows on a wider card.
- Verify narrow cards adapt to two columns without horizontal overflow.
- Run the full test suite, typecheck, lint, and production build.
