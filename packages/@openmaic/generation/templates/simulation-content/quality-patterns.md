# Quality Patterns for Educational Simulations

This document extracts the design patterns that make PhET, ScienceLab 3D, and ChemCollective simulations feel polished and effective. The AI should follow these patterns when generating any simulation.

## 1. Visual Quality Patterns (from PhET)

### Color System
- **pH Scale**: Use a smooth gradient from red (pH 0) → orange (2) → yellow (4) → green (7) → cyan (9) → blue (11) → purple (14)
- **Solution colors**: Use realistic liquid colors — not neon/bright. Coffee is brown, blood is dark red, orange juice is orange, milk is white, spit is clear, drain cleaner is bright yellow
- **Glass effects**: Transparent with subtle edge highlights, not opaque white outlines
- **Liquid surface**: Show a meniscus (curved top surface) for realism
- **Background**: Dark blue-gray (`#1a1a2e` or `#1E293B`), never pure black or pure white

### Rendering Approach
- PhET uses SVG (vector), but for Canvas simulations:
  - Use `ctx.createLinearGradient()` for glass/liquid surfaces
  - Use `ctx.createRadialGradient()` for flames, lights, glowing effects
  - Use `ctx.shadowBlur` for soft shadows on apparatus
  - Use anti-aliased curves (bezierCurveTo, quadraticCurveTo) not jagged lines
  - Minimum 2px stroke width for readability

### Typography
- Monospace font for numbers (`'JetBrains Mono', 'Courier New', monospace`)
- Sans-serif for labels (`'Inter', 'Segoe UI', sans-serif`)
- Minimum 12px for readability, 14px for important values
- High contrast: white/light text on dark backgrounds

## 2. Interaction Patterns (from PhET)

### Slider Design
- **Immediate response**: Every slider change updates the visualization instantly (no lag, no "apply" button)
- **Smooth animation**: When a preset is applied, values transition smoothly (not jumps)
- **Visual feedback**: Slider thumb changes color when active
- **Keyboard accessible**: Arrow keys for fine adjustment, Shift+Arrow for coarse, Home/End for min/max
- **Touch-friendly**: Minimum 44px touch target, enlarged thumb on mobile

### Drag and Drop
- **Snap to grid**: Objects snap to logical positions when released
- **Visual highlight**: Target areas glow/highlight when draggable object is nearby
- **Drop animation**: Smooth transition when object settles into position
- **Undo support**: Double-tap or long-press to return object to original position

### Button States
- **Clear state indication**: Play (▶), Pause (⏸), Reset (↻) — always clear what clicking does
- **Disabled state**: Gray out buttons that can't be used right now
- **Active state**: Highlight the currently active mode
- **Sound feedback**: Click sounds on interaction (optional but adds polish)

## 3. Educational Design Patterns (from PhET)

### Multiple Representations
Show the same concept in multiple ways simultaneously:
- **Visual**: The physical apparatus (beaker, test tube, circuit)
- **Numerical**: Real-time values (pH = 7.0, Voltage = 12V)
- **Graphical**: Charts/graphs that update in real-time
- **Symbolic**: Chemical equations, mathematical formulas
- **Molecular** (optional): Particle-level view showing what's happening at atomic scale

