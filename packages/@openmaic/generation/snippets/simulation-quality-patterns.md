# Simulation Quality Patterns

Follow these patterns to generate polished, PhET-quality educational simulations.

## Visual Quality
- Use gradients for glass/liquid (createLinearGradient, createRadialGradient) — never flat fills
- Show liquid meniscus (curved top surface) in beakers/test tubes
- Add soft shadows (shadowBlur: 4-8, shadowColor: rgba(0,0,0,0.2))
- Background: dark blue-gray (#1a1a2e or #1E293B), never pure black/white
- Anti-aliased curves (bezierCurveTo, quadraticCurveTo) — no jagged lines
- Minimum 2px stroke width for readability
- Monospace font for numbers, sans-serif for labels
- High contrast: white/light text on dark backgrounds

## Realistic Chemistry Colors
- pH gradient: red(0) → orange(2) → yellow(4) → green(7) → cyan(9) → blue(11) → purple(14)
- Water: rgba(100, 150, 255, 0.3) with slight blue tint
- Copper sulphate: rgba(0, 100, 255, 0.5) — blue
- Iron(II) sulphate: rgba(0, 150, 0, 0.4) — green
- KMnO₄: rgba(128, 0, 128, 0.6) — deep purple
- Glass: rgba(180, 220, 255, 0.3) semi-transparent
- Metal: #555-#777 gradient, copper #B87333

## Interaction Rules
- Every slider change updates visualization within 100ms (no lag, no "apply" button)
- Smooth value transitions (lerp) when presets are applied
- Keyboard: arrows for fine adjust, Shift+arrows for coarse, Home/End for min/max
- Touch targets: minimum 44px
- Clear button states: Play(▶), Pause(⏸), Reset(↻)

## Animation Timing
- Pour: 1-2 seconds liquid transfer
- Color transition: 0.5-1 second
- Bubbles: continuous loop, 2-4 seconds to rise, random size (2-6px)
- Precipitate: 2-3 seconds to settle
- Flame: continuous flicker at 15-20fps
- Temperature: 0.5 second smooth transition
- Use requestAnimationFrame for 60fps, lerp between states

## Multiple Representations (show same concept in multiple ways)
- Visual: physical apparatus (beaker, test tube, circuit)
- Numerical: real-time values (pH = 7.0, V = 12V)
- Graphical: charts/graphs updating in real-time
- Symbolic: chemical equations, formulas (KaTeX)
- Molecular (optional): particle-level view

## Layout
- Visualization gets ≥50% of screen space
- Controls never overlap visualization
- Live data panel: semi-transparent, top-right, always visible
- Navigation bar: always at bottom (sticky)
- Mobile: stacked layout, controls max 40vh with scroll
- Desktop: side panel layout with controls on right

## Physics Instruments
- Voltmeter/Ammeter: analog dial with needle + digital readout
- Stopwatch: large digits, start/stop/reset
- Ruler: graduated marks with movable markers
- Thermometer: mercury column with scale + digital readout
- Force/velocity vectors: colored arrows proportional to magnitude

## Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation follows logical tab order
- Color is never the only information channel (add text/patterns)
- High contrast text on all backgrounds
