# Interactive Real-Time Simulation Patterns (PhET-Style)

CRITICAL: This is the most important pattern. Students must be able to INTERACT with the experiment in real-time — not watch a step-by-step animation. When they move a slider, the experiment changes IMMEDIATELY. When they drag a chemical, it pours. When they adjust concentration, the color changes.

## Core Principle: Reactive State Machine

PhET uses a Property-based reactive architecture. We replicate this with a simple pattern:

```javascript
// ALL simulation state in one object
const state = {
  // Chemistry variables
  concentration: 0.5,    // mol/L
  temperature: 25,       // °C
  pH: 7.0,
  volume: 100,           // mL
  // Physics variables
  angle: 45,             // degrees
  velocity: 10,          // m/s
  resistance: 100,       // ohms
  voltage: 12,           // volts
  // UI state
  running: false,
  time: 0,
  currentPreset: null,
};

// WHENEVER state changes, re-render EVERYTHING
function updateState(key, value) {
  state[key] = value;
  recalculateDerivedValues();  // pH from concentration, current from V/R, etc.
  render();                    // Redraw canvas
  updateLiveDataPanel();       // Update numbers panel
  updateSliders();             // Sync slider positions
}

// Derived calculations (the SCIENCE)
function recalculateDerivedValues() {
  // Chemistry: pH from concentration
  if (state.concentration > 0) {
    state.pH = -Math.log10(state.concentration * state.ionizationDegree);
  }
  // Physics: Ohm's law
  state.current = state.voltage / state.resistance;
  state.power = state.voltage * state.current;
  // Physics: Pendulum period
  state.period = 2 * Math.PI * Math.sqrt(state.length / 981);
  // Chemistry: Color from pH
  state.solutionColor = pHToColor(state.pH);
}
```

## Pattern 1: Slider → Immediate Visual Update

Every slider MUST update the canvas in real-time. No "Apply" button. No delay.

```html
<!-- Slider that immediately affects the simulation -->
<label>Concentration (mol/L): <span id="conc-display">0.50</span></label>
<input type="range" id="conc-slider" min="0.01" max="2.0" step="0.01" value="0.5">

<script>
const slider = document.getElementById('conc-slider');
const display = document.getElementById('conc-display');

slider.addEventListener('input', function() {
  const value = parseFloat(this.value);
  display.textContent = value.toFixed(2);
  updateState('concentration', value);  // Triggers re-render + recalculation
});

// Also support direct text input
display.contentEditable = true;
display.addEventListener('blur', function() {
  const value = parseFloat(this.textContent);
  if (!isNaN(value)) {
    slider.value = value;
    updateState('concentration', value);
  }
});
</script>
```

## Pattern 2: Drag-and-Drop Chemical Mixing

Student drags a chemical bottle onto the beaker. The reaction happens instantly.

