# Real-Time Graph Display Pattern

Every simulation should include a small graph panel that plots key variables in real-time. This provides the "multiple representations" pattern from PhET — students see the visualization AND the data simultaneously.

## Layout (Graph Panel Position)

### Desktop: Bottom-right corner, overlaid on visualization
```
┌─────────────────────────────────────────────┐
│                                              │
│   MAIN VISUALIZATION                         │
│                                              │
│                              ┌──────────────┐│
│                              │ GRAPH PANEL  ││
│                              │ pH vs Volume ││
│                              │     ╱╲       ││
│                              │    ╱  ╲      ││
│                              │   ╱    ╲     ││
│                              │──╱──────╲────││
│                              │  0  5  10 ml ││
│                              └──────────────┘│
└─────────────────────────────────────────────┘
```

### Mobile: Below visualization, full width
```
┌─────────────────────────┐
│  MAIN VISUALIZATION     │
├─────────────────────────┤
│  GRAPH (full width)     │
│  pH vs Volume Added     │
│     ╱╲                  │
│    ╱  ╲                 │
│   ╱    ╲                │
│──╱──────╲────           │
│  0  5  10 ml            │
└─────────────────────────┘
```

## HTML Structure

```html
<div id="graph-panel" style="position:absolute; bottom:12px; right:12px; width:280px; height:180px; 
     background:rgba(15,23,42,0.92); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); 
     border-radius:10px; padding:12px; z-index:10;">
  <!-- Graph title -->
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
    <span style="color:#94A3B8; font-size:11px; text-transform:uppercase; letter-spacing:1px;" id="graph-title">
      pH vs Volume
    </span>
    <button id="graph-toggle" style="background:none; border:none; color:#64748B; cursor:pointer; font-size:16px;">−</button>
  </div>
  <!-- Canvas for graph -->
  <canvas id="graph-canvas" width="256" height="130" style="width:100%; border-radius:6px;"></canvas>
  <!-- Legend -->
  <div id="graph-legend" style="display:flex; gap:12px; margin-top:6px;">
    <span style="display:flex; align-items:center; gap:4px; color:#60A5FA; font-size:11px;">
      <span style="width:8px; height:8px; border-radius:50%; background:#60A5FA; display:inline-block;"></span>
      <span id="legend-label-1">pH</span>
    </span>
    <span style="display:flex; align-items:center; gap:4px; color:#34D399; font-size:11px;">
      <span style="width:8px; height:8px; border-radius:50%; background:#34D399; display:inline-block;"></span>
      <span id="legend-label-2">Temperature</span>
    </span>
  </div>
</div>
```

## JavaScript Implementation

