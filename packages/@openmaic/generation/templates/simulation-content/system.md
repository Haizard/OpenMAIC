# Simulation Widget Content Generator

Generate a self-contained HTML simulation with embedded widget configuration.

## Output Structure

Your output must be a complete HTML document with:

1. **Standard HTML5 structure**
2. **Embedded widget configuration** in a `<script type="application/json" id="widget-config">` tag
3. **Interactive controls** for variables
4. **Canvas or SVG visualization**
5. **Mobile-responsive design**
6. **postMessage listener** for widget actions (REQUIRED)

## Widget Config Schema

```json
{
  "type": "simulation",
  "concept": "projectile_motion",
  "description": "...",
  "variables": [
    { "name": "angle", "label": "Launch Angle", "min": 0, "max": 90, "default": 45, "unit": "°" }
  ],
  "presets": [
    { "name": "Hit the target", "variables": { "angle": 30, "velocity": 25 } }
  ]
}
```

## CRITICAL: postMessage Listener for Widget Actions

Your HTML MUST include this message listener to respond to widget actions:

```javascript
// Add this script at the end of your HTML
window.addEventListener('message', function(event) {
  const { type, target, state, content } = event.data;

  switch (type) {
    case 'SET_WIDGET_STATE':
      // Update all variables in the state object
      if (state) {
        Object.entries(state).forEach(([key, value]) => {
          // Find the slider/input for this variable and update it
          const slider = document.getElementById(key + '-slider') || document.querySelector('[data-var="' + key + '"]');
          if (slider) {
            slider.value = value;
            // Trigger change event to update simulation
            slider.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }
      break;

    case 'HIGHLIGHT_ELEMENT':
      // Highlight the target element with a pulsing border
      const highlightEl = document.querySelector(target);
      if (highlightEl) {
        highlightEl.style.outline = '3px solid rgba(139, 92, 246, 0.8)';
        highlightEl.style.outlineOffset = '4px';
        highlightEl.style.animation = 'pulse-highlight 2s infinite';
        // Remove highlight after 3 seconds
        setTimeout(() => {
          highlightEl.style.outline = '';
          highlightEl.style.animation = '';
        }, 3000);
      }
      break;

    case 'ANNOTATE_ELEMENT':
      // Show an annotation tooltip near the target element
      const annotateEl = document.querySelector(target);
      if (annotateEl && content) {
        const rect = annotateEl.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'teacher-annotation';
        tooltip.style.cssText = 'position:fixed; top:' + (rect.top - 40) + 'px; left:' + rect.left + 'px; background:rgba(139,92,246,0.95); color:white; padding:8px 12px; border-radius:8px; font-size:14px; z-index:1000; animation:fadeIn 0.3s;';
        tooltip.textContent = content;
        document.body.appendChild(tooltip);
        setTimeout(() => tooltip.remove(), 4000);
      }
      break;

    case 'REVEAL_ELEMENT':
      // Reveal a hidden element
      const revealEl = document.querySelector(target);
      if (revealEl) {
        revealEl.style.display = '';
        revealEl.style.opacity = '1';
      }
      break;
  }
});

// Add this CSS for animations
const style = document.createElement('style');
style.textContent = '@keyframes pulse-highlight { 0%, 100% { outline-color: rgba(139, 92, 246, 0.8); } 50% { outline-color: rgba(139, 92, 246, 0.4); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }';
document.head.appendChild(style);
```

## Element Naming Convention

To make highlight/annotation work, use consistent IDs for controls:
- Sliders: `id="{variable_name}-slider"` (e.g., `id="angle-slider"`, `id="velocity-slider"`)
- Buttons: `id="{action}-btn"` (e.g., `id="start-btn"`, `id="reset-btn"`)
- Displays: `id="{variable_name}-display"` (e.g., `id="acceleration-display"`)

## CRITICAL Design Requirements

### 1. Mobile Layout - NO OVERLAP
- **Control panel MUST NOT overlap with canvas on mobile**
- Use one of these mobile-safe layouts:
  - **Stacked layout**: Control panel on top, canvas below (with proper spacing)
  - **Bottom sheet**: Control panel slides up from bottom on mobile
  - **Side drawer**: Collapsible panel that doesn't block canvas
- Test viewport widths: 320px, 375px, 414px, 768px
- Use `min-height` for canvas to ensure it's visible on mobile
- Control panel should be collapsible on mobile if large

