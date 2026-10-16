# Selected Window Name in Timeline Chart Plan

## Goal

Show a compact label at the top-left inside `tb-chart-card` when the curtain, irradiance, temperature, or humidity chart is active. For the curtain chart, identify the selected window by its full readable name instead of repeating the button's short label (for example, show a readable name for `bedroom-room-1` rather than `BR1`). For irradiance, temperature, and humidity, show the localized target label. Keep button labels and chart interactions unchanged.

## Name Resolution

Window evaluations expose both the stable window `id` and the configured button `label`. The configured `label` is the button text and may be abbreviated; the `id` is the stable selection key and may be technical. Do not assume the label is a full name or use it as a selection key.

- **Decision:** derive the curtain chart title from the humanized stable ID. Reuse the existing ID-to-readable-label helper rather than adding a separate configuration field or duplicating separator/capitalization logic.
- If no readable ID or selected entry is available, fall back to the configured label, then the localized generic curtain label.
- Resolve the displayed name by `_selectedWindowId`, not by array position, so reordering does not change the selected window.

## Layout and Behavior

- Render the label inside `.tb-chart-card`, aligned to its top-left corner.
- Show the selected window's full readable name when `_chartTarget` is `curtain`. Show the localized target label when `_chartTarget` is `irradiance`, `temperature`, or `humidity`; leave other chart targets unchanged.
- Keep the label non-interactive and `pointer-events: none` so chart scrubbing, hover, and cursor behavior remain unchanged.
- Use a compact themed pill, a bounded maximum width, and ellipsis for long names. Keep the full name in accessible text (and optionally a tooltip).
- Do not change window-button text, chart data, chart scales, or window selection.

## Implementation Steps

1. Resolve the title during `HeliosCard.render()` only when the curtain chart is active. Find the entry in the already available `windowEvaluations` by `_selectedWindowId`; do not call the engine or parse window configuration a second time.
2. Apply the agreed name-source rule: humanize the selected window ID, while retaining the existing short configured label on the window button. Use the existing localized target-label helper for irradiance, temperature, and humidity.
3. Add a small label element inside `.tb-chart-card`, alongside the existing chart and cursor overlays.
4. Add isolated styles in `src/css/helios-timeline-css.ts` for top-left placement, theme-aware contrast, truncation, and a non-interactive overlay.
5. Ensure the title updates when the selected window changes and is removed or falls back when the selection becomes unavailable.

## Risks and Considerations

- `tb-chart-card` can be shallow, and the chart uses the full plotting area. An overlay may cover a small portion of the curve; keep the title compact and visually distinct. Reserving a dedicated header strip would reduce plot height and require broader chart-layout changes.
- IDs may contain technical or unusual strings. Humanization cannot guarantee a true display name; an explicit full-name config field could be considered if exact user-controlled names are required. Never alter the stored ID or selection key.
- A selected window may become unavailable or disappear during configuration changes. Fall back cleanly rather than displaying a stale name.
- Avoid adding labels to unrelated charts or recomputing window data; the title lookup is a bounded search of at most 16 evaluated windows.

## Validation

- With a selected window whose button label is `BR1` and ID is `bedroom-room-1`, verify the agreed full-name source displays the expected title while the button remains `BR1`.
- Verify the title changes when selecting another window and remains correct after reordering.
- Verify no window title is shown for non-curtain chart targets, and irradiance/temperature/humidity show their localized target labels.
- Verify missing/unavailable selection falls back without errors.
- Verify long names truncate on narrow cards, the title does not intercept pointer input, and the existing chart/hover/scrub behavior remains unchanged.
- Run the focused UI checks, typecheck, lint, and production build.