```javascript
// Chemical shelf (draggable bottles)
const chemicals = [
  { id: 'hcl', name: 'HCl', formula: 'Hydrochloric Acid', color: '#FFE066', state: 'liquid' },
  { id: 'naoh', name: 'NaOH', formula: 'Sodium Hydroxide', color: '#90EE90', state: 'liquid' },
  { id: 'zn', name: 'Zn', formula: 'Zinc Granules', color: '#C0C0C0', state: 'solid' },
  { id: 'cuso4', name: 'CuSO₄', formula: 'Copper Sulfate', color: '#4169E1', state: 'liquid' },
  { id: 'nahco3', name: 'NaHCO₃', formula: 'Baking Soda', color: '#FFFFFF', state: 'solid' },
  { id: 'ch3cooh', name: 'CH₃COOH', formula: 'Vinegar', color: '#FFE4B5', state: 'liquid' },
];

// Reaction database
const reactions = {
  'hcl+naoh': { 
    type: 'neutralization', 
    equation: 'HCl + NaOH → NaCl + H₂O',
    heat: 'exothermic',
    colorChange: { from: '#FFE066', to: '#FFFFFF' },
    observation: 'Solution becomes warm. No visible change (both clear → clear).',
    tempChange: +15
  },
  'hcl+zn': {
    type: 'gas_evolution',
    equation: 'Zn(s) + 2HCl(aq) → ZnCl₂(aq) + H₂(g)',
    gas: 'H₂',
    gasTest: 'Burns with pop sound',
    colorChange: { from: '#FFE066', to: '#E8E8E8' },
    bubbles: true,
    zincDissolves: true,
    observation: 'Bubbles of colourless gas produced. Zinc granules dissolve.',
    tempChange: +8
  },
  'ch3cooh+nahco3': {
    type: 'gas_evolution',
    equation: 'CH₃COOH + NaHCO₃ → CH₃COONa + H₂O + CO₂',
    gas: 'CO₂',
    gasTest: 'Turns limewater milky',
    colorChange: { from: '#FFE4B5', to: '#FFFFFF' },
    bubbles: true,
    fizzing: true,
    observation: 'Effervescence. Colourless gas turns limewater milky.',
    tempChange: -3  // endothermic
  },
  'cuso4+zn': {
    type: 'displacement',
    equation: 'CuSO₄(aq) + Zn(s) → ZnSO₄(aq) + Cu(s)',
    colorChange: { from: '#4169E1', to: '#E8E8E8' },
    precipitate: { color: '#B87333', name: 'Copper metal' },
    observation: 'Blue solution fades. Red-brown solid deposits on zinc.',
    tempChange: +5
  },
};

// Drag-and-drop handlers
document.querySelectorAll('.chemical-bottle').forEach(bottle => {
  let isDragging = false, offsetX, offsetY, clone;
  
  bottle.addEventListener('mousedown', startDrag);
  bottle.addEventListener('touchstart', startDrag, { passive: false });
  
  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    const rect = bottle.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    
    // Create floating clone
    clone = bottle.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.zIndex = '1000';
    clone.style.opacity = '0.8';
    clone.style.pointerEvents = 'none';
    clone.style.width = rect.width + 'px';
    document.body.appendChild(clone);
    moveClone(clientX, clientY);
  }
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    moveClone(e.clientX, e.clientY);
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    moveClone(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchend', endDrag);
  
  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    if (clone) clone.remove();
    
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    
    // Check if dropped on beaker
    const beaker = document.getElementById('beaker-canvas');
    if (beaker) {
      const rect = beaker.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && 
          clientY >= rect.top && clientY <= rect.bottom) {
        addChemicalToBeaker(bottle.dataset.id);
      }
    }
  }
  
  function moveClone(x, y) {
    if (!clone) return;
    clone.style.left = (x - offsetX) + 'px';
    clone.style.top = (y - offsetY) + 'px';
  }
});

// When chemical is added to beaker
function addChemicalToBeaker(chemicalId) {
  state.chemicalsInBeaker.push(chemicalId);
  
  // Check for reaction
  if (state.chemicalsInBeaker.length >= 2) {
    const key = state.chemicalsInBeaker.sort().join('+');
    if (reactions[key]) {
      triggerReaction(reactions[key]);
    }
  }
  
  // Update beaker visualization immediately
  updateBeakerVisual();
  showAddedMessage(chemicalId);
}

function triggerReaction(reaction) {
  state.phase = 'reacting';
  state.currentReaction = reaction;
  state.temperature += reaction.tempChange;
  
  // Animate the reaction over 2 seconds
  const startTime = Date.now();
  const duration = 2000;
  
  function animateReaction() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Color transition
    state.currentColor = lerpColor(reaction.colorChange.from, reaction.colorChange.to, progress);
    
    // Bubbles (if gas producing)
    if (reaction.bubbles) {
      for (let i = 0; i < 3; i++) {
        state.bubbles.push(createBubble());
      }
    }
    
    // Precipitate settling
    if (reaction.precipitate && progress > 0.5) {
      state.precipitateOpacity = (progress - 0.5) * 2;
    }
    
    render();
    updateLiveDataPanel();
    
    if (progress < 1) {
      requestAnimationFrame(animateReaction);
    } else {
      state.phase = 'complete';
      showObservation(reaction.observation);
      showEquation(reaction.equation);
    }
  }
  
  requestAnimationFrame(animateReaction);
}
```

