# Multi-Window Follow-Up

## Correctness

- [x] Fix chained same-facade overlap detection by collecting all overlapping pairs before invalidating geometry.
- [x] Add a regression test with three windows where the middle window overlaps each neighbor but the outer windows do not overlap each other.
- [x] Show geometry-specific errors on unavailable window chips and in selected-window details instead of leaving the user with only a generic unavailable status.
- [x] Make window geometry cache invalidation robust when `updateConfig()` receives in-place edits to `windows`, using a normalized-definition snapshot.
- [ ] Add tests for config edits that change, reorder, and remove windows while preserving selection by stable ID.

## Performance

- [ ] Separate geometry cache invalidation from evaluation invalidation so changing only global curtain depth does not re-resolve facade geometry.
- [ ] Add a broad-phase occluder filter (for example, cached bounds and ray-direction culling) before detailed sun-ray polygon tests.
- [ ] Benchmark 1, 4, 8, and 16 windows against the maximum building count on target devices and record results.

## Release Validation

- [x] Rebuild `dist/helios.js` from the current source; verify it includes window labels, exposure/open-state icons, selected-window perimeter focus, and per-window curve selection.
- [ ] Add integration coverage for geometry-error visibility, live config updates, selected-window changes, and camera-only cache reuse.
- [x] Run the full test suite, typecheck, lint, and production build before release.