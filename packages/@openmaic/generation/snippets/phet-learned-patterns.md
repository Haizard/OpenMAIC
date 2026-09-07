# PhET Learned Patterns (from 45 simulations)

These patterns were extracted by analyzing 45 PhET HTML5 simulations (16 chemistry, 16 physics, 10 math, 3 biology). The AI should follow these when generating simulations.

## Dominant Color Palette (used across ALL PhET sims)

### UI Colors
- **Background**: `rgb(245, 245, 245)` — light gray (most common: 44 occurrences)
- **Panel background**: `rgb(214, 237, 249)` — light blue (15 occurrences)
- **Control area**: `rgb(229, 243, 255)` — lighter blue
- **Button gray**: `rgb(200, 200, 200)` — medium gray (27 occurrences)
- **Text dark**: `rgb(40, 40, 40)` — near-black
- **Text medium**: `rgb(100, 100, 100)` — gray
- **Text light**: `rgb(160, 160, 160)` — light gray

### Accent Colors
- **Green (active/success)**: `rgb(0, 179, 0)` — bright green (13 occurrences)
- **Orange (warning)**: `rgb(255, 85, 0)` — PhET orange (15 occurrences)
- **Blue (info)**: `rgb(71, 207, 255)` — bright blue (17 occurrences)
- **Dark blue**: `rgb(50, 145, 184)` — teal blue (14 occurrences)
- **Purple**: `rgb(27, 0, 241)` — deep purple (17 occurrences)

### Chemistry-Specific Colors
- **Water**: `rgb(218, 255, 255)` — very light cyan
- **Acid**: `rgb(255, 200, 0)` — yellow-orange
- **Base**: `rgb(0, 179, 0)` — green
- **Indicator (neutral)**: `rgb(200, 200, 200)` — gray
- **Metal**: `rgb(180, 180, 180)` — silver gray

### Physics-Specific Colors
- **Wire/conductor**: `rgb(180, 180, 180)` — silver
- **Battery positive**: `rgb(255, 0, 0)` — red
- **Battery negative**: `rgb(0, 0, 0)` — black
- **Current flow**: `rgb(255, 255, 0)` — yellow dots
- **Force vector**: `rgb(255, 0, 0)` — red arrow
- **Velocity vector**: `rgb(0, 200, 0)` — green arrow

## UI Component Patterns

### Slider Pattern (220 occurrences)
- **Track**: Horizontal bar, 4px height, gray background
- **Thumb**: Circular, 16px diameter, white fill with gray border
- **Active state**: Thumb turns blue when grabbed
- **Range display**: Numeric value shown next to slider
- **Keyboard**: Arrow keys for ±1, Shift+Arrow for ±0.1, Home/End for min/max

### Button Pattern (171 PushButtons)
- **Shape**: Rounded rectangle, 8px border-radius
- **Colors**: White fill, gray border, blue highlight on hover
- **Size**: Minimum 36px height for touch targets
- **States**: Normal → Hover (lighter) → Pressed (darker) → Disabled (grayed out)

### Reset Button Pattern (71 occurrences)
- **Always present** in bottom-right corner
- **Icon**: Circular arrow ↻
- **Behavior**: Resets ALL state to initial values
- **Sound**: Click sound on press
- **Accessibility**: "Reset All" with Alt+R shortcut

### ComboBox/Dropdown Pattern (90 occurrences)
- **Arrow indicator**: Down-pointing triangle
- **List**: Appears below button, max 6 items visible
- **Selection**: Blue highlight on hovered item
- **Keyboard**: Up/Down arrows to navigate, Enter to select, Escape to close

### RadioButton Pattern (241 occurrences)
- **Shape**: Circle, 16px diameter
- **Selected**: Filled blue circle inside white circle
- **Group**: Mutually exclusive within group
- **Layout**: Horizontal row or vertical column

## Layout Architecture

### Standard PhET Screen Layout
```
┌─────────────────────────────────────────────┐
│  Screen Title (top-left)                     │
├─────────────────────────────────────────────┤
│                                              │
│   PLAY AREA (left/center, ~60% width)        │
│   ─ Main visualization, apparatus, objects   │
│   ─ Interactive elements, drag targets       │
│                                              │
│   CONTROL AREA (right, ~40% width)           │
│   ─ Sliders, buttons, checkboxes             │
│   ─ Presets, options                          │
│   ─ Live data displays                       │
│                                              │
├─────────────────────────────────────────────┤
│  [Reset All] ← bottom-right                  │
└─────────────────────────────────────────────┘
```