Example mobile-safe layout:
```html
<body class="flex flex-col min-h-screen md:flex-row">
  <!-- Mobile: Full-width, collapsible control panel -->
  <div id="controls" class="w-full md:w-80 shrink-0 overflow-auto max-h-[40vh] md:max-h-screen">
    <!-- Controls here -->
    <button onclick="toggleControls()" class="md:hidden">Hide Controls</button>
  </div>
  <!-- Canvas area gets remaining space -->
  <div class="flex-1 min-h-[300px] relative">
    <canvas id="canvas"></canvas>
  </div>
</body>
```

### 2. Reset Button - MUST WORK CORRECTLY
- **Reset button MUST return simulation to initial state**
- Common bug: Button changes text to "重新开始" but clicking it doesn't reset
- Solution: Use a separate reset function, or check state properly

Correct implementation:
```javascript
let state = { running: false, ended: false, posX: 50, velocity: 0 };

function handleMainButton() {
  if (state.ended) {
    // If simulation ended, reset first
    resetSimulation();
  } else if (state.running) {
    pauseSimulation();
  } else {
    startSimulation();
  }
}

function resetSimulation() {
  state.running = false;
  state.ended = false;
  state.posX = 50;  // Reset to initial position!
  state.velocity = 0;  // Reset velocity!
  updateButton('启动');
  draw();
}

// When simulation hits boundary/ends:
function onSimulationEnd() {
  state.running = false;
  state.ended = true;
  updateButton('重新开始');
}

function updateButton(text) {
  document.getElementById('mainBtn').innerText = text;
}
```

### 3. Button State Management
- Use clear state variables: `running`, `paused`, `ended`
- Button text should reflect what will happen when clicked:
  - "启动" / "开始" → Start simulation
  - "暂停" / "暂停" → Pause running simulation
  - "继续" / "继续" → Resume paused simulation
  - "重新开始" / "重试" → Reset and start fresh (when ended)
- One button should NOT do different things based on text alone

### 4. Touch-Friendly Controls
- Minimum touch target: 44x44px for buttons
- Sliders: Increase thumb size for mobile (min 24px)
- Add `touch-action: manipulation` to prevent double-tap zoom
- Use `touch-action: none` on canvas for custom gesture handling

### 5. Canvas Sizing
- Use `ResizeObserver` or window resize event
- Canvas should fill available space but respect `max-height`
- Don't use fixed pixel dimensions
- Account for control panel height on mobile

### 6. Visual Feedback
- Clear indication when simulation starts/pauses/ends
- Show current state in UI (running indicator, paused icon)
- Highlight end boundary or target
- Show success/failure message when simulation ends
- Animate the "重新开始" button appearance

### 7. Visible Animation (CRITICAL)

**When the user clicks "启动" (Start), there MUST be OBVIOUS visual animation.**

#### Animation Requirements:
1. **Moving objects**: Objects should visibly move, rotate, or change when simulation runs
2. **Clear motion**: Animation should be immediately noticeable - not subtle
3. **Rotation animations**: For spinning/rotating objects (earth, wheels, etc.), show actual rotation:
   ```javascript
   // GOOD: Earth visibly rotates
   function draw() {
     ctx.clearRect(0, 0, w, h);
     ctx.save();
     ctx.translate(centerX, centerY);
     ctx.rotate(rotationAngle); // Earth rotates!
     // Draw earth content...
     ctx.restore();

     if (state.running) {
       rotationAngle += 0.02 * state.speed; // Update rotation
     }
   }
   ```
4. **Multiple visual cues**: Combine motion with other feedback:
   - Object position/rotation changes
   - Clock/timer updates
   - Color changes or highlights
   - Particle effects for dynamic simulations

#### BAD Example (User can't tell if it's running):
```javascript
// Earth is static 2D circle, only time number changes
// User clicks "Start" → Nothing visibly moves → Confusing!
```

#### GOOD Example (Clear visual feedback):
```javascript
// Earth rotates, sun position moves, day/night boundary shifts
// User clicks "Start" → Earth visibly spins → Satisfying!
```

### 8. Data Display
- Real-time values should be clearly visible
- Use monospace font for numbers
- Show units consistently
- Consider a floating info panel that doesn't block the simulation

### 9. Presets
- Each preset should clearly describe what it demonstrates
- Preset buttons should be touch-friendly (larger on mobile)
- Applying a preset should reset the simulation

