# Multiple View Modes Pattern

Every chemistry/physics simulation should offer three view modes that students can toggle between. This is the "multiple representations" pattern from PhET — see the same concept at different scales.

## View Modes

| Mode | What Students See | When to Use |
|---|---|---|
| **Macro** | What you see with your eyes — beaker, liquid, colour, bubbles | Default view, shows the "real" experiment |
| **Micro** | Molecular level — atoms, ions, molecules moving and reacting | Shows WHY the reaction happens |
| **Data** | Numbers, graphs, equations — quantitative view | Shows HOW to measure and calculate |

## Layout

```
┌─────────────────────────────────────────────┐
│  VIEW: [👁 Macro] [🔬 Micro] [📊 Data]      │
├─────────────────────────────────────────────┤
│                                              │
│   CURRENT VIEW CONTENT                       │
│   (changes based on selected mode)           │
│                                              │
└─────────────────────────────────────────────┘
```

## HTML Structure

```html
<!-- View Mode Toggle -->
<div id="view-toggle" style="display:flex; gap:4px; padding:8px 12px; background:rgba(15,23,42,0.95); 
     border-radius:8px; width:fit-content; margin:0 auto 12px;">
  <button class="view-btn active" data-view="macro" id="view-macro"
    style="padding:8px 16px; border:none; border-radius:6px; font-size:13px; cursor:pointer; 
           transition:all 0.2s; background:rgba(96,165,250,0.2); color:#60A5FA;">
    👁 Macro
  </button>
  <button class="view-btn" data-view="micro" id="view-micro"
    style="padding:8px 16px; border:none; border-radius:6px; font-size:13px; cursor:pointer; 
           transition:all 0.2s; background:transparent; color:#94A3B8;">
    🔬 Micro
  </button>
  <button class="view-btn" data-view="data" id="view-data"
    style="padding:8px 16px; border:none; border-radius:6px; font-size:13px; cursor:pointer; 
           transition:all 0.2s; background:transparent; color:#94A3B8;">
    📊 Data
  </button>
</div>

<!-- View Containers (only one visible at a time) -->
<div id="macro-view" class="view-container" style="display:block;">
  <!-- Macro view: beaker, liquid, apparatus -->
</div>

<div id="micro-view" class="view-container" style="display:none;">
  <!-- Micro view: atoms, ions, molecules -->
</div>

<div id="data-view" class="view-container" style="display:none;">
  <!-- Data view: graphs, numbers, equations -->
</div>
```

## JavaScript Implementation

```javascript
let currentView = 'macro';

function switchView(view) {
  currentView = view;
  
  // Update buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    if (btn.dataset.view === view) {
      btn.classList.add('active');
      btn.style.background = 'rgba(96,165,250,0.2)';
      btn.style.color = '#60A5FA';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'transparent';
      btn.style.color = '#94A3B8';
    }
  });
  
  // Show/hide containers
  document.querySelectorAll('.view-container').forEach(c => c.style.display = 'none');
  document.getElementById(view + '-view').style.display = 'block';
  
  // Re-render current view
  if (view === 'macro') renderMacroView();
  if (view === 'micro') renderMicroView();
  if (view === 'data') renderDataView();
}

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
```

## Macro View (What You See)

The default view. Shows the physical apparatus and visible changes.

```html
<div id="macro-view">
  <canvas id="macro-canvas" width="600" height="400"></canvas>
</div>
```

```javascript
function renderMacroView() {
  const ctx = document.getElementById('macro-canvas').getContext('2d');
  ctx.clearRect(0, 0, 600, 400);
  
  // Draw lab bench
  drawLabBench(ctx);
  
  // Draw beaker with liquid
  drawBeaker(ctx, 300, 200, 1.0, {
    fillLevel: liquidLevel,
    fillColor: liquidColor,
    label: 'Beaker'
  });
  
  // Draw apparatus labels
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('What you see in the lab', 300, 380);
}
```

## Micro View (Molecular Level)

Shows atoms, ions, and molecules at the molecular scale. This is where students understand WHY reactions happen.

