# Helios Project: Window Azimuth Vector Extensions

A technical implementation blueprint for injecting custom 2.5D visual window azimuth normals and directional tracking onto building footprints within the [Helios Custom Lovelace Card](https://github.com/ReikanYsora/Helios) environment.

---

## 🏗️ Implementation Architecture

To expand the rendering canvas pipeline with structural elements (windows) that track seasonal sun shading relative to big building obstacles, you must inject three specific layers into the code tree.

```
[src/types.ts] ➔ [src/scene/window-markers.ts] ➔ [src/scene/helios-engine.ts]
 (Schema Update)     (Vector Matrix Generation)     (Animation Render Loop)
```

---

## 🛠️ Step-by-Step Source Files

### 1. Data Schema & Interfaces (`src/types.ts`)
Append this definition to your main interface schema script so that the card validation system parses the custom matrix without throwing dashboard errors.

```typescript
export interface BuildingWindow {
  id: string;
  name: string;
  x: number;          // Relative X offset from building geographic center (meters)
  y: number;          // Relative Y offset from building geographic center (meters)
  azimuth: number;    // Compass heading direction the window faces (0 = North, 180 = South)
  width: number;      // Visual structural width of the window opening (meters)
}

// Ensure your main CardConfig interface includes:
// windows_list?: BuildingWindow[];
```

### 2. The Vector Paint Module (`src/scene/window-markers.ts`)
Create this module from scratch. It uses pure SVG trigonometry to project normal lines outward from the building hull.

```typescript
import { BuildingWindow } from "../types";

export function paintWindowAzimuths(svgLayer: SVGElement, windows: BuildingWindow[], zoom: number) {
  windows.forEach((win) => {
    // Convert azimuth degrees to standard mathematical radians
    const angleRad = (win.azimuth * Math.PI) / 180;
    
    // 1. Calculate the vector trajectory for the directional pointer
    const normalLineLength = 12 * zoom;
    const endX = win.x + Math.sin(angleRad) * normalLineLength;
    const endY = win.y - Math.cos(angleRad) * normalLineLength;

    // 2. Build the Facade Base (Visual Cyan Glass Segment)
    const glassSegment = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const perpX = Math.sin(angleRad + Math.PI / 2) * (win.width / 2) * zoom;
    const perpY = -Math.cos(angleRad + Math.PI / 2) * (win.width / 2) * zoom;

    glassSegment.setAttribute("x1", `${win.x - perpX}`);
    glassSegment.setAttribute("y1", `${win.y - perpY}`);
    glassSegment.setAttribute("x2", `${win.x + perpX}`);
    glassSegment.setAttribute("y2", `${win.y + perpY}`);
    glassSegment.setAttribute("stroke", "#00d2ff"); // Cyan glass core
    glassSegment.setAttribute("stroke-width", "4");
    glassSegment.setAttribute("stroke-linecap", "round");
    
    // 3. Build the Directional Vector Arrow (Amber Azimuth Path)
    const azimuthArrow = document.createElementNS("http://www.w3.org/2000/svg", "line");
    azimuthArrow.setAttribute("x1", `${win.x}`);
    azimuthArrow.setAttribute("y1", `${win.y}`);
    azimuthArrow.setAttribute("x2", `${endX}`);
    azimuthArrow.setAttribute("y2", `${endY}`);
    azimuthArrow.setAttribute("stroke", "#ffaa00"); // Amber tracking line
    azimuthArrow.setAttribute("stroke-width", "2");
    azimuthArrow.setAttribute("stroke-dasharray", "4,2"); // Dashed indicator

    // Mount properties to target container frame
    svgLayer.appendChild(glassSegment);
    svgLayer.appendChild(azimuthArrow);
  });
}
```

### 3. Pipeline Frame Hook (`src/scene/helios-engine.ts`)
Locate your central viewport redraw matrix loop and hook the module directly below solar panel layer updates.

```typescript
import { paintWindowAzimuths } from "./window-markers";

// Inside your main redraw/update loop function:
if (this.config.windows_list && this.config.windows_list.length > 0) {
  paintWindowAzimuths(this.svgElementsLayer, this.config.windows_list, this.currentSceneZoom);
}
```

---

## 📋 Copilot Automation Prompts

To automate this task entirely inside **GitHub Copilot Chat**, copy and issue these exact instructions sequentially:

1. **Prompt 1 (Module Creation):** 
   > "Create a new TypeScript file at `src/scene/window-markers.ts` following the exact architectural code format of the Helios card project. Implement a `paintWindowAzimuths` rendering loop that loops through an array of windows, converts azimuth degrees to radians, renders a cyan window line, and extends an amber dashed projection line perpendicular to the glass representing the window vector direction. Ensure calculations scale cleanly against a `zoom: number` parameter."
2. **Prompt 2 (Engine Hook):**
   > "Open `src/scene/helios-engine.ts`. Import `paintWindowAzimuths` from `./window-markers`. Locate the active canvas draw/render step block (immediately post `paintSolarArrays`) and safely wrap an execution call running against `this.config.windows_list` using the card's active SVG viewport layer and zoom properties."

---

## 🎛️ Sample Dashboard Configuration (8 Windows Matrix)

Paste this directly into your Lovelace raw configuration YAML editor block once code compilation is finished to visually render all 8 tracking zones simultaneously:

```yaml
type: custom:helios-card
windows_list:
  - { id: w1, name: "Living South 1", x: 2, y: -5, azimuth: 180, width: 2.0 }
  - { id: w2, name: "Living South 2", x: 5, y: -5, azimuth: 180, width: 2.0 }
  - { id: w3, name: "Kitchen West", x: -4, y: 1, azimuth: 270, width: 1.5 }
  - { id: w4, name: "Office North", x: -2, y: 5, azimuth: 0, width: 1.8 }
  - { id: w5, name: "Bedroom East 1", x: 4, y: 3, azimuth: 90, width: 1.2 }
  - { id: w6, name: "Bedroom East 2", x: 4, y: 0, azimuth: 90, width: 1.2 }
  - { id: w7, name: "Dining West", x: -4, y: -3, azimuth: 270, width: 1.5 }
  - { id: w8, name: "Attic Skylight", x: 0, y: 0, azimuth: 180, width: 3.0 }
```