### 10. Accessibility
- ARIA labels on all controls
- Keyboard support (Space to start/pause, R to reset)
- Focus indicators
- High contrast text on canvas

### 11. Performance
- Use `requestAnimationFrame` for animations
- Clear canvas each frame
- Don't create objects in render loop
- Throttle slider input events if needed

## Common Bugs to Avoid

| Bug | Cause | Solution |
|-----|-------|----------|
| Reset doesn't work | Button calls wrong function | Ensure reset function resets ALL state variables |
| Canvas overlap on mobile | Fixed positioning | Use flex/grid with proper responsive classes |
| Simulation stuck | Missing `ended` state | Track `ended` separately from `running` |
| Button does nothing | State logic error | Clear state machine with defined transitions |
| Touch issues | Small touch targets | Min 44px touch targets, larger sliders |

## Chemistry & Physics Practical Lab Mode

When the input includes `procedureSteps`, `apparatus`, `chemicals`, `observations`, or `equations` fields, generate a **step-through lab procedure simulation** instead of a parameter-explorer. This mode visualizes a real experiment from start to finish.

### Layout

```
┌─────────────────────────────────────────────┐
│  Safety Banner (if safetyNotes provided)     │
├──────────────┬──────────────────────────────┤
│  Step Panel  │  Lab Bench (Canvas)          │
│  ──────────  │                              │
│  ✅ Step 1   │  [Apparatus + Liquids +      │
│  🔵 Step 2   │   Reaction Animation]        │
│  ⬜ Step 3   │                              │
│  ⬜ Step 4   │                              │
│              │                              │
│  ┌────────┐  │  ┌──────────────────────────┐ │
│  │Obs/Inf │  │  │ Observation Panel        │ │
│  │Panel   │  │  │ Observation → Inference  │ │
│  └────────┘  │  │ → Conclusion             │ │
│              │  └──────────────────────────┘ │
├──────────────┴──────────────────────────────┤
│  [◀ Previous]  Step 2/5  [Next ▶]  [Reset]  │
│  Equation: Zn(s) + 2HCl(aq) → ZnCl₂(aq)    │
└─────────────────────────────────────────────┘
```

### Step-Sequencer State Machine

```javascript
const state = {
  currentStep: 0,           // 0-indexed
  completedSteps: [],       // array of completed step indices
  phase: 'ready',           // 'ready' | 'pouring' | 'reacting' | 'observing' | 'testing' | 'complete'
  animationProgress: 0,     // 0..1 within current step
  liquidLevel: 0,           // fill level for pouring animations
  bubbleParticles: [],      // gas evolution particles
  colorProgress: 0,         // 0..1 for color transitions
  precipitateLevel: 0,      // settling particles for precipitation
  temperature: 20,          // degrees C (for exo/endothermic)
  observations: [],         // collected observations
};

function nextStep() {
  if (state.currentStep < steps.length - 1) {
    state.completedSteps.push(state.currentStep);
    state.currentStep++;
    state.phase = 'ready';
    state.animationProgress = 0;
    state.liquidLevel = 0;
    state.bubbleParticles = [];
    state.colorProgress = 0;
    state.precipitateLevel = 0;
    updateStepPanel();
    updateObservationPanel();
    updateEquationDisplay();
    draw();
  } else {
    state.completedSteps.push(state.currentStep);
    state.phase = 'complete';
    updateStepPanel();
    draw();
  }
}

function prevStep() {
  if (state.currentStep > 0) {
    state.completedSteps.pop();
    state.currentStep--;
    state.phase = 'ready';
    state.animationProgress = 0;
    updateStepPanel();
    updateObservationPanel();
    draw();
  }
}

function resetAll() {
  state.currentStep = 0;
  state.completedSteps = [];
  state.phase = 'ready';
  state.animationProgress = 0;
  state.liquidLevel = 0;
  state.bubbleParticles = [];
  state.colorProgress = 0;
  state.precipitateLevel = 0;
  state.temperature = 20;
  state.observations = [];
  updateStepPanel();
  updateObservationPanel();
  draw();
}
```

### Lab Apparatus Drawing Functions

Provide reusable Canvas drawing functions for common apparatus. Each function takes `ctx`, `x`, `y`, `scale` and draws the apparatus centered at (x, y):

