# Step-by-Step Guide: Simulating Curtain Coverage

This document defines the geometry used to draw a simulated top-down curtain overlay for direct sunlight. Helios visualizes the calculated coverage; it does not command a Home Assistant cover.

---

## 1. The Core Trigonometric Formula

To control how far sunlight enters a room, the system calculates the **Sunlight Penetration Depth ($d$)**. This represents the horizontal distance from the window glass pane to the furthest edge of the direct solar footprint on the floor or furniture.

For a sun-facing window, a ray entering at absolute height $z$ above the floor reaches the floor at this distance inward from the glass:

$$d(z) = \frac{z\cos(\Delta\phi)}{\tan(\alpha)}$$

Where:
* **$d$** = Sunlight penetration depth into the room (meters or inches).
* **$z$** = The absolute height above the floor of the glass point (meters or inches).
* **$\alpha$** = The live **Solar Elevation Angle** (the angle of the sun above the horizon, from $0^\circ$ at sunset/sunrise to $90^\circ$ at the zenith).
* **$\Delta\phi$** = The **Azimuth Difference** ($|\phi_{\text{sun}} - \phi_{\text{window}}|$), which is the horizontal angular distance between the sun's position and the perpendicular orientation vector of the window facade.

---

## 2. Inverting the Formula for Automated Target Positioning

To calculate the simulated curtain coverage, define the **Maximum Allowed Comfort Depth ($D_{\text{max}}$)** and solve for the allowed uncovered glass height ($H_{\text{allowed}}$). Let $s$ be the sill height and $H_{\text{total}}$ the glass height. The curtain covers downward from the top, leaving one continuous opening above the sill.

### Step 1: Calculate Allowed Opening Height ($H_{\text{allowed}}$)
$$H_{\text{allowed}} = \operatorname{clamp}\left(\frac{D_{\text{max}}\tan(\alpha)}{\cos(\Delta\phi)} - s, 0, H_{\text{total}}\right)$$

### Step 2: Calculate Covered Fabric Length ($H_{\text{cover}}$)
Subtract the allowed opening height from the total height of the window's glass pane ($H_{\text{total}}$) to find out how much window area needs to be obscured:
$$H_{\text{cover}} = H_{\text{total}} - H_{\text{allowed}}$$

*Note: If the unclamped allowed height is at least $H_{\text{total}}$, the curtain is fully open. If it is zero or less, the curtain covers the full pane. If the sun is behind the facade, below the terrain horizon, or the window is fully shaded, the simulation leaves the curtain open.*

### Step 3: Compute Deployment Percentage ($\%_{\text{closed}}$)
Convert the absolute fabric length into a normalized control value between $0\%$ (Fully Open) and $100\%$ (Fully Closed):

$$\%_{\text{closed}} = \left( \frac{H_{\text{cover}}}{H_{\text{total}}} \right) \cdot 100$$

---

## 3. Practical Example Calculation

### Inputs & Architectural Constraints:
* **Total Window Height ($H_{\text{total}}$):** $1.5\text{ meters}$
* **Max Allowed Comfort Depth ($D_{\text{max}}$):** $1.0\text{ meter}$ (e.g., to keep a desk clear of glare)
* **Solar Elevation Angle ($\alpha$):** $30^\circ$ ($\tan(30^\circ) \approx 0.577$)
* **Azimuth Difference ($\Delta\phi$):** $0^\circ$ (The sun is striking perfectly flush with the window, $\cos(0^\circ) = 1$)

### Execution:
1. **Find $H_{\text{allowed}}$:**
   $$H_{\text{allowed}} = 1.0 \cdot 0.577 \cdot 1 = 0.577\text{ meters}$$
2. **Find $H_{\text{cover}}$:**
   $$H_{\text{cover}} = 1.5 - 0.577 = 0.923\text{ meters}$$
3. **Find Percentage Closed:**
   $$\%_{\text{closed}} = \left( \frac{0.923}{1.5} \right) \cdot 100 \approx 61.5\%$$

**Result:** With a zero sill, to preserve your $1.0\text{m}$ clear floor boundary under these conditions, the simulated curtain covers **$61.5\%** of the glass. A raised sill reduces the allowed uncovered height; when $s \ge D_{\text{max}}\tan(\alpha)/\cos(\Delta\phi)$, the simulation covers the full pane.

## 4. Helios Curtain Shape Simulation

The card draws a curtain shape from the top of the glass down by the calculated coverage percentage and shows a read-only **Curtain** chip with the open percentage. `100% open` means no glass is covered; `0% open` means the whole pane is covered. `curtain-max-depth` is the configured floor-beam limit in metres and defaults to `1.0`; the visual editor displays metres or inches according to Home Assistant's length unit. The overlay and chip are simulations only and do not move a cover.

The penetration formula assumes unobstructed direct sunlight. Helios suppresses the simulated closure when no direct sun reaches the pane and uses its modeled building occlusion for the window state. Partial external shading is conservative; trees, overhangs, room furniture, diffuse light, and blind mechanics are not modeled, so the visual result is exact only within the stated geometric assumptions.