### Implicit Guidance
- Limit controls to productive exploration (don't let students break the simulation)
- Use visual cues (arrows, highlights, color changes) to direct attention
- Provide presets that demonstrate key concepts
- Show "off-scale" indicators when values go beyond display range

### Scaffolding
- Start simple, add complexity gradually
- Use checkboxes to toggle advanced features (particle counts, ratios, graphs)
- Provide a "lab notebook" that records observations as students interact
- Show formulas/equations alongside the visualization

### Immediate Feedback
- Every action produces a visible result within 100ms
- Color changes are smooth, not instant
- Animations run at 60fps minimum
- No loading screens after initial load

## 4. Layout Patterns (from PhET + ScienceLab 3D)

### Desktop Layout
```
┌─────────────────────────────────────────────────────┐
│  Title Bar / Safety Banner                           │
├──────────────────────┬──────────────────────────────┤
│                      │  Control Panel                │
│   Visualization      │  ─────────────               │
│   (Canvas/SVG)       │  [Sliders]                   │
│                      │  [Buttons]                    │
│                      │  [Dropdowns]                  │
│                      │  [Checkboxes]                 │
│                      │                               │
│                      │  Live Data Panel              │
│                      │  (top-right, semi-transparent)│
├──────────────────────┴──────────────────────────────┤
│  Data Table / Observation Panel / Equation Display   │
├─────────────────────────────────────────────────────┤
│  [◀ Previous]  Step 2/5  [Next ▶]  [Reset]          │
└─────────────────────────────────────────────────────┘
```

### Mobile Layout (stacked)
```
┌─────────────────────────┐
│ Title / Safety Banner   │
├─────────────────────────┤
│  Live Data (collapsed)  │
├─────────────────────────┤
│                         │
│   Visualization         │
│   (Canvas)              │
│                         │
├─────────────────────────┤
│  Control Panel          │
│  (scrollable, max 40vh) │
├─────────────────────────┤
│  Navigation Bar         │
└─────────────────────────┘
```

### Key Layout Rules
1. Visualization gets at least 50% of screen space
2. Controls never overlap the visualization
3. Live data is always visible (fixed position or top-right overlay)
4. Navigation is always at the bottom (sticky)
5. Touch targets are minimum 44px

## 5. Animation Patterns (from ScienceLab 3D)

### Timing
- **Pour animation**: 1-2 seconds for liquid transfer
- **Color transition**: 0.5-1 second for pH/indicator color change
- **Bubble animation**: Continuous loop while gas is produced, 2-4 seconds to rise
- **Precipitate settling**: 2-3 seconds for particles to fall to bottom
- **Flame animation**: Continuous flicker at 15-20fps (subtle random variation)
- **Temperature change**: 0.5 second smooth transition on thermometer

### Particle Systems
- **Bubbles**: Random size (2-6px radius), rise with slight wobble, fade at top
- **Precipitate**: Random size (1.5-3px), fall with gravity, settle at bottom
- **Gas cloud**: Expand from source, fade over 2 seconds
- **Splashes**: 3-5 droplets on impact, parabolic paths, fade quickly

### State Transitions
- Use `requestAnimationFrame` for smooth 60fps animation
- Interpolate values (lerp) instead of jumping
- Add easing (ease-in-out) for natural feel
- Pause animation when tab is not visible (visibility API)

## 6. Chemistry-Specific Patterns (from ChemCollective + PhET)

### Accurate Chemistry
- **pH calculation**: Use proper Henderson-Hasselbalch for weak acids, direct calculation for strong acids
- **Color mapping**: pH → color using standard indicator ranges
- **Concentration**: Show both molarity and particle count
- **Equations**: Always show balanced equations with states of matter (aq), (s), (g), (l)
- **Safety**: Always show hazard warnings before dangerous steps

### Common Apparatus Colors
- **Glass**: Semi-transparent white/blue (`rgba(180, 220, 255, 0.3)`)
- **Metal (iron/steel)**: `#777` to `#555` gradient
- **Copper**: `#B87333`
- **Rubber (stopper)**: `#8B4513` (brown)
- **Wooden (splint)**: `#D2B48C`
- **Ceramic (crucible)**: `#F5F5DC`

### Liquid Colors
- **Water**: Clear with slight blue tint (`rgba(100, 150, 255, 0.3)`)
- **Acid (HCl)**: Clear with slight yellow (`rgba(255, 255, 200, 0.3)`)
- **Base (NaOH)**: Clear with slight blue (`rgba(200, 200, 255, 0.3)`)
- **Copper sulphate**: Blue (`rgba(0, 100, 255, 0.5)`)
- **Iron(II) sulphate**: Green (`rgba(0, 150, 0, 0.4)`)
- **Potassium permanganate**: Deep purple (`rgba(128, 0, 128, 0.6)`)
- **Universal indicator**: Rainbow gradient based on pH

## 7. Physics-Specific Patterns (from PhET)

### Measurement Instruments
- **Voltmeter/Ammeter**: Analog dial with moving needle + digital readout
- **Stopwatch**: Large digits, start/stop/reset buttons
- **Ruler**: Graduated marks with movable markers
- **Thermometer**: Mercury column with scale marks
- **Protractor**: Semi-circle with adjustable angle lines

### Force/Motion Visualization
- **Velocity vectors**: Arrows proportional to speed, colored by direction
- **Force vectors**: Red arrows from point of application
- **Acceleration**: Yellow arrows, separate from velocity
- **Trajectory**: Dotted line showing path history
- **Grid**: Light background grid for spatial reference

## 8. Accessibility Patterns (from PhET)

- Every interactive element has an ARIA label
- Keyboard navigation follows logical tab order
- Screen reader descriptions explain what changes
- Color is never the only way to convey information (add text/patterns)
- High contrast mode available
- Reduced motion option for animations