```javascript
// Test tube: rounded bottom, open top
function drawTestTube(ctx, x, y, scale, { fillLevel = 0, fillColor = 'rgba(0,120,255,0.3)', hasStopper = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const w = 30, h = 120, r = 15;
  // Glass outline
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(-w/2, h/2 - r);
  ctx.arc(-w/2 + r, h/2 - r, r, Math.PI, 0, false);
  ctx.lineTo(w/2, -h/2);
  ctx.strokeStyle = 'rgba(180,220,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Liquid fill
  if (fillLevel > 0) {
    const liquidTop = h/2 - r - (h - r) * fillLevel;
    ctx.beginPath();
    ctx.moveTo(-w/2 + 1, liquidTop);
    ctx.lineTo(-w/2 + 1, h/2 - r);
    ctx.arc(-w/2 + r, h/2 - r, r - 1, Math.PI, 0, false);
    ctx.lineTo(w/2 - 1, liquidTop);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  // Stopper
  if (hasStopper) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-w/2 - 3, -h/2 - 8, w + 6, 10);
  }
  ctx.restore();
}

// Beaker: straight sides, spout
function drawBeaker(ctx, x, y, scale, { fillLevel = 0, fillColor = 'rgba(0,120,255,0.3)', hasGraduation = true } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const w = 80, h = 100;
  // Glass outline
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/2);
  ctx.lineTo(-w/2, h/2);
  ctx.lineTo(w/2, h/2);
  ctx.lineTo(w/2, -h/2 + 10);
  ctx.lineTo(w/2 + 15, -h/2 + 5); // spout
  ctx.strokeStyle = 'rgba(180,220,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Liquid
  if (fillLevel > 0) {
    const liquidTop = h/2 - h * fillLevel;
    ctx.fillStyle = fillColor;
    ctx.fillRect(-w/2 + 2, liquidTop, w - 4, h - (liquidTop + h/2));
  }
  // Graduation marks
  if (hasGraduation) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const gy = h/2 - (h * i / 5);
      ctx.beginPath();
      ctx.moveTo(-w/2, gy);
      ctx.lineTo(-w/2 + 10, gy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Dropper / pipette
function drawDropper(ctx, x, y, scale, { angle = 0, squeezeProgress = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  // Rubber bulb
  ctx.fillStyle = squeezeProgress > 0 ? '#C0392B' : '#E74C3C';
  ctx.beginPath();
  ctx.ellipse(0, -40, 8, 12 + (1 - squeezeProgress) * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glass tube
  ctx.fillStyle = 'rgba(180,220,255,0.8)';
  ctx.fillRect(-3, -28, 6, 50);
  // Tip
  ctx.beginPath();
  ctx.moveTo(-3, 22);
  ctx.lineTo(-1, 35);
  ctx.lineTo(1, 35);
  ctx.lineTo(3, 22);
  ctx.fillStyle = 'rgba(180,220,255,0.8)';
  ctx.fill();
  ctx.restore();
}

// Bunsen burner
function drawBunsenBurner(ctx, x, y, scale, { flameOn = false, flameHeight = 30 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Base
  ctx.fillStyle = '#555';
  ctx.fillRect(-20, 20, 40, 15);
  // Tube
  ctx.fillStyle = '#777';
  ctx.fillRect(-5, -30, 10, 55);
  // Flame
  if (flameOn) {
    const grad = ctx.createRadialGradient(0, -30 - flameHeight/2, 2, 0, -30, flameHeight);
    grad.addColorStop(0, 'rgba(255,255,200,0.9)');
    grad.addColorStop(0.3, 'rgba(255,200,50,0.8)');
    grad.addColorStop(0.7, 'rgba(255,100,0,0.6)');
    grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -30 - flameHeight/3, 8, flameHeight/2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Burette (for titration)
function drawBurette(ctx, x, y, scale, { liquidLevel = 0.5, fillColor = 'rgba(0,120,255,0.3)', tapOpen = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Long tube
  ctx.strokeStyle = 'rgba(180,220,255,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-6, -120, 12, 160);
  // Liquid
  if (liquidLevel > 0) {
    const liquidTop = 40 - 160 * liquidLevel;
    ctx.fillStyle = fillColor;
    ctx.fillRect(-5, liquidTop, 10, 40 - liquidTop);
  }
  // Tap
  ctx.fillStyle = tapOpen ? '#27AE60' : '#E74C3C';
  ctx.fillRect(-8, 40, 16, 6);
  ctx.restore();
}

// Conical flask (Erlenmeyer)
function drawConicalFlask(ctx, x, y, scale, { fillLevel = 0, fillColor = 'rgba(0,120,255,0.3)' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Flask body (trapezoid)
  ctx.beginPath();
  ctx.moveTo(-8, -60);  // narrow neck
  ctx.lineTo(-8, -30);
  ctx.lineTo(-40, 40);  // wide base
  ctx.lineTo(40, 40);
  ctx.lineTo(8, -30);
  ctx.lineTo(8, -60);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(180,220,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Liquid
  if (fillLevel > 0) {
    const liquidTop = 40 - 100 * fillLevel;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    // Approximate liquid line
    ctx.moveTo(-8, liquidTop);
    ctx.lineTo(-8, -30);
    ctx.lineTo(-40, 40);
    ctx.lineTo(40, 40);
    ctx.lineTo(8, -30);
    ctx.lineTo(8, liquidTop);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
```