## Pattern 3: Real-Time Calculations (The Science Engine)

Every slider change triggers scientific calculations that update the visualization:

```javascript
// Chemistry: pH → Color mapping (accurate pH indicator colors)
function pHToColor(pH) {
  if (pH < 1) return '#FF0000';       // Strong acid: red
  if (pH < 3) return '#FF4444';       // Acid: red-orange
  if (pH < 5) return '#FFaa00';       // Weak acid: orange
  if (pH < 6) return '#FFDD00';       // Very weak acid: yellow
  if (pH < 7) return '#BBFF00';       // Slightly acidic: yellow-green
  if (pH === 7) return '#00CC00';     // Neutral: green
  if (pH < 8) return '#00BB44';       // Slightly basic: green
  if (pH < 10) return '#0088FF';      // Weak base: blue
  if (pH < 12) return '#4400CC';      // Base: indigo
  return '#8800FF';                    // Strong base: violet
}

// Chemistry: Molarity calculation
function calculateMolarity(mass, molarMass, volumeML) {
  const moles = mass / molarMass;
  const volumeL = volumeML / 1000;
  return moles / volumeL;
}

// Chemistry: Titration curve
function titrationCurve(acidConc, baseConc, acidVolume, baseVolumeAdded) {
  const acidMoles = acidConc * acidVolume / 1000;
  const baseMoles = baseConc * baseVolumeAdded / 1000;
  const totalVolume = (acidVolume + baseVolumeAdded) / 1000;
  
  if (baseMoles < acidMoles) {
    // Before equivalence: excess acid
    const excessH = (acidMoles - baseMoles) / totalVolume;
    return -Math.log10(excessH);
  } else if (baseMoles === acidMoles) {
    // At equivalence
    return 7.0;
  } else {
    // After equivalence: excess base
    const excessOH = (baseMoles - acidMoles) / totalVolume;
    return 14 + Math.log10(excessOH);
  }
}

// Physics: Ohm's Law (V = IR)
function ohmsLawCalc(voltage, resistance) {
  const current = voltage / resistance;
  const power = voltage * current;
  return { current, power, resistance };
}

// Physics: Projectile motion
function projectileCalc(angle, velocity, time, g = 9.81) {
  const rad = angle * Math.PI / 180;
  const vx = velocity * Math.cos(rad);
  const vy = velocity * Math.sin(rad);
  const x = vx * time;
  const y = vy * time - 0.5 * g * time * time;
  const vCurrentY = vy - g * time;
  const speed = Math.sqrt(vx * vx + vCurrentY * vCurrentY);
  return { x, y, vx, vy: vCurrentY, speed, time };
}

// Physics: Simple pendulum
function pendulumCalc(length, angle, g = 9.81) {
  const period = 2 * Math.PI * Math.sqrt(length / g);
  const angularVelocity = Math.sqrt(2 * g / length * (1 - Math.cos(angle)));
  const tension = 9.81 * (3 * Math.cos(angle) - 2 * Math.cos(angle));
  return { period, angularVelocity, tension };
}

// Physics: Refraction (Snell's law)
function refractionCalc(angleOfIncidence, n1, n2) {
  const theta1 = angleOfIncidence * Math.PI / 180;
  const sinTheta2 = (n1 / n2) * Math.sin(theta1);
  
  if (Math.abs(sinTheta2) > 1) {
    return { refracted: false, criticalAngle: Math.asin(n2 / n1) * 180 / Math.PI };
  }
  
  const theta2 = Math.asin(sinTheta2);
  const deviation = theta1 - theta2;
  return { 
    refracted: true, 
    angleOfRefraction: theta2 * 180 / Math.PI,
    deviation: deviation * 180 / Math.PI
  };
}
```

## Pattern 4: Live Data Panel (Updates with Every Interaction)

A floating panel that shows real-time values. Updates IMMEDIATELY when any variable changes.