```html
<div id="micro-view">
  <canvas id="micro-canvas" width="600" height="400"></canvas>
  <div id="micro-legend" style="position:absolute; bottom:12px; left:12px; background:rgba(15,23,42,0.9); 
       padding:8px 12px; border-radius:8px; display:flex; gap:12px; font-size:12px;">
    <span style="color:#60A5FA;">● H₃O⁺</span>
    <span style="color:#EF4444;">● OH⁻</span>
    <span style="color:#94A3B8;">● H₂O</span>
    <span style="color:#34D399;">● Na⁺</span>
    <span style="color:#F59E0B;">● Cl⁻</span>
  </div>
</div>
```

```javascript
// Particle system for micro view
class MolecularView {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  initParticles(chemicals) {
    this.particles = [];
    
    chemicals.forEach(chem => {
      const count = chem.concentration * 20; // More concentration = more particles
      
      for (let i = 0; i < count; i++) {
        // Positive ions (cations)
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radius: 8,
          color: chem.cationColor,
          label: chem.cationLabel,
          type: 'cation'
        });
        
        // Negative ions (anions)
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radius: 8,
          color: chem.anionColor,
          label: chem.anionLabel,
          type: 'anion'
        });
      }
    });
    
    // Add water molecules (background)
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 5,
        color: 'rgba(100,150,255,0.3)',
        label: '',
        type: 'water'
      });
    }
  }

  update() {
    this.particles.forEach(p => {
      // Brownian motion
      p.vx += (Math.random() - 0.5) * 0.3;
      p.vy += (Math.random() - 0.5) * 0.3;
      
      // Damping
      p.vx *= 0.98;
      p.vy *= 0.98;
      
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      
      // Bounce off walls
      if (p.x < p.radius) { p.x = p.radius; p.vx *= -1; }
      if (p.x > this.width - p.radius) { p.x = this.width - p.radius; p.vx *= -1; }
      if (p.y < p.radius) { p.y = p.radius; p.vy *= -1; }
      if (p.y > this.height - p.radius) { p.y = this.height - p.radius; p.vy *= -1; }
    });
    
    // Check for collisions between particles
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;
        
        if (dist < minDist) {
          // Elastic collision
          const nx = dx / dist;
          const ny = dy / dist;
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dvn = dvx * nx + dvy * ny;
          
          if (dvn > 0) {
            a.vx -= dvn * nx;
            a.vy -= dvn * ny;
            b.vx += dvn * nx;
            b.vy += dvn * ny;
          }
          
          // Separate particles
          const overlap = minDist - dist;
          a.x -= overlap * nx * 0.5;
          a.y -= overlap * ny * 0.5;
          b.x += overlap * nx * 0.5;
          b.y += overlap * ny * 0.5;
        }
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Background
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw particles
    this.particles.forEach(p => {
      // Glow effect
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color.replace(')', ',0.2)').replace('rgb', 'rgba');
      this.ctx.fill();
      
      // Particle body
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      
      // Label
      if (p.label && p.type !== 'water') {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(p.label, p.x, p.y);
      }
    });
    
    // Title
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Molecular View — zoomed in to see individual ions', this.width/2, this.height - 15);
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

// Micro view chemical definitions for acid-base
const MICRO_CHEMICALS = {
  'hcl': {
    cationColor: 'rgb(96,165,250)', cationLabel: 'H⁺',
    anionColor: 'rgb(52,211,153)', anionLabel: 'Cl⁻',
    concentration: 3
  },
  'naoh': {
    cationColor: 'rgb(52,211,153)', cationLabel: 'Na⁺',
    anionColor: 'rgb(239,68,68)', anionLabel: 'OH⁻',
    concentration: 3
  }
};
```

## Data View (Numbers, Graphs, Equations)

Shows quantitative information — the math behind the experiment.