### Key Layout Rules
1. **Play area gets priority** — always the largest section
2. **Controls on the right** — standard position for sliders/buttons
3. **Reset in bottom-right** — consistent placement
4. **No overlapping** — controls never cover the visualization
5. **Responsive** — scales with window size

## Animation Patterns

### Timing
- **requestAnimationFrame**: Used for all continuous animations (50 occurrences)
- **setTimeout**: Used for delayed actions (67 occurrences)
- **Easing**: Smooth transitions between states (30 occurrences)

### Particle Systems
- **Atoms/molecules**: Circles with CPK colors, random motion
- **Bubbles**: Small circles rising with wobble, fading at top
- **Light rays**: Straight lines with arrowheads
- **Waves**: Sinusoidal curves with amplitude/frequency control

### State Transitions
- **Slider → visualization**: Immediate update (no delay)
- **Preset selection**: Smooth transition over 0.3-0.5 seconds
- **Reset**: Instant return to initial state

## Accessibility Patterns (from 466 accessibleName, 248 accessibleHelpText)

### Every Interactive Element Has
- `accessibleName` — describes what the element is
- `accessibleHelpText` — describes what it does
- `pdomOrder` — logical tab order
- `pdomVisible` — can be hidden from screen readers

### Screen Reader Support
- Play area summary: "A [description] with [controls]"
- Control area summary: "Controls for [what they control]"
- Current details: "Currently, [state description]"
- Interaction hint: "Try [suggested action]"

### Keyboard Shortcuts
- **Tab**: Move to next interactive element
- **Shift+Tab**: Move to previous element
- **Arrow keys**: Adjust sliders, navigate within groups
- **Space/Enter**: Activate buttons
- **Escape**: Close dialogs
- **Home/End**: Jump to min/max values
- **Alt+R**: Reset all

## Chemistry-Specific Patterns

### Solution Representation
- **Beaker**: Trapezoid shape, transparent glass effect
- **Liquid**: Colored fill with meniscus curve at top
- **Dropper**: Glass tube with rubber bulb
- **pH scale**: Rainbow gradient from red (0) to purple (14)
- **Ion particles**: Small colored circles (H₃O⁺ = blue, OH⁻ = red)

### Molecular Visualization
- **Atoms**: Colored spheres with CPK colors
- **Bonds**: Lines between atoms (single, double, triple)
- **Electron clouds**: Semi-transparent regions
- **3D rotation**: OrbitControls for mouse/touch

## Physics-Specific Patterns

### Force/Motion Visualization
- **Vectors**: Arrows proportional to magnitude
- **Color coding**: Red = force, Green = velocity, Yellow = acceleration
- **Grid**: Light background grid for spatial reference
- **Trajectory**: Dotted line showing path history

### Circuit Visualization
- **Wires**: Gray lines with connection points
- **Battery**: Two parallel lines (long = +, short = -)
- **Resistor**: Zigzag line
- **Current**: Moving dots along wires
- **Voltmeter**: Parallel connection, V symbol
- **Ammeter**: Series connection, A symbol

### Wave Visualization
- **Transverse waves**: Sinusoidal curves
- **Longitudinal waves**: Compression/rarefaction patterns
- **Interference**: Overlapping wave patterns
- **Color**: Blue for waves, white for medium

## Math-Specific Patterns

### Graphing
- **Axes**: Black lines with arrowheads
- **Grid**: Light gray lines
- **Labels**: Axis titles at ends
- **Points**: Colored circles on the graph
- **Lines**: Colored, with equation labels

### Geometry
- **Shapes**: Colored fill with transparent border
- **Angles**: Arc indicators with degree labels
- **Lengths**: Dimension lines with measurements
- **Protractor**: Semi-circle with degree marks

## Biology-Specific Patterns

### Cell Visualization
- **Cell membrane**: Double line, slightly transparent
- **Nucleus**: Large circle inside cell
- **Organelles**: Smaller circles/structures
- **Proteins**: Colored blobs that move along paths

### Molecular Biology
- **DNA**: Double helix (simplified as ladder)
- **RNA**: Single strand
- **Ribosome**: Large oval that moves along mRNA
- **Proteins**: Colored shapes that fold
