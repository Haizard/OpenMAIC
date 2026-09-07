Create a simulation widget for: {{conceptName}}

## Concept Overview

{{conceptOverview}}

## Key Points

{{keyPoints}}

## Variables to Expose

{{variables}}

## Design Idea

{{designIdea}}

## Language

{{languageDirective}}

{{#if procedureSteps}}
## Practical Lab Procedure (IMPORTANT — use this to generate a step-through lab simulation)

This is a practical experiment. Generate a **step-through lab procedure simulation** with the apparatus drawing functions, step sequencer, reaction animations, observation panel, and equation display described in the system prompt. Do NOT generate a generic parameter-explorer.

### Objective

{{objective}}

### Procedure Steps

{{procedureStepsText}}

### Apparatus

{{apparatusList}}

### Chemicals / Materials

{{chemicalsList}}

{{#if safetyNotes}}
### Safety Notes

{{safetyNotesText}}

{{/if}}
{{#if equations}}
### Key Equations

{{equationsText}}

{{/if}}
{{#if conclusionQuestions}}
### Conclusion Questions (show at the end)

{{conclusionQuestionsText}}

{{/if}}
{{/if}}
---

Generate a complete, interactive HTML simulation with these MANDATORY features:

{{#if procedureSteps}}
### Structure (Practical Lab Mode)
1. **Embedded JSON config** in `<script type="application/json" id="widget-config">`
2. **Step panel** (left sidebar) showing all procedure steps with completion markers
3. **Lab bench canvas** with apparatus drawn using the reusable drawing functions from the system prompt
4. **Observation panel** below canvas showing Observation → Inference → Conclusion for each step
5. **Equation display** showing the balanced chemical equation for the current step (rendered with KaTeX)
6. **Safety banner** at the top if safety notes are provided
7. **Navigation bar** at the bottom: Previous / Step counter / Next / Reset
8. **Conclusion questions** section shown after all steps are complete
9. **postMessage listener** for widget actions
10. Mobile-responsive: step panel collapses on narrow screens

### Animation Requirements (Practical Lab)
- Each step should animate when the student clicks "Next":
  - Pouring: liquid stream from source vessel to target vessel, fill level increases
  - Reaction: bubbles appear and rise (gas), liquid color transitions, precipitate settles, temperature changes
  - Testing: splint lights/glows, flame color changes, litmus paper changes color
- Animations should be OBVIOUS — student should clearly see the reaction happening
- After animation completes, the observation panel fills in with typewriter effect
- The chemical equation for the step appears below the canvas

### Step Panel Behavior
- Current step highlighted in blue with a circle marker
- Completed steps show a green checkmark
- Future steps are greyed out
- Clicking "Next" triggers the current step's animation, then auto-advances
- Clicking "Previous" goes back (undo completion)

{{else}}
### Structure (Parameter Explorer Mode)
1. **Embedded JSON config** in `<script type="application/json" id="widget-config">`
2. **Control panel** with sliders for each variable
3. **Canvas visualization** with proper sizing
4. **Preset buttons** for common scenarios

{{/if}}

### Mobile Responsiveness (CRITICAL)
1. **Control panel MUST NOT overlap canvas on mobile**
2. Use `flex-col md:flex-row` layout with proper spacing
3. Control panel: `max-h-[40vh] md:max-h-screen` with overflow scroll
4. Canvas container: `min-h-[300px]` to ensure visibility
5. Touch-friendly controls (44px minimum touch targets)

{{#if procedureSteps}}
### Button Logic (Practical Lab Mode)
1. **Next button:** triggers current step animation, then advances to next step
2. **Previous button:** goes back to previous step
3. **Reset button:** returns to step 1, clears all observations and animations
4. State tracking: `{ currentStep, completedSteps, phase, animationProgress }`

{{else}}
### Button Logic (Parameter Explorer Mode)
1. **Main button MUST handle all states correctly:**
   - "Start" → Starts simulation
   - "Pause" → Pauses running simulation
   - "Restart" → Resets to initial state, then starts fresh
2. **Reset function MUST reset ALL state variables** (position, velocity, time, etc.)
3. Use clear state tracking: `{ running: boolean, ended: boolean, paused: boolean }`

{{/if}}
### Canvas
1. Auto-resize on window resize
2. Clear visualization with grid or guides
3. Real-time data display overlay
4. Proper scaling for different screen sizes

### Interactivity
1. {{#if procedureSteps}}Step-by-step progression with animated transitions{{else}}Real-time updates when sliders change{{/if}}
2. {{#if procedureSteps}}Previous/Next/Reset navigation{{else}}Presets apply and reset simulation{{/if}}
3. Keyboard shortcuts (Space = toggle, R = reset)
4. Touch gestures for mobile

### Live Data Panel
- Include a semi-transparent live data panel in the top-right corner
- Show real-time values: time, pH, temperature, or other relevant variables
- Use monospace font for numbers
- Update every frame in the animation loop

### Keyboard Shortcuts
- Space = play/pause
- R = reset
- N or → = next step (practical mode)
- ← = previous step
- 1-5 = select preset (parameter mode)

### Drag-and-Drop (Practical Mode)
- Make chemicals and equipment draggable
- When a chemical is dropped on a vessel, trigger the corresponding reaction animation
- Visual feedback: highlight the target vessel when dragging over it

### iframe-Optimized Layout
- Width: 100%, height: fills available space
- No scrollbars on the main simulation area
- All controls visible without scrolling
- Use `overflow: hidden` on body, `overflow: auto` on control panels only

{{#if reactionLibraryHint}}
### Reaction Accuracy
{{reactionLibraryHint}}

{{/if}}
### Visual Polish
1. Show current simulation state (running/paused/ended)
2. Animate transitions
3. Clear feedback when simulation ends
4. High contrast colors for visibility