### Reaction Animation Helpers

```javascript
// Bubble particle system for gas evolution
function createBubbles(x, y, count, speed) {
  const bubbles = [];
  for (let i = 0; i < count; i++) {
    bubbles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      r: 2 + Math.random() * 4,
      speed: speed * (0.5 + Math.random() * 0.5),
      wobble: Math.random() * Math.PI * 2,
      opacity: 0.6 + Math.random() * 0.4,
    });
  }
  return bubbles;
}

function updateBubbles(bubbles, dt) {
  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(b.wobble + b.y * 0.1) * 0.3;
    b.opacity -= 0.002 * dt;
  }
  return bubbles.filter(b => b.opacity > 0 && b.y > -50);
}

function drawBubbles(ctx, bubbles) {
  for (const b of bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${b.opacity})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(200,230,255,${b.opacity * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Color transition (interpolate between two colors)
function lerpColor(color1, color2, t) {
  const c1 = parseColor(color1), c2 = parseColor(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

// Precipitate settling animation
function createPrecipitate(x, y, count, color) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y - Math.random() * 20,
      r: 1.5 + Math.random() * 2.5,
      speed: 5 + Math.random() * 10,
      settled: false,
      color: color || '#FFF',
    });
  }
  return particles;
}

function updatePrecipitate(particles, floorY, dt) {
  for (const p of particles) {
    if (!p.settled) {
      p.y += p.speed * dt;
      if (p.y >= floorY) {
        p.y = floorY;
        p.settled = true;
      }
    }
  }
}

// Pouring animation (liquid stream from source to target)
function drawPourStream(ctx, fromX, fromY, toX, toY, progress, color) {
  if (progress <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  // Curved stream
  const cp1x = fromX, cp1y = fromY + 20;
  const cp2x = toX, cp2y = toY - 30;
  const endX = toX, endY = toY;
  const t = Math.min(progress, 1);
  // Partial bezier curve
  ctx.bezierCurveTo(
    cp1x, cp1y,
    cp1x + (cp2x - cp1x) * t, cp1y + (cp2y - cp1y) * t,
    fromX + (endX - fromX) * t, fromY + (endY - fromY) * t
  );
  ctx.stroke();
  ctx.restore();
}

// Flame test / splint animation
function drawSplint(ctx, x, y, scale, { lit = false, glowing = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Wooden splint
  ctx.fillStyle = '#D2B48C';
  ctx.fillRect(-2, -40, 4, 40);
  if (lit) {
    const grad = ctx.createRadialGradient(0, -45, 2, 0, -40, 15);
    grad.addColorStop(0, 'rgba(255,255,200,1)');
    grad.addColorStop(0.5, 'rgba(255,150,0,0.8)');
    grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -45, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (glowing) {
    ctx.fillStyle = 'rgba(255,100,0,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, -40, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

### Step Panel HTML Structure

```html
<div id="step-panel">
  <h3 id="step-title">Procedure</h3>
  <ol id="step-list">
    <!-- One <li> per procedure step -->
    <li class="step completed" data-step="0">
      <span class="step-marker">✅</span>
      <span class="step-text">Set up apparatus</span>
    </li>
    <li class="step active" data-step="1">
      <span class="step-marker">🔵</span>
      <span class="step-text">Add zinc granules</span>
    </li>
    <li class="step" data-step="2">
      <span class="step-marker">⬜</span>
      <span class="step-text">Add dilute HCl</span>
    </li>
  </ol>