```html
<div id="live-data" style="
  position:fixed; top:12px; right:12px; 
  background:rgba(15,23,42,0.9); backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,0.1); border-radius:12px;
  padding:16px; min-width:180px; z-index:100;
  font-family:'JetBrains Mono',monospace; font-size:13px;
">
  <div style="color:#94A3B8; font-size:10px; text-transform:uppercase; letter-spacing:2px; margin-bottom:8px;">
    ⚡ Live Measurements
  </div>
  <div class="data-row">
    <span style="color:#94A3B8;">pH:</span>
    <span id="live-ph" style="color:#34D399; font-weight:600; font-size:16px;">7.0</span>
  </div>
  <div class="data-row">
    <span style="color:#94A3B8;">Temperature:</span>
    <span id="live-temp" style="color:#F59E0B; font-weight:600;">25.0 °C</span>
  </div>
  <div class="data-row">
    <span style="color:#94A3B8;">Concentration:</span>
    <span id="live-conc" style="color:#60A5FA; font-weight:600;">0.50 mol/L</span>
  </div>
  <div class="data-row">
    <span style="color:#94A3B8;">Volume:</span>
    <span id="live-vol" style="color:#A78BFA; font-weight:600;">100 mL</span>
  </div>
</div>

<script>
function updateLiveDataPanel() {
  document.getElementById('live-ph').textContent = state.pH.toFixed(1);
  document.getElementById('live-temp').textContent = state.temperature.toFixed(1) + ' °C';
  document.getElementById('live-conc').textContent = state.concentration.toFixed(2) + ' mol/L';
  document.getElementById('live-vol').textContent = state.volume.toFixed(0) + ' mL';
  
  // Color-code pH
  const phEl = document.getElementById('live-ph');
  phEl.style.color = state.pH < 7 ? '#EF4444' : state.pH > 7 ? '#8B5CF6' : '#34D399';
}
</script>
```

## Pattern 5: Preset Experiments (Instant Configuration)

Click a preset → instantly configures all variables → shows the reaction.

```html
<div id="presets" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
  <button class="preset-btn" data-preset="strong-acid">🔴 Strong Acid (HCl)</button>
  <button class="preset-btn" data-preset="weak-acid">🟡 Weak Acid (CH₃COOH)</button>
  <button class="preset-btn" data-preset="neutral">🟢 Neutral (Water)</button>
  <button class="preset-btn" data-preset="weak-base">🔵 Weak Base (NH₃)</button>
  <button class="preset-btn" data-preset="strong-base">🟣 Strong Base (NaOH)</button>
</div>

<script>
const presets = {
  'strong-acid': { concentration: 1.0, pH: 0.0, temperature: 25, color: '#FF0000', label: '1.0 M HCl — pH 0.0' },
  'weak-acid': { concentration: 0.1, pH: 2.9, temperature: 25, color: '#FF8800', label: '0.1 M CH₃COOH — pH 2.9' },
  'neutral': { concentration: 0.0000001, pH: 7.0, temperature: 25, color: '#00CC00', label: 'Pure Water — pH 7.0' },
  'weak-base': { concentration: 0.1, pH: 11.1, temperature: 25, color: '#0088FF', label: '0.1 M NH₃ — pH 11.1' },
  'strong-base': { concentration: 1.0, pH: 14.0, temperature: 25, color: '#8800FF', label: '1.0 M NaOH — pH 14.0' },
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = presets[btn.dataset.preset];
    if (!preset) return;
    
    // Animate transition to preset values
    animateToPreset(preset);
    
    // Highlight active preset
    document.querySelectorAll('.preset-btn').forEach(b => b.style.outline = 'none');
    btn.style.outline = '2px solid #60A5FA';
  });
});

function animateToPreset(target) {
  const start = { ...state };
  const duration = 500; // ms
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
    
    state.pH = start.pH + (target.pH - start.pH) * ease;
    state.concentration = start.concentration + (target.concentration - start.concentration) * ease;
    state.temperature = start.temperature + (target.temperature - start.temperature) * ease;
    state.solutionColor = target.color;
    
    render();
    updateLiveDataPanel();
    updateSliders();
    
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
```