```html
<div id="data-view" style="padding:20px; background:rgba(15,23,42,0.95); border-radius:12px;">
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
    
    <!-- Live Values -->
    <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:16px;">
      <h3 style="color:#94A3B8; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px;">
        Live Measurements
      </h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <div style="color:#94A3B8; font-size:11px;">pH</div>
          <div style="color:#60A5FA; font-size:24px; font-family:monospace; font-weight:bold;" id="data-ph">7.00</div>
        </div>
        <div>
          <div style="color:#94A3B8; font-size:11px;">Temperature</div>
          <div style="color:#EF4444; font-size:24px; font-family:monospace; font-weight:bold;" id="data-temp">22.0°C</div>
        </div>
        <div>
          <div style="color:#94A3B8; font-size:11px;">Volume</div>
          <div style="color:#34D399; font-size:24px; font-family:monospace; font-weight:bold;" id="data-volume">50.0 ml</div>
        </div>
        <div>
          <div style="color:#94A3B8; font-size:11px;">[H₃O⁺]</div>
          <div style="color:#F59E0B; font-size:24px; font-family:monospace; font-weight:bold;" id="data-h3o">1.0×10⁻⁷ M</div>
        </div>
      </div>
    </div>

    <!-- Chemical Equation -->
    <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:16px;">
      <h3 style="color:#94A3B8; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px;">
        Chemical Equation
      </h3>
      <div style="color:#E2E8F0; font-size:18px; text-align:center; padding:20px; font-family:serif;" id="data-equation">
        HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)
      </div>
      <div style="color:#94A3B8; font-size:12px; text-align:center;">
        Neutralization reaction — strong acid + strong base
      </div>
    </div>

    <!-- Graph -->
    <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:16px; grid-column:span 2;">
      <h3 style="color:#94A3B8; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px;">
        Titration Curve
      </h3>
      <canvas id="data-graph" width="500" height="200" style="width:100%; border-radius:8px;"></canvas>
    </div>
  </div>
</div>
```

```javascript
function renderDataView() {
  // Update live values
  document.getElementById('data-ph').textContent = currentPH.toFixed(2);
  document.getElementById('data-temp').textContent = currentTemp.toFixed(1) + '°C';
  document.getElementById('data-volume').textContent = currentVolume.toFixed(1) + ' ml';
  
  // Calculate [H₃O⁺] from pH
  const h3o = Math.pow(10, -currentPH);
  document.getElementById('data-h3o').textContent = h3o.toExponential(1) + ' M';
  
  // Draw titration curve graph
  drawTitrationCurve();
}

function drawTitrationCurve() {
  const canvas = document.getElementById('data-graph');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  
  ctx.clearRect(0, 0, w, h);
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 7; i++) {
    const y = padding.top + ((h - padding.top - padding.bottom) * i / 7);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
  
  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, h - padding.bottom);
  ctx.lineTo(w - padding.right, h - padding.bottom);
  ctx.stroke();
  
  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 7; i++) {
    const val = 14 - i * 2;
    const y = padding.top + ((h - padding.top - padding.bottom) * i / 7);
    ctx.fillText(val.toString(), padding.left - 5, y + 3);
  }
  
  ctx.textAlign = 'center';
  ctx.fillText('Volume NaOH (ml)', w/2, h - 5);
  
  // Draw titration curve (S-shape)
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  
  ctx.strokeStyle = '#60A5FA';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  for (let x = 0; x <= plotW; x++) {
    const volume = (x / plotW) * 50; // 0-50ml
    // Sigmoid approximation of titration curve
    const pH = 14 / (1 + Math.exp(-(volume - 25) / 3)) + 0.5;
    const y = padding.top + plotH - (pH / 14) * plotH;
    
    if (x === 0) ctx.moveTo(padding.left + x, y);
    else ctx.lineTo(padding.left + x, y);
  }
  ctx.stroke();
  
  // Current position dot
  const currentX = padding.left + (currentVolume / 50) * plotW;
  const currentY = padding.top + plotH - (currentPH / 14) * plotH;
  
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
}
```

## Key Design Rules
1. Three modes: Macro (visual), Micro (molecular), Data (quantitative)
2. Toggle buttons at top, always visible
3. Smooth transition between views (fade or slide)
4. Macro: Canvas 2D with apparatus drawing
5. Micro: Particle system with Brownian motion and collisions
6. Data: Live numbers, equations, graphs
7. All three views show the SAME experiment state
8. Changing sliders updates ALL views simultaneously
9. Mobile: stacked layout, view toggle above canvas