```javascript
class RealTimeGraph {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.data = { x: [], y1: [], y2: [] };
    this.maxPoints = options.maxPoints || 50;
    this.xLabel = options.xLabel || 'Time';
    this.y1Label = options.y1Label || 'pH';
    this.y2Label = options.y2Label || 'Temperature (°C)';
    this.y1Range = options.y1Range || [0, 14];
    this.y2Range = options.y2Range || [0, 100];
    this.y1Color = options.y1Color || '#60A5FA';
    this.y2Color = options.y2Color || '#34D399';
    this.showY2 = options.showY2 !== false;
    this.gridColor = 'rgba(255,255,255,0.08)';
    this.axisColor = 'rgba(255,255,255,0.3)';
    this.labelColor = 'rgba(255,255,255,0.5)';
  }

  addPoint(x, y1, y2 = null) {
    this.data.x.push(x);
    this.data.y1.push(y1);
    if (y2 !== null) this.data.y2.push(y2);
    
    // Trim old data
    if (this.data.x.length > this.maxPoints) {
      this.data.x.shift();
      this.data.y1.shift();
      if (this.data.y2.length) this.data.y2.shift();
    }
    
    this.draw();
  }

  draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 10, right: 10, bottom: 20, left: 35 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH * i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (plotW * i / 5);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = this.axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.lineTo(w - padding.right, h - padding.bottom);
    ctx.stroke();

    // Y1 axis labels (left)
    ctx.fillStyle = this.labelColor;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    const [y1Min, y1Max] = this.y1Range;
    for (let i = 0; i <= 4; i++) {
      const val = y1Max - (y1Max - y1Min) * i / 4;
      const y = padding.top + (plotH * i / 4);
      ctx.fillText(val.toFixed(1), padding.left - 4, y + 3);
    }

    // X axis labels (bottom)
    ctx.textAlign = 'center';
    if (this.data.x.length > 0) {
      const xMin = this.data.x[0];
      const xMax = this.data.x[this.data.x.length - 1];
      for (let i = 0; i <= 5; i++) {
        const val = xMin + (xMax - xMin) * i / 5;
        const x = padding.left + (plotW * i / 5);
        ctx.fillText(val.toFixed(1), x, h - padding.bottom + 12);
      }
    }

    // Plot Y1 line
    if (this.data.y1.length > 1) {
      ctx.strokeStyle = this.y1Color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const xMin = this.data.x[0];
      const xRange = this.data.x[this.data.x.length - 1] - xMin || 1;
      
      for (let i = 0; i < this.data.y1.length; i++) {
        const x = padding.left + ((this.data.x[i] - xMin) / xRange) * plotW;
        const y = padding.top + plotH - ((this.data.y1[i] - y1Min) / (y1Max - y1Min)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current value dot
      const lastX = padding.left + plotW;
      const lastY = padding.top + plotH - ((this.data.y1[this.data.y1.length - 1] - y1Min) / (y1Max - y1Min)) * plotH;
      ctx.fillStyle = this.y1Color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Plot Y2 line (if enabled)
    if (this.showY2 && this.data.y2.length > 1) {
      ctx.strokeStyle = this.y2Color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const xMin = this.data.x[0];
      const xRange = this.data.x[this.data.x.length - 1] - xMin || 1;
      const [y2Min, y2Max] = this.y2Range;
      
      for (let i = 0; i < this.data.y2.length; i++) {
        const x = padding.left + ((this.data.x[i] - xMin) / xRange) * plotW;
        const y = padding.top + plotH - ((this.data.y2[i] - y2Min) / (y2Max - y2Min)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  reset() {
    this.data = { x: [], y1: [], y2: [] };
    this.draw();
  }
}

// Usage in simulation
const graph = new RealTimeGraph('graph-canvas', {
  xLabel: 'Volume (ml)',
  y1Label: 'pH',
  y2Label: 'Temperature (°C)',
  y1Range: [0, 14],
  y2Range: [15, 45],
  showY2: true
});

// Add points as simulation progresses
graph.addPoint(0, 7.0, 22.0);    // Initial: pH 7, temp 22°C
graph.addPoint(5, 6.2, 22.5);    // After 5ml: pH dropped slightly
graph.addPoint(10, 3.1, 23.0);   // After 10ml: pH dropped more
graph.addPoint(15, 2.0, 24.5);   // After 15ml: acidic, temp rising

// Toggle graph visibility
document.getElementById('graph-toggle').addEventListener('click', () => {
  const canvas = document.getElementById('graph-canvas');
  const legend = document.getElementById('graph-legend');
  const btn = document.getElementById('graph-toggle');
  if (canvas.style.display === 'none') {
    canvas.style.display = 'block';
    legend.style.display = 'flex';
    btn.textContent = '−';
  } else {
    canvas.style.display = 'none';
    legend.style.display = 'none';
    btn.textContent = '+';
  }
});
```

## Pre-Built Graph Configurations

### Titration (pH vs Volume)
```javascript
const titrationGraph = new RealTimeGraph('graph-canvas', {
  y1Label: 'pH', y1Range: [0, 14], y1Color: '#60A5FA',
  y2Label: 'Temperature (°C)', y2Range: [15, 45], y2Color: '#EF4444',
  xLabel: 'Volume NaOH (ml)', showY2: true
});
```

### Reaction Rate (Volume vs Time)
```javascript
const rateGraph = new RealTimeGraph('graph-canvas', {
  y1Label: 'Gas Volume (ml)', y1Range: [0, 100], y1Color: '#34D399',
  xLabel: 'Time (s)', showY2: false
});
```

### Cooling Curve (Temperature vs Time)
```javascript
const coolingGraph = new RealTimeGraph('graph-canvas', {
  y1Label: 'Temperature (°C)', y1Range: [0, 100], y1Color: '#F59E0B',
  xLabel: 'Time (min)', showY2: false
});
```

### Ohm's Law (Voltage vs Current)
```javascript
const ohmGraph = new RealTimeGraph('graph-canvas', {
  y1Label: 'Voltage (V)', y1Range: [0, 12], y1Color: '#EF4444',
  y2Label: 'Current (A)', y2Range: [0, 2], y2Color: '#3B82F6',
  xLabel: 'Resistance (Ω)', showY2: true
});
```

## Key Design Rules
1. Graph is semi-transparent overlay (doesn't block visualization)
2. Collapsible (minimize to save space)
3. Shows 2 variables simultaneously (dual Y-axis)
4. Updates in real-time as simulation progresses
5. Current value highlighted with a dot
6. Grid lines for readability
7. Color-coded lines with legend
8. Responsive (works on mobile)
9. Pre-built configurations for common experiments