## Pattern 6: Multiple Tabs (Macro / Micro / Data)

Students can switch between viewing the experiment at different scales:

```html
<div id="view-tabs" style="display:flex; gap:4px; margin-bottom:8px;">
  <button class="view-tab active" data-view="macro">👁️ Macro View</button>
  <button class="view-tab" data-view="micro">🔬 Micro View</button>
  <button class="view-tab" data-view="data">📊 Data View</button>
</div>

<script>
document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentView = tab.dataset.view;
    render();
  });
});

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  switch (state.currentView) {
    case 'macro':
      drawMacroView(ctx);   // What you see with your eyes
      break;
    case 'micro':
      drawMicroView(ctx);   // Molecular level — ions, molecules
      break;
    case 'data':
      drawDataView(ctx);    // Graphs, numbers, equations
      break;
  }
}
```

## Pattern 7: Interactive Canvas (Click/Drag on Canvas)

Students can interact directly with the canvas — not just through sliders:

```javascript
// Click on canvas to add drops, move objects, etc.
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if clicked on beaker area
  if (isInsideBeaker(x, y)) {
    addDropToBeaker();
  }
  
  // Check if clicked on a probe
  if (isInsideProbe(x, y)) {
    startDragProbe(x, y);
  }
});

// Drag probe to measure at different points
canvas.addEventListener('mousemove', (e) => {
  if (state.draggingProbe) {
    const rect = canvas.getBoundingClientRect();
    state.probeX = e.clientX - rect.left;
    state.probeY = e.clientY - rect.top;
    
    // Update probe reading based on position
    state.probeReading = calculateAtPoint(state.probeX, state.probeY);
    render();
  }
});
```

## Pattern 8: Real-Time Graph (Plots Data as Experiment Runs)

A small graph that plots variables in real-time alongside the visualization:

```javascript
function drawRealTimeGraph(ctx, x, y, w, h, dataPoints, color, label, yLabel) {
  // Background
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();
  
  // Title
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 8, y + 14);
  
  // Graph area
  const gx = x + 30, gy = y + 22, gw = w - 40, gh = h - 35;
  
  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx, gy + gh);
  ctx.lineTo(gx + gw, gy + gh);
  ctx.stroke();
  
  // Y-axis label
  ctx.fillStyle = '#94A3B8';
  ctx.font = '8px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(yLabel, x + 28, gy + gh / 2);
  
  // Plot data
  if (dataPoints.length < 2) return;
  
  const minY = Math.min(...dataPoints.map(p => p.y));
  const maxY = Math.max(...dataPoints.map(p => p.y));
  const rangeY = maxY - minY || 1;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  dataPoints.forEach((point, i) => {
    const px = gx + (i / (dataPoints.length - 1)) * gw;
    const py = gy + gh - ((point.y - minY) / rangeY) * gh;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  
  // Current value dot
  const lastPoint = dataPoints[dataPoints.length - 1];
  const lastX = gx + gw;
  const lastY = gy + gh - ((lastPoint.y - minY) / rangeY) * gh;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Current value label
  ctx.fillStyle = color;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(lastPoint.y.toFixed(2), lastX + 6, lastY + 4);
}
```

## CRITICAL RULES FOR INTERACTIVE SIMULATIONS

1. **EVERY slider MUST call `updateState()` on `input` event** — not `change`, not on button click
2. **The canvas MUST re-render on EVERY state change** — no delays, no transitions between "steps"
3. **Scientific calculations MUST happen in real-time** — pH changes as concentration slider moves
4. **Colors MUST update immediately** — solution color changes as you adjust pH
5. **The student drives the experiment** — they choose what to add, when to stop, how much to use
6. **No "Play Next" buttons** — the experiment runs continuously as the student interacts
7. **Presets configure instantly** — one click sets all variables and shows the result
8. **Multiple views available** — macro (eyes), micro (molecules), data (numbers/graphs)
9. **Graphs plot in real-time** — as the student adjusts variables, the graph updates live
10. **Canvas is interactive** — students can click, drag, drop directly on the visualization
