# Window Direct-Sun and Shading Specification

## Scope

This specification defines how Helios determines and visualizes direct sunlight on a window. It does not command blinds or covers. Helios is currently a visualization card and has no cover-service control path; automation and actuator positioning are a separate integration concern.

“No direct sun” and “shaded” are different conditions. A sun behind the facade or below the horizon is not direct illumination, but does not prove that an otherwise sun-facing window is physically obstructed.

## Inputs and Coordinate Convention

- Sun azimuth `phiSun`: degrees clockwise from true north, matching `getSunPosition()`.
- Sun altitude `alpha`: degrees above the astronomical horizon.
- Window outward azimuth `phiWindow`: degrees clockwise from true north.
- Sill height `s`: floor to bottom edge of glass, in metres. The current config key is `window-sill-height`, default `0`.
- Glass height `H`: bottom to top of glass, in metres. This is independent of sill height.
- A window plane and the modeled building/overhang geometry in local east, north, up coordinates.

The current Stage 1 window uses a fixed `272°` outward azimuth, fixed glass dimensions, and the configurable sill. Its building footprint may be a synthetic rectangular proxy, so any shade result is only as accurate as that geometry.

## Direct-Sun Eligibility

Compute the signed shortest angular difference:

$$\Delta\phi = ((\phi_{sun} - \phi_{window} + 540) \bmod 360) - 180$$

The facade faces the sun when $|\Delta\phi| < 90^\circ$. At or beyond $90^\circ$, classify the result as `NO_DIRECT_SUN` because the sun is behind or exactly edge-on to the facade. Do not label it “unshaded.”

The sun must also clear the local horizon. Use the existing terrain horizon profile when available:

$$\alpha > \max(0^\circ, \text{terrainHorizon}(\phi_{sun}))$$

If a user-configurable obstruction threshold is added later, combine it as another lower bound and document that it is an approximation, distinct from modeled building occlusion. A sun below the applicable horizon is `NO_DIRECT_SUN`.

## Window Occlusion and Visual State

Azimuth and altitude eligibility alone cannot tell whether another building shades the glass. Test visibility from points or regions across the window toward the sun, against the extruded building geometry. Use a small ray-origin offset outside the host wall to avoid self-intersection, and ignore the host facade while still allowing other parts of the host building to block rays where appropriate.

The sun direction in east/north/up coordinates is:

$$\vec{S} = (\cos\alpha\sin\phi_{sun},\; \cos\alpha\cos\phi_{sun},\; \sin\alpha)$$

Prefer projecting blocker geometry onto the window plane and computing the unobstructed glass-area fraction. A fixed sample grid is a simpler first implementation, but its state is approximate and may miss narrow shadows; keep the sampling resolution deterministic and document it if that approach is used.

Let `sunlitFraction` be the fraction of glass with an unobstructed path to the sun. Report these states:

| Condition | State | Visualization |
|---|---|---|
| Sun fails facade or horizon eligibility | `NO_DIRECT_SUN` | Neutral glass; distinguish from obstruction shade. |
| `sunlitFraction` is effectively 1 | `SUNLIT` | Bright/warm glass. |
| `sunlitFraction` is between 0 and 1 | `PARTIALLY_SHADED` | Show the lit fraction distinctly from the shaded fraction. |
| `sunlitFraction` is effectively 0 | `FULLY_SHADED` | Dark/cool glass. |

Use a documented numerical epsilon near 0 and 1 to prevent floating-point noise from flickering between states. Cloud attenuation is separate from geometric shading: clouds may reduce direct-light intensity but are not building blockers.

## Floor-Penetration Geometry

For a direct ray entering through glass at height `z` above the floor, its horizontal penetration measured inward along the facade normal is:

$$d_{normal}(z) = \frac{z\cos(\Delta\phi)}{\tan(\alpha)}$$

This applies only when the sun is in front of the facade and above the horizon. The previous inverse cosine factor is incorrect: as the sun approaches a grazing angle, the component of its path into the room decreases.

For glass with sill height `s` and height `H`, the idealized floor-beam interval is bounded by:

$$d_{bottom} = \frac{s\cos(\Delta\phi)}{\tan(\alpha)}, \qquad
d_{top} = \frac{(s+H)\cos(\Delta\phi)}{\tan(\alpha)}$$

Clamp or omit results beyond a configured room-depth limit, and guard near-zero solar altitude before evaluating the tangent. This estimates where an unobstructed beam reaches the floor; it is not itself an occlusion test or a blind-position calculation.

## Structural Obstructions

### Side Walls, Pillars, and Neighboring Buildings

Model these as geometry and include them in the ray/visibility test. User-configured angular blind spots may be offered as a coarse manual override, but they must not be described as exact physical shade unless they encode actual dimensions and placement. A blocked result is `FULLY_SHADED` or `PARTIALLY_SHADED` according to affected glass area.

### Overhangs and Eaves

An elevation cutoff cannot be inferred from “deep overhang” alone. Exact evaluation requires overhang depth, vertical offset from the glass, lateral extent, and orientation. Until that geometry is represented, report overhang shading as unsupported rather than inventing an elevation threshold.

## Out of Scope

- Calling Home Assistant `cover` services or moving a blind to a percentage.
- Inferring a cover percentage from penetration depth without room geometry, cover type, and actuator calibration.
- Accounting for unmodeled trees, neighboring structures, interior furnishings, diffuse sky light, or measured glass transmittance.
- Claiming real-property accuracy when the window or building is represented by a synthetic rectangle.