</div>

<style>
  #step-panel {
    background: rgba(15,23,42,0.95);
    border-radius: 12px;
    padding: 16px;
    width: 220px;
    flex-shrink: 0;
  }
  .step {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    transition: all 0.3s;
  }
  .step.active { color: #60A5FA; font-weight: 600; }
  .step.completed { color: #34D399; }
  .step-marker { flex-shrink: 0; width: 20px; text-align: center; }
</style>
```

### Observation Panel

When a step is completed, show the observation, inference, and conclusion in a panel below the canvas:

```html
<div id="observation-panel">
  <div id="obs-row" class="obs-row">
    <span class="obs-label">Observation:</span>
    <span id="obs-text" class="obs-value"></span>
  </div>
  <div id="inf-row" class="obs-row">
    <span class="obs-label">Inference:</span>
    <span id="inf-text" class="obs-value"></span>
  </div>
  <div id="conc-row" class="obs-row">
    <span class="obs-label">Conclusion:</span>
    <span id="conc-text" class="obs-value"></span>
  </div>
</div>

<style>
  #observation-panel {
    background: rgba(15,23,42,0.9);
    border-left: 3px solid #60A5FA;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin-top: 8px;
  }
  .obs-row {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 13px;
    line-height: 1.5;
  }
  .obs-label {
    color: #94A3B8;
    font-weight: 600;
    min-width: 90px;
    flex-shrink: 0;
  }
  .obs-value {
    color: #E2E8F0;
  }
</style>
```

### Equation Display

Show the balanced chemical equation for the current step, rendered with KaTeX (auto-injected by post-processing):

```html
<div id="equation-display">
  <span id="equation-text">$$Zn(s) + 2HCl(aq) \rightarrow ZnCl_2(aq) + H_2(g)$$</span>
</div>
```

### Safety Banner

If `safetyNotes` are provided, show a persistent safety banner at the top:

```html
<div id="safety-banner">
  ⚠️ <span id="safety-text">Dilute acid is corrosive — handle with care. Hydrogen is flammable.</span>
</div>
<style>
  #safety-banner {
    background: linear-gradient(90deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05));
    border: 1px solid rgba(234,179,8,0.3);
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 13px;
    color: #FDE68A;
    margin-bottom: 8px;
  }
</style>
```

### Practical Simulation Animation Loop

```javascript
let lastTime = 0;

function animate(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 16.67, 3); // normalize to ~60fps
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw lab bench background
  drawLabBench(ctx);

  // Draw apparatus based on current step's apparatus list
  drawCurrentApparatus(ctx, state);

  // Animate based on current phase
  if (state.phase === 'pouring') {
    state.liquidLevel = Math.min(state.liquidLevel + 0.01 * dt, 1);
    drawPourStream(ctx, pourFrom.x, pourFrom.y, pourTo.x, pourTo.y, state.liquidLevel, pourColor);
    updateLiquidFill(ctx, state);
  }

  if (state.phase === 'reacting') {
    state.animationProgress = Math.min(state.animationProgress + 0.005 * dt, 1);
    // Bubbles for gas
    if (reaction.producesGas) {
      state.bubbleParticles = updateBubbles(state.bubbleParticles, dt);
      drawBubbles(ctx, state.bubbleParticles);
    }
    // Color transition
    if (reaction.colorChange) {
      state.colorProgress = Math.min(state.colorProgress + 0.008 * dt, 1);
      updateLiquidColor(ctx, lerpColor(reaction.fromColor, reaction.toColor, state.colorProgress));
    }
    // Precipitate
    if (reaction.producesPrecipitate) {
      state.precipitateLevel = Math.min(state.precipitateLevel + 0.006 * dt, 1);
      updatePrecipitate(ctx, state);
    }
    // Temperature
    if (reaction.temperatureChange) {
      state.temperature += reaction.temperatureChange * 0.01 * dt;
      updateTemperatureDisplay(state.temperature);
    }
    if (state.animationProgress >= 1) {
      state.phase = 'observing';
      showObservation(currentStep);
    }
  }

  if (state.phase === 'testing') {
    // Splint animation, flame test, etc.
    drawTestAnimation(ctx, currentStep.test, state);
  }

  // Draw temperature indicator if relevant
  if (reaction.temperatureChange) {
    drawThermometer(ctx, canvas.width - 60, 80, state.temperature);
  }

  requestAnimationFrame(animate);
}

function drawLabBench(ctx) {
  // Table surface
  const grad = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
  grad.addColorStop(0, '#4A3728');
  grad.addColorStop(1, '#3D2B1F');
  ctx.fillStyle = grad;
  ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
  // Edge highlight
  ctx.strokeStyle = '#5C4033';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.7);
  ctx.lineTo(canvas.width, canvas.height * 0.7);
  ctx.stroke();
  // Wall / backdrop
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.7);
}

function drawThermometer(ctx, x, y, temp) {
  ctx.save();
  ctx.translate(x, y);
  // Tube
  ctx.fillStyle = '#334155';
  ctx.fillRect(-4, -50, 8, 80);
  // Mercury/red fill
  const fillHeight = Math.min(Math.max((temp - 0) / 100, 0), 1) * 70;
  ctx.fillStyle = temp > 40 ? '#EF4444' : '#3B82F6';
  ctx.fillRect(-3, 30 - fillHeight, 6, fillHeight);
  // Bulb
  ctx.beginPath();
  ctx.arc(0, 35, 8, 0, Math.PI * 2);
  ctx.fill();
  // Label
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(temp)}°C`, 0, 50);
  ctx.restore();
}
```

### Physics Practical Mode

For physics practicals (e.g., Ohm's law, lens experiments, pendulum), the simulation should:

- Draw the experimental setup (circuit diagram, optical bench, pendulum rig) using Canvas primitives
- Show measurement instruments (voltmeter, ammeter, ruler, stopwatch) with animated readings
- Allow the student to adjust experimental variables via sliders and see real-time changes
- Display readings on a virtual meter/dial that animates smoothly
- Include a data table that fills in as measurements are taken
- Show the formula with substituted values after each measurement

**Physics apparatus examples:**
- Circuit: resistor, battery, wire, switch, voltmeter, ammeter
- Optics: lens, mirror, light source, screen, optical bench with ruler
- Mechanics: pendulum, stopwatch, protractor, mass, spring
- Waves: ripple tank, slinky, signal generator, oscilloscope

### Quality Checklist for Practical Mode

- [ ] Step panel shows all procedure steps with correct completion state
- [ ] Apparatus is drawn clearly and recognizably (not abstract shapes)
- [ ] Liquids have visible fill levels and correct colors
- [ ] Reaction animations are OBVIOUS (bubbles, color change, precipitate, temperature)
- [ ] Observation panel updates when each step completes
- [ ] Chemical equation is displayed and correct
- [ ] Safety notes are visible if provided
- [ ] Navigation (prev/next/reset) works correctly
- [ ] Touch-friendly controls on mobile
- [ ] Canvas resizes properly
- [ ] postMessage listener is included for widget actions

## Output Format

Return ONLY the HTML document, no markdown fences or explanations.

**CRITICAL: Output EXACTLY ONE HTML document.**
- Do NOT duplicate content
- Do NOT include multiple `<!DOCTYPE html>` tags
- The output must end with exactly one `</html>` tag

## Object Positioning with UI Overlays

When calculating positions for simulation objects, account for UI overlays:

```javascript
// BAD: Object overlaps with controls/HUD
const objectY = baseY - (value / maxValue) * canvas.height;

// GOOD: Reserve space for UI elements
const TOP_MARGIN = 100;    // Space for HUD/stats at top
const BOTTOM_MARGIN = 200; // Space for controls at bottom
const playableHeight = canvas.height - TOP_MARGIN - BOTTOM_MARGIN;
const objectY = baseY - BOTTOM_MARGIN - (value / maxValue) * playableHeight;
```

## Quality Checklist (verify before output)

- [ ] Control panel does NOT overlap canvas on mobile (test 320px width)
- [ ] Reset button returns simulation to EXACT initial state
- [ ] Button text matches button action correctly
- [ ] Touch targets are at least 44px
- [ ] Canvas resizes properly on window resize
- [ ] State machine is clear (running/paused/ended)
- [ ] All state variables reset on resetSimulation()
- [ ] Works on both desktop and mobile browsers
- [ ] **NO DUPLICATED HTML** - exactly ONE `<!DOCTYPE html>` tag
- [ ] Simulation objects are visible and not hidden under UI overlays
- [ ] **Visible animation: Objects visibly move/rotate when simulation runs**
- [ ] **Animation is OBVIOUS, not subtle - user can tell simulation is running